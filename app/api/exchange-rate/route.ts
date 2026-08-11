import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { noStoreHeaders } from "@/lib/security/request";
import { roundConvertedAmount, roundRate } from "@/lib/finance/money";

export const runtime = "nodejs";

type FrankfurterRate = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

type CachedRate = {
  base_currency: string;
  quote_currency: string;
  rate_date: string;
  rate: number | string;
  source: string;
  fetched_at: string;
};

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LATEST_CACHE_MS = 60 * 60 * 1000;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: noStoreHeaders() },
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("Not authenticated.", 401);

  const from = (request.nextUrl.searchParams.get("from") ?? "EUR").toUpperCase();
  const to = (request.nextUrl.searchParams.get("to") ?? "EUR").toUpperCase();
  const requestedDate = request.nextUrl.searchParams.get("date")?.trim() || null;

  if (!CURRENCY_PATTERN.test(from) || !CURRENCY_PATTERN.test(to)) {
    return jsonError("Use valid three-letter ISO currency codes.", 400);
  }

  if (requestedDate && !DATE_PATTERN.test(requestedDate)) {
    return jsonError("Use a valid ISO date (YYYY-MM-DD).", 400);
  }

  const amountParam = request.nextUrl.searchParams.get("amount");
  const amount = amountParam === null ? null : Number(amountParam);
  if (
    amount !== null &&
    (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000)
  ) {
    return jsonError("Use a valid positive conversion amount.", 400);
  }

  if (from === to) {
    return NextResponse.json(
      {
        base: from,
        quote: to,
        rate: 1,
        convertedAmount: amount,
        date: requestedDate ?? new Date().toISOString().slice(0, 10),
        source: "identity",
      },
      { headers: noStoreHeaders() },
    );
  }

  let service: ReturnType<typeof createServiceClient> | null = null;
  let staleCached: CachedRate | null = null;
  try {
    service = createServiceClient();
  } catch {
    service = null;
  }

  if (service) {
    let cacheQuery = service
      .from("fx_rate_cache")
      .select("base_currency,quote_currency,rate_date,rate,source,fetched_at")
      .eq("base_currency", from)
      .eq("quote_currency", to);

    if (requestedDate) {
      cacheQuery = cacheQuery.eq("requested_date", requestedDate);
    }

    const { data: cachedRows } = await cacheQuery
      .order("rate_date", { ascending: false })
      .limit(1);
    const cached = (cachedRows?.[0] ?? null) as CachedRate | null;
    staleCached = cached;
    const cacheFresh = requestedDate
      ? Boolean(cached)
      : Boolean(
          cached &&
            Date.now() - new Date(cached.fetched_at).getTime() < LATEST_CACHE_MS,
        );

    if (cached && cacheFresh) {
      const rate = roundRate(cached.rate);
      return NextResponse.json(
        {
          base: from,
          quote: to,
          rate,
          convertedAmount:
            amount === null ? null : roundConvertedAmount(amount * rate),
          date: cached.rate_date,
          source: cached.source,
          cached: true,
        },
        { headers: noStoreHeaders() },
      );
    }
  }

  const staleFallback = () => {
    if (!staleCached) return null;
    const rate = roundRate(staleCached.rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;

    return NextResponse.json(
      {
        base: from,
        quote: to,
        rate,
        convertedAmount:
          amount === null ? null : roundConvertedAmount(amount * rate),
        date: staleCached.rate_date,
        source: `${staleCached.source} · cached fallback`,
        cached: true,
        stale: true,
      },
      { headers: noStoreHeaders() },
    );
  };

  try {
    const dateQuery = requestedDate
      ? `?date=${encodeURIComponent(requestedDate)}`
      : "";
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}${dateQuery}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) {
      const fallback = staleFallback();
      if (fallback) return fallback;

      return jsonError(
        `No exchange rate is available for ${from}/${to}${requestedDate ? ` on ${requestedDate}` : ""}.`,
        response.status === 404 ? 404 : 502,
      );
    }

    const data = (await response.json()) as FrankfurterRate;
    const rate = roundRate(data.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return jsonError("The exchange-rate provider returned an invalid rate.", 502);
    }

    const rateDate = data.date ?? requestedDate ?? new Date().toISOString().slice(0, 10);
    const source = "Frankfurter reference rate";

    if (service) {
      await service.from("fx_rate_cache").upsert(
        {
          base_currency: from,
          quote_currency: to,
          requested_date: requestedDate ?? rateDate,
          rate_date: rateDate,
          rate,
          source,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "base_currency,quote_currency,requested_date" },
      );
    }

    return NextResponse.json(
      {
        base: data.base ?? from,
        quote: data.quote ?? to,
        rate,
        convertedAmount:
          amount === null ? null : roundConvertedAmount(amount * rate),
        date: rateDate,
        source,
        cached: false,
      },
      { headers: noStoreHeaders() },
    );
  } catch {
    const fallback = staleFallback();
    if (fallback) return fallback;
    return jsonError("The exchange-rate service is temporarily unavailable.", 503);
  }
}

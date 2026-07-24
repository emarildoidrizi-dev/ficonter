import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { noStoreHeaders } from "@/lib/security/request";

export const runtime = "nodejs";

type FrankfurterRate = {
  date?: string;
  base?: string;
  quote?: string;
  rate?: number;
};

const SUPPORTED_CODES = new Set([
  "AUD", "BGN", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP",
  "HKD", "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR",
  "NOK", "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD",
  "ZAR",
]);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  const from = (request.nextUrl.searchParams.get("from") ?? "EUR").toUpperCase();
  const to = (request.nextUrl.searchParams.get("to") ?? "EUR").toUpperCase();

  if (!SUPPORTED_CODES.has(from) || !SUPPORTED_CODES.has(to)) {
    return NextResponse.json(
      { error: "Unsupported currency code." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (from === to) {
    return NextResponse.json(
      {
        base: from,
        quote: to,
        rate: 1,
        date: new Date().toISOString().slice(0, 10),
        source: "identity",
      },
      { headers: noStoreHeaders() },
    );
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `No exchange rate is available for ${from}/${to}.` },
        { status: response.status === 404 ? 404 : 502, headers: noStoreHeaders() },
      );
    }

    const data = (await response.json()) as FrankfurterRate;
    const rate = Number(data.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: "The exchange-rate provider returned an invalid rate." },
        { status: 502, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      {
        base: data.base ?? from,
        quote: data.quote ?? to,
        rate,
        date: data.date ?? new Date().toISOString().slice(0, 10),
        source: "Frankfurter",
      },
      { headers: noStoreHeaders() },
    );
  } catch {
    return NextResponse.json(
      { error: "The exchange-rate service is temporarily unavailable." },
      { status: 503, headers: noStoreHeaders() },
    );
  }
}

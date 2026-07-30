"use client";

import {
  finiteNumber,
  roundConvertedAmount,
  roundRate,
} from "@/lib/finance/money";

export type ExchangeRateResult = {
  base: string;
  quote: string;
  rate: number;
  date: string;
  source: string;
  convertedAmount: number | null;
};

type CacheEntry = {
  expiresAt: number;
  value: ExchangeRateResult;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<ExchangeRateResult>>();

function cacheKey(from: string, to: string): string {
  return `${from.toUpperCase()}:${to.toUpperCase()}`;
}

function identityRate(from: string, to: string, amount?: number | null) {
  return {
    base: from,
    quote: to,
    rate: 1,
    convertedAmount: amount == null ? null : roundConvertedAmount(amount),
    date: new Date().toISOString().slice(0, 10),
    source: "identity",
  } satisfies ExchangeRateResult;
}

export async function getExchangeRate(
  fromInput: string,
  toInput = "EUR",
  options?: { signal?: AbortSignal; forceRefresh?: boolean },
): Promise<ExchangeRateResult> {
  const from = fromInput.toUpperCase();
  const to = toInput.toUpperCase();

  if (from === to) return identityRate(from, to);

  const key = cacheKey(from, to);
  const cached = cache.get(key);
  if (!options?.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existing = pending.get(key);
  if (existing && !options?.forceRefresh) return existing;

  const request = (async () => {
    const response = await fetch(
      `/api/exchange-rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      {
        signal: options?.signal,
        cache: "no-store",
      },
    );
    const data = (await response.json()) as Partial<ExchangeRateResult> & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Unable to retrieve an exchange rate.");
    }

    const rate = roundRate(data.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("The exchange-rate provider returned an invalid rate.");
    }

    const value: ExchangeRateResult = {
      base: data.base ?? from,
      quote: data.quote ?? to,
      rate,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      source: data.source ?? "exchange-rate",
      convertedAmount: null,
    };

    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  })();

  pending.set(key, request);
  try {
    return await request;
  } finally {
    if (pending.get(key) === request) pending.delete(key);
  }
}

export async function convertWithCachedRate(
  amountInput: unknown,
  from: string,
  to = "EUR",
  options?: { signal?: AbortSignal; forceRefresh?: boolean },
): Promise<ExchangeRateResult> {
  const amount = finiteNumber(amountInput);
  if (amount <= 0) throw new Error("Enter an amount greater than zero.");

  const rateResult = await getExchangeRate(from, to, options);
  return {
    ...rateResult,
    convertedAmount: roundConvertedAmount(amount * rateResult.rate),
  };
}

export function clearExchangeRateCache(): void {
  cache.clear();
  pending.clear();
}

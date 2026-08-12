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
  cached?: boolean;
};

type CacheEntry = {
  expiresAt: number;
  value: ExchangeRateResult;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const HISTORICAL_CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<ExchangeRateResult>>();
const STORAGE_PREFIX = "ficonter-fx:";

function cacheKey(from: string, to: string, date?: string | null): string {
  return `${from.toUpperCase()}:${to.toUpperCase()}:${date ?? "latest"}`;
}

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function identityRate(from: string, to: string, amount?: number | null, date?: string | null) {
  return {
    base: from,
    quote: to,
    rate: 1,
    convertedAmount: amount == null ? null : roundConvertedAmount(amount),
    date: date ?? new Date().toISOString().slice(0, 10),
    source: "identity",
  } satisfies ExchangeRateResult;
}

function readPersistentCache(key: string): CacheEntry | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.value || !Number.isFinite(parsed.value.rate)) return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistentCache(key: string, entry: CacheEntry) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // In-memory caching remains available.
  }
}

export async function getExchangeRate(
  fromInput: string,
  toInput = "EUR",
  options?: {
    signal?: AbortSignal;
    forceRefresh?: boolean;
    date?: string | null;
  },
): Promise<ExchangeRateResult> {
  const from = fromInput.toUpperCase();
  const to = toInput.toUpperCase();
  const date = options?.date?.slice(0, 10) || null;

  if (from === to) return identityRate(from, to, null, date);

  const key = cacheKey(from, to, date);
  const inMemory = cache.get(key);
  if (!options?.forceRefresh && inMemory && inMemory.expiresAt > Date.now()) {
    return inMemory.value;
  }

  if (!options?.forceRefresh) {
    const persisted = readPersistentCache(key);
    if (persisted) {
      cache.set(key, persisted);
      return persisted.value;
    }
  }

  const existing = pending.get(key);
  if (existing && !options?.forceRefresh) return existing;

  const request = (async () => {
    const params = new URLSearchParams({ from, to });
    if (date) params.set("date", date);

    const response = await fetch(`/api/exchange-rate?${params.toString()}`, {
      signal: options?.signal,
      cache: "no-store",
    });
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
      date: data.date ?? date ?? new Date().toISOString().slice(0, 10),
      source: data.source ?? "exchange-rate",
      convertedAmount: null,
      cached: data.cached,
    };

    const entry = {
      expiresAt:
        Date.now() + (date ? HISTORICAL_CACHE_TTL_MS : CACHE_TTL_MS),
      value,
    };
    cache.set(key, entry);
    writePersistentCache(key, entry);
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
  options?: {
    signal?: AbortSignal;
    forceRefresh?: boolean;
    date?: string | null;
  },
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
  if (typeof localStorage !== "undefined") {
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_PREFIX));
      for (const key of keys) localStorage.removeItem(key);
    } catch {
      // Ignore browser-storage failures.
    }
  }
}

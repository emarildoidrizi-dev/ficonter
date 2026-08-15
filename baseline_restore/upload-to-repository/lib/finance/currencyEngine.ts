import {
  CURRENCY_CODES,
  type CurrencyCode,
  formatCurrency,
} from "@/lib/financialOptions";

export const DEFAULT_BASE_CURRENCY: CurrencyCode = "EUR";

const SUPPORTED_CURRENCY_SET = new Set<string>(CURRENCY_CODES);

export type OriginalMoney = Readonly<{
  amount: number;
  currency: CurrencyCode;
}>;

export type ExchangeRateSnapshot = Readonly<{
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  rateDate: string;
  source: string;
}>;

export type ConvertedMoney = Readonly<{
  original: OriginalMoney;
  displayAmount: number;
  displayCurrency: CurrencyCode;
  rate: number;
  rateDate: string | null;
  rateSource: string;
}>;

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" &&
    SUPPORTED_CURRENCY_SET.has(value.trim().toUpperCase())
  );
}

export function normalizeCurrency(
  value: unknown,
  fallback: CurrencyCode = DEFAULT_BASE_CURRENCY,
): CurrencyCode {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  return isSupportedCurrency(normalized) ? normalized : fallback;
}

export function createOriginalMoney(
  amount: number,
  currency: unknown,
): OriginalMoney {
  if (!Number.isFinite(amount)) {
    throw new Error("Money amount must be a finite number.");
  }

  return Object.freeze({
    amount,
    currency: normalizeCurrency(currency),
  });
}

/**
 * Converts only from the immutable original amount.
 *
 * Never feed a previously converted display amount back into this function.
 * This is the invariant that prevents EUR -> USD -> EUR drift.
 */
export function convertFromOriginal(
  original: OriginalMoney,
  displayCurrency: CurrencyCode,
  snapshot?: ExchangeRateSnapshot | null,
): ConvertedMoney {
  const target = normalizeCurrency(displayCurrency);

  if (original.currency === target) {
    return Object.freeze({
      original,
      displayAmount: original.amount,
      displayCurrency: target,
      rate: 1,
      rateDate: null,
      rateSource: "original currency",
    });
  }

  if (!snapshot) {
    throw new Error(
      `Missing exchange rate for ${original.currency} -> ${target}.`,
    );
  }

  if (
    snapshot.fromCurrency !== original.currency ||
    snapshot.toCurrency !== target
  ) {
    throw new Error(
      `Exchange-rate pair mismatch. Expected ${original.currency} -> ${target}.`,
    );
  }

  if (!Number.isFinite(snapshot.rate) || snapshot.rate <= 0) {
    throw new Error("Exchange rate must be greater than zero.");
  }

  return Object.freeze({
    original,
    displayAmount: original.amount * snapshot.rate,
    displayCurrency: target,
    rate: snapshot.rate,
    rateDate: snapshot.rateDate,
    rateSource: snapshot.source,
  });
}

export function formatOriginalMoney(
  money: OriginalMoney,
): string {
  return formatCurrency(money.amount, money.currency);
}

export function formatConvertedMoney(
  money: ConvertedMoney,
): string {
  return formatCurrency(money.displayAmount, money.displayCurrency);
}

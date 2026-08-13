/**
 * Shared money helpers for Ficonter.
 *
 * EUR reporting values are rounded at the boundary where they are stored or
 * aggregated. This avoids binary floating-point drift such as
 * 0.1 + 0.2 = 0.30000000000000004 leaking into totals.
 */

export const EUR_DECIMALS = 2;
export const RATE_DECIMALS = 8;
export const CONVERTED_AMOUNT_DECIMALS = 6;

export function finiteNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function roundDecimal(value: unknown, decimals = EUR_DECIMALS): number {
  const numeric = finiteNumber(value);
  const factor = 10 ** decimals;
  const sign = numeric < 0 ? -1 : 1;
  return (
    sign * Math.round((Math.abs(numeric) + Number.EPSILON) * factor) / factor
  );
}

export function roundMoney(value: unknown): number {
  return roundDecimal(value, EUR_DECIMALS);
}

export function roundRate(value: unknown): number {
  return roundDecimal(value, RATE_DECIMALS);
}

export function roundConvertedAmount(value: unknown): number {
  return roundDecimal(value, CONVERTED_AMOUNT_DECIMALS);
}

export function toMinorUnits(value: unknown, decimals = EUR_DECIMALS): number {
  const factor = 10 ** decimals;
  const numeric = finiteNumber(value);
  const sign = numeric < 0 ? -1 : 1;
  return sign * Math.round((Math.abs(numeric) + Number.EPSILON) * factor);
}

export function fromMinorUnits(value: number, decimals = EUR_DECIMALS): number {
  return value / 10 ** decimals;
}

export function sumMoney(
  values: Iterable<unknown>,
  decimals = CONVERTED_AMOUNT_DECIMALS,
): number {
  let minorUnits = 0;
  for (const value of values) {
    minorUnits += toMinorUnits(value, decimals);
  }
  return fromMinorUnits(minorUnits, decimals);
}

export function addMoney(...values: unknown[]): number {
  return sumMoney(values);
}

export function subtractMoney(start: unknown, ...deductions: unknown[]): number {
  const decimals = CONVERTED_AMOUNT_DECIMALS;
  const startMinor = toMinorUnits(start, decimals);
  const deductionsMinor = deductions.reduce<number>(
    (total, value) => total + toMinorUnits(value, decimals),
    0,
  );
  return fromMinorUnits(startMinor - deductionsMinor, decimals);
}

export function positiveMoney(value: unknown): number {
  return Math.max(0, roundMoney(value));
}

export function convertToReportingCurrency(
  amount: unknown,
  rate: unknown,
): number {
  return roundConvertedAmount(finiteNumber(amount) * finiteNumber(rate));
}

export function moneyEquals(left: unknown, right: unknown): boolean {
  return toMinorUnits(left) === toMinorUnits(right);
}

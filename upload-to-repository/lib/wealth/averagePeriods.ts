export const AVERAGE_PERIODS = [3, 6, 9, 12] as const;
export type AveragePeriod = (typeof AVERAGE_PERIODS)[number];

export type CalendarPeriodSummary = {
  total: number;
  average: number;
  months: string[];
};

function localMonthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function recentCalendarMonths(
  period: AveragePeriod,
  referenceDate = new Date(),
): string[] {
  const months: string[] = [];
  const cursor = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1,
  );

  for (let index = period - 1; index >= 0; index -= 1) {
    const month = new Date(cursor.getFullYear(), cursor.getMonth() - index, 1);
    months.push(localMonthKey(month));
  }

  return months;
}

export function summarizeDatedAmounts<T>(
  records: readonly T[],
  period: AveragePeriod,
  getDate: (record: T) => string | Date,
  getAmount: (record: T) => number,
  referenceDate = new Date(),
): CalendarPeriodSummary {
  const months = recentCalendarMonths(period, referenceDate);
  const monthSet = new Set(months);

  const total = records.reduce((sum, record) => {
    const parsed = new Date(getDate(record));
    if (Number.isNaN(parsed.getTime())) return sum;
    if (!monthSet.has(localMonthKey(parsed))) return sum;

    const amount = getAmount(record);
    return Number.isFinite(amount) ? sum + Math.max(0, amount) : sum;
  }, 0);

  return {
    total,
    average: total / period,
    months,
  };
}

export function averageMonthlyFromSeries<T>(
  months: readonly T[],
  period: AveragePeriod,
  getAmount: (month: T) => number,
): number {
  const total = months
    .slice(-period)
    .reduce((sum, month) => sum + Math.max(0, getAmount(month)), 0);

  return total / period;
}

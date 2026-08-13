/**
 * Returns a local YYYY-MM-DD key without UTC conversion.
 */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the inclusive end date for FICONTER's one-calendar-month
 * commitment window. The day is clamped to the final day of the target
 * month, so 31 January resolves to 28/29 February instead of rolling into
 * March.
 */
export function oneCalendarMonthEnd(date = new Date()): Date {
  const targetYear = date.getMonth() === 11 ? date.getFullYear() + 1 : date.getFullYear();
  const targetMonth = (date.getMonth() + 1) % 12;
  const finalTargetDay = new Date(targetYear, targetMonth + 1, 0).getDate();

  return new Date(
    targetYear,
    targetMonth,
    Math.min(date.getDate(), finalTargetDay),
  );
}

export function oneCalendarMonthEndKey(date = new Date()): string {
  return localDateKey(oneCalendarMonthEnd(date));
}

export function isWithinOneCalendarMonth(
  dateKey: string,
  start = new Date(),
): boolean {
  const startKey = localDateKey(start);
  const endKey = oneCalendarMonthEndKey(start);
  return dateKey >= startKey && dateKey <= endKey;
}

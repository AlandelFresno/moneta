/** First day of the period containing `date`, given a period start day (1–28). Before `startDay` this month, the period started `startDay` of last month. */
export function periodStart(date: Date, startDay: number): Date {
  if (date.getDate() >= startDay) {
    return new Date(date.getFullYear(), date.getMonth(), startDay);
  }
  return new Date(date.getFullYear(), date.getMonth() - 1, startDay);
}

/** Inclusive [start, end] range of the period containing `date`. At startDay=1 this matches the plain calendar month exactly. */
export function periodRange(date: Date, startDay: number): { start: Date; end: Date } {
  const start = periodStart(date, startDay);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1);
  return { start, end };
}

/** Day-1-normalized calendar month used to label/key the period `date` falls in — e.g. startDay=6, Aug 3 → July 1 (that period is "July's"). Only for real dates, never for an already-normalized label (see BudgetService). */
export function periodLabelMonth(date: Date, startDay: number): Date {
  const start = periodStart(date, startDay);
  return new Date(start.getFullYear(), start.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

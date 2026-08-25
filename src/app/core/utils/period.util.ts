import { Transaction } from '../types/transaction.types';

/** First day of the period containing `date`, given a period start day (1–28). Before `startDay` this month, the period started `startDay` of last month. */
export function periodStart(date: Date, startDay: number): Date {
  if (date.getDate() >= startDay) {
    return new Date(date.getFullYear(), date.getMonth(), startDay);
  }
  return new Date(date.getFullYear(), date.getMonth() - 1, startDay);
}

/**
 * Real start of the period containing `reference`. Falls back to the nominal `startDay`/`startHour` boundary,
 * unless a transaction was marked `isPeriodStart` and buckets (via the day-only `periodStart`) into the same
 * nominal period — that transaction's exact timestamp wins instead, since salary doesn't always land at the
 * same day/hour. Earliest wins if more than one marker somehow lands in the same bucket.
 */
export function actualPeriodStart(reference: Date, transactions: Transaction[], startDay: number, startHour: number): Date {
  const nominal = periodStart(reference, startDay);
  const marker = transactions
    .filter((txn) => txn.isPeriodStart && periodStart(txn.date, startDay).getTime() === nominal.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  if (marker) return marker.date;
  return new Date(nominal.getFullYear(), nominal.getMonth(), nominal.getDate(), startHour);
}

/** Exact, gapless [start, end] range of the period containing `date` — `end` is the next period's `actualPeriodStart` minus 1ms. */
export function periodRange(date: Date, startDay: number, startHour: number, transactions: Transaction[]): { start: Date; end: Date } {
  const start = actualPeriodStart(date, transactions, startDay, startHour);
  const nominalNext = addMonths(periodStart(date, startDay), 1);
  const nextStart = actualPeriodStart(nominalNext, transactions, startDay, startHour);
  return { start, end: new Date(nextStart.getTime() - 1) };
}

/** Day-1-normalized calendar month used to label/key the period `date` falls in — e.g. startDay=6, Aug 3 → July 1 (that period is "July's"). Only for real dates, never for an already-normalized label (see BudgetService). Nominal/day-only on purpose — marker overrides only affect the real spend range, not the budget label. */
export function periodLabelMonth(date: Date, startDay: number): Date {
  const start = periodStart(date, startDay);
  return new Date(start.getFullYear(), start.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

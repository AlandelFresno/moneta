import { Transaction } from '../types/transaction.types';
import { Bill } from '../types/bill.types';

export interface RecurringCandidate {
  categoryId: string;
  name: string;
  avgAmount: number;
  occurrences: number;
  lastDate: Date;
  transactionIds: string[];
}

const LOOKBACK_MONTHS = 6;
const MIN_OCCURRENCES = 3;
const MIN_AVG_GAP_DAYS = 24;
const MAX_AVG_GAP_DAYS = 36;
const MAX_GAP_STDDEV_DAYS = 10;
const MAX_AMOUNT_DEVIATION_RATIO = 0.25;
const MAX_CANDIDATES = 5;

/**
 * Detects groups of past expense transactions (same category + name) spaced roughly a
 * month apart with roughly consistent amounts — candidates for turning into a Bill.
 * Groups already covered by an active Bill in the same category with a similar
 * approxAmount are excluded (best-effort match, no hard foreign key links the two).
 */
export function detectRecurringCandidates(transactions: Transaction[], bills: Bill[], now: Date): RecurringCandidate[] {
  const since = new Date(now.getFullYear(), now.getMonth() - LOOKBACK_MONTHS, now.getDate());
  const groups = new Map<string, Transaction[]>();

  for (const txn of transactions) {
    if (txn.type !== 'expense' || txn.deletedAt || txn.date < since) continue;
    const key = `${txn.categoryId}::${txn.name.trim().toLowerCase()}`;
    const group = groups.get(key);
    if (group) group.push(txn);
    else groups.set(key, [txn]);
  }

  const candidates: RecurringCandidate[] = [];

  for (const group of groups.values()) {
    if (group.length < MIN_OCCURRENCES) continue;

    const sorted = [...group].sort((a, b) => a.date.getTime() - b.date.getTime());
    const gapsDays = sorted.slice(1).map((txn, i) => (txn.date.getTime() - sorted[i].date.getTime()) / 86_400_000);
    const avgGap = mean(gapsDays);
    if (avgGap < MIN_AVG_GAP_DAYS || avgGap > MAX_AVG_GAP_DAYS || stddev(gapsDays, avgGap) > MAX_GAP_STDDEV_DAYS) continue;

    const avgAmount = mean(sorted.map((txn) => txn.amount));
    if (avgAmount <= 0) continue;
    const maxDeviation = Math.max(...sorted.map((txn) => Math.abs(txn.amount - avgAmount))) / avgAmount;
    if (maxDeviation > MAX_AMOUNT_DEVIATION_RATIO) continue;

    const categoryId = sorted[0].categoryId;
    if (isAlreadyCoveredByBill(bills, categoryId, avgAmount)) continue;

    candidates.push({
      categoryId,
      name: sorted[sorted.length - 1].name,
      avgAmount: Math.round(avgAmount),
      occurrences: sorted.length,
      lastDate: sorted[sorted.length - 1].date,
      transactionIds: sorted.map((txn) => txn.id)
    });
  }

  return candidates.sort((a, b) => b.occurrences - a.occurrences).slice(0, MAX_CANDIDATES);
}

function isAlreadyCoveredByBill(bills: Bill[], categoryId: string, avgAmount: number): boolean {
  return bills.some(
    (bill) =>
      !bill.deletedAt &&
      bill.active &&
      bill.categoryId === categoryId &&
      Math.abs(bill.approxAmount - avgAmount) / avgAmount <= MAX_AMOUNT_DEVIATION_RATIO
  );
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

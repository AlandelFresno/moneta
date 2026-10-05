import { Transaction } from '../types/transaction.types';

const RECENCY_HALF_LIFE_DAYS = 30;

/** Suggests a categoryId by matching description against past transaction names (case-insensitive
 * substring, either direction), weighting each match by recency — a match from last week outweighs
 * several from a year ago — so the suggestion tracks how you're categorizing things lately. */
export function suggestCategoryId(description: string, history: Transaction[], now: Date = new Date()): string | undefined {
  const needle = description.trim().toLowerCase();
  if (!needle) return undefined;

  const scores = new Map<string, number>();

  for (const txn of history) {
    if (txn.deletedAt) continue;
    const name = txn.name.trim().toLowerCase();
    if (!name) continue;
    if (!needle.includes(name) && !name.includes(needle)) continue;

    const daysAgo = Math.max(0, (now.getTime() - txn.date.getTime()) / 86_400_000);
    const recencyWeight = 1 / (1 + daysAgo / RECENCY_HALF_LIFE_DAYS);
    scores.set(txn.categoryId, (scores.get(txn.categoryId) ?? 0) + recencyWeight);
  }

  let bestCategoryId: string | undefined;
  let bestScore = 0;
  for (const [categoryId, score] of scores) {
    if (score > bestScore) {
      bestCategoryId = categoryId;
      bestScore = score;
    }
  }

  return bestCategoryId;
}

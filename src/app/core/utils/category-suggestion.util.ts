import { Transaction } from '../types/transaction.types';

/** Suggests a categoryId by matching description against past transaction names/descriptions
 * (case-insensitive substring, either direction) and picking the most frequent match's category. */
export function suggestCategoryId(description: string, history: Transaction[]): string | undefined {
  const needle = description.trim().toLowerCase();
  if (!needle) return undefined;

  const counts = new Map<string, number>();

  for (const txn of history) {
    if (txn.deletedAt) continue;
    const name = txn.name.trim().toLowerCase();
    if (!name) continue;
    if (needle.includes(name) || name.includes(needle)) {
      counts.set(txn.categoryId, (counts.get(txn.categoryId) ?? 0) + 1);
    }
  }

  let bestCategoryId: string | undefined;
  let bestCount = 0;
  for (const [categoryId, count] of counts) {
    if (count > bestCount) {
      bestCategoryId = categoryId;
      bestCount = count;
    }
  }

  return bestCategoryId;
}

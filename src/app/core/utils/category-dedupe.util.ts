import { Category } from '../types/category.types';
import { Transaction } from '../types/transaction.types';
import { Bill } from '../types/bill.types';
import { Budget } from '../types/budget.types';

export interface CategoryDedupeResult {
  categories: Category[];
  transactions: Transaction[];
  bills: Bill[];
  budgets: Budget[];
  duplicatesRemoved: number;
}

/**
 * Collapses categories that share the same name+type (e.g. two "Salario" categories from
 * devices that seeded default categories under different ids before the fix in c78ce5f).
 * The oldest surviving entry per name+type wins; every other duplicate is repointed and
 * soft-deleted as a tombstone so the merge propagates the cleanup instead of resurrecting it.
 */
export function dedupeCategories(
  categories: Category[],
  transactions: Transaction[],
  bills: Bill[],
  budgets: Budget[],
  now: Date
): CategoryDedupeResult {
  const active = categories.filter((cat) => !cat.deletedAt);
  const groups = new Map<string, Category[]>();

  for (const cat of active) {
    const key = `${cat.type}:${cat.name}`;
    const group = groups.get(key);
    if (group) {
      group.push(cat);
    } else {
      groups.set(key, [cat]);
    }
  }

  const idRemap = new Map<string, string>();
  const removedIds = new Set<string>();

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const [survivor, ...duplicates] = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const duplicate of duplicates) {
      idRemap.set(duplicate.id, survivor.id);
      removedIds.add(duplicate.id);
    }
  }

  if (removedIds.size === 0) {
    return { categories, transactions, bills, budgets, duplicatesRemoved: 0 };
  }

  const mergedCategories = categories.map((cat) =>
    removedIds.has(cat.id) ? { ...cat, deletedAt: now, updatedAt: now } : cat
  );

  const remapId = (categoryId: string): string => idRemap.get(categoryId) ?? categoryId;

  const mergedTransactions = transactions.map((txn) =>
    idRemap.has(txn.categoryId) ? { ...txn, categoryId: remapId(txn.categoryId), updatedAt: now } : txn
  );

  const mergedBills = bills.map((bill) =>
    idRemap.has(bill.categoryId) ? { ...bill, categoryId: remapId(bill.categoryId), updatedAt: now } : bill
  );

  const mergedBudgets = budgets.map((budget) =>
    budget.allocations.some((allocation) => idRemap.has(allocation.categoryId))
      ? {
          ...budget,
          allocations: budget.allocations.map((allocation) =>
            idRemap.has(allocation.categoryId) ? { ...allocation, categoryId: remapId(allocation.categoryId) } : allocation
          ),
          updatedAt: now
        }
      : budget
  );

  return {
    categories: mergedCategories,
    transactions: mergedTransactions,
    bills: mergedBills,
    budgets: mergedBudgets,
    duplicatesRemoved: removedIds.size
  };
}

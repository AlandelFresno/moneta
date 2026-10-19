import { NestedEffect, Transaction } from '../types/transaction.types';

export function signedChildAmount(child: Pick<Transaction, 'amount' | 'parentEffect'>): number {
  return child.parentEffect === 'subtract' ? -child.amount : child.amount;
}

export function childrenOf(parentId: string, transactions: Transaction[]): Transaction[] {
  return transactions.filter((txn) => txn.parentId === parentId);
}

/** The parent's own amount plus its children, each added or subtracted. */
export function netAmount(parent: Transaction, transactions: Transaction[]): number {
  return childrenOf(parent.id, transactions).reduce((sum, child) => sum + signedChildAmount(child), parent.amount);
}

export function nestedEffectLabel(effect: NestedEffect): string {
  return effect === 'add' ? 'Sumar' : 'Restar';
}

/**
 * What every aggregate (balances, budgets, dashboard) should read: a 'parent'-counted family collapses into the
 * parent at its net total; a 'separate' family keeps every record, with subtracting children as negative amounts.
 */
export function effectiveTransactions(transactions: Transaction[]): Transaction[] {
  const byId = new Map(transactions.map((txn) => [txn.id, txn]));
  const result: Transaction[] = [];

  for (const txn of transactions) {
    if (txn.parentId) {
      const parent = byId.get(txn.parentId);
      if (parent?.nestedCounting === 'parent') continue;
      result.push({ ...txn, amount: signedChildAmount(txn) });
    } else if (txn.nestedCounting === 'parent') {
      result.push({ ...txn, amount: netAmount(txn, transactions) });
    } else {
      result.push(txn);
    }
  }

  return result;
}

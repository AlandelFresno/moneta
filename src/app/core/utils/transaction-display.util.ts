import { Transaction } from '../types/transaction.types';
import { Category } from '../types/category.types';

export interface TransactionWithCategory extends Transaction {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

export function withCategory(txn: Transaction, categories: Category[]): TransactionWithCategory {
  const category = categories.find((cat) => cat.id === txn.categoryId);
  return {
    ...txn,
    categoryName: category?.name ?? 'Sin categoría',
    categoryColor: category?.color ?? '#6b7280',
    categoryIcon: category?.icon ?? 'tag'
  };
}

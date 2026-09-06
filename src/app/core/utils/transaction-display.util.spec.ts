import { withCategory } from './transaction-display.util';
import { Transaction } from '../types/transaction.types';
import { Category } from '../types/category.types';

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: '1',
    categoryId: 'cat-1',
    type: 'expense',
    name: 'x',
    description: '',
    amount: 100,
    date: new Date(2026, 0, 15),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

const CATEGORY: Category = {
  id: 'cat-1',
  name: 'Almacén',
  type: 'expense',
  color: '#f00',
  icon: 'tag',
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('withCategory', () => {
  it('attaches the matching category name, color and icon', () => {
    const result = withCategory(txn({ categoryId: 'cat-1' }), [CATEGORY]);
    expect(result.categoryName).toBe('Almacén');
    expect(result.categoryColor).toBe('#f00');
    expect(result.categoryIcon).toBe('tag');
  });

  it('falls back to defaults when the category is missing (e.g. deleted category)', () => {
    const result = withCategory(txn({ categoryId: 'gone' }), [CATEGORY]);
    expect(result.categoryName).toBe('Sin categoría');
    expect(result.categoryColor).toBe('#6b7280');
    expect(result.categoryIcon).toBe('tag');
  });

  it('preserves all original transaction fields', () => {
    const transaction = txn({ categoryId: 'cat-1', amount: 250, name: 'Compra' });
    const result = withCategory(transaction, [CATEGORY]);
    expect(result.amount).toBe(250);
    expect(result.name).toBe('Compra');
  });
});

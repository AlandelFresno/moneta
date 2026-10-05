import { suggestBillId } from './bill-match.util';
import { Bill } from '../types/bill.types';

function bill(overrides: Partial<Bill> & { id: string }): Bill {
  const now = new Date(2026, 0, 1);
  return {
    name: 'Internet',
    description: '',
    categoryId: 'cat-services',
    approxAmount: 18000,
    period: 'monthly',
    dueDate: now,
    active: true,
    payments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('suggestBillId', () => {
  it('matches a single active bill in the same category with a close amount', () => {
    const bills = [bill({ id: 'b1' })];
    const row = { categoryId: 'cat-services', amount: 18500, type: 'expense' as const };

    expect(suggestBillId(row, bills)).toBe('b1');
  });

  it('returns undefined when the amount is outside the 25% tolerance', () => {
    const bills = [bill({ id: 'b1', approxAmount: 18000 })];
    const row = { categoryId: 'cat-services', amount: 30000, type: 'expense' as const };

    expect(suggestBillId(row, bills)).toBeUndefined();
  });

  it('returns undefined when the category does not match', () => {
    const bills = [bill({ id: 'b1', categoryId: 'cat-services' })];
    const row = { categoryId: 'cat-ocio', amount: 18000, type: 'expense' as const };

    expect(suggestBillId(row, bills)).toBeUndefined();
  });

  it('returns undefined for an income row', () => {
    const bills = [bill({ id: 'b1' })];
    const row = { categoryId: 'cat-services', amount: 18000, type: 'income' as const };

    expect(suggestBillId(row, bills)).toBeUndefined();
  });

  it('returns undefined when the bill is inactive', () => {
    const bills = [bill({ id: 'b1', active: false })];
    const row = { categoryId: 'cat-services', amount: 18000, type: 'expense' as const };

    expect(suggestBillId(row, bills)).toBeUndefined();
  });

  it('returns undefined when the bill is soft-deleted', () => {
    const bills = [bill({ id: 'b1', deletedAt: new Date() })];
    const row = { categoryId: 'cat-services', amount: 18000, type: 'expense' as const };

    expect(suggestBillId(row, bills)).toBeUndefined();
  });

  it('returns undefined when multiple bills in the category could equally match — ambiguous, leave it manual', () => {
    const bills = [
      bill({ id: 'b1', name: 'Netflix', approxAmount: 6000 }),
      bill({ id: 'b2', name: 'Spotify', approxAmount: 6200 })
    ];
    const row = { categoryId: 'cat-services', amount: 6100, type: 'expense' as const };

    expect(suggestBillId(row, bills)).toBeUndefined();
  });

  it('returns undefined when categoryId is empty', () => {
    const bills = [bill({ id: 'b1', categoryId: '' })];
    const row = { categoryId: '', amount: 18000, type: 'expense' as const };

    expect(suggestBillId(row, bills)).toBeUndefined();
  });
});

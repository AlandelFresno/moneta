import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TransactionService } from './transaction.service';
import { Transaction } from '../core/types/transaction.types';

const CATEGORY_A = 'cat-groceries';
const CATEGORY_B = 'cat-salary';

function txnInput(overrides: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>> = {}) {
  return {
    categoryId: CATEGORY_A,
    type: 'expense' as const,
    name: 'Supermercado',
    description: '',
    amount: 100,
    date: new Date('2026-01-15'),
    ...overrides
  };
}

describe('TransactionService', () => {
  let service: TransactionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(TransactionService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts empty when there is no stored data', async () => {
    const transactions = await firstValueFrom(service.getAll());
    expect(transactions).toEqual([]);
  });

  it('creates a transaction with generated id and timestamps', async () => {
    const created = await firstValueFrom(service.create(txnInput()));

    expect(created.id).toBeTruthy();
    expect(created.amount).toBe(100);
    expect(created.createdAt).toEqual(jasmine.any(Date));
    expect(created.updatedAt).toEqual(jasmine.any(Date));

    const all = await firstValueFrom(service.getAll());
    expect(all.length).toBe(1);
  });

  it('filters by category', async () => {
    await firstValueFrom(service.create(txnInput({ categoryId: CATEGORY_A })));
    await firstValueFrom(service.create(txnInput({ categoryId: CATEGORY_B, type: 'income', name: 'Sueldo' })));

    const filtered = await firstValueFrom(service.getByCategory(CATEGORY_B));
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Sueldo');
  });

  it('filters by type', async () => {
    await firstValueFrom(service.create(txnInput({ type: 'expense' })));
    await firstValueFrom(service.create(txnInput({ type: 'income', name: 'Sueldo', categoryId: CATEGORY_B })));

    const income = await firstValueFrom(service.getByType('income'));
    expect(income.length).toBe(1);
    expect(income[0].type).toBe('income');
  });

  it('filters by date range (inclusive)', async () => {
    await firstValueFrom(service.create(txnInput({ date: new Date('2026-01-01') })));
    await firstValueFrom(service.create(txnInput({ date: new Date('2026-01-15') })));
    await firstValueFrom(service.create(txnInput({ date: new Date('2026-02-01') })));

    const inRange = await firstValueFrom(
      service.getByDateRange(new Date('2026-01-01'), new Date('2026-01-31'))
    );
    expect(inRange.length).toBe(2);
  });

  it('updates a transaction and bumps updatedAt', async () => {
    const created = await firstValueFrom(service.create(txnInput({ amount: 50 })));
    const originalUpdatedAt = created.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 5));
    await firstValueFrom(service.update(created.id, { amount: 75 }));

    const all = await firstValueFrom(service.getAll());
    const updated = all.find((t) => t.id === created.id)!;
    expect(updated.amount).toBe(75);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('soft-deletes a transaction, removing it from getAll but keeping it in storage', async () => {
    const created = await firstValueFrom(service.create(txnInput()));

    await firstValueFrom(service.delete(created.id));

    const all = await firstValueFrom(service.getAll());
    expect(all.find((t) => t.id === created.id)).toBeUndefined();

    const raw = JSON.parse(localStorage.getItem('transactions')!);
    const stored = raw.find((t: { id: string }) => t.id === created.id);
    expect(stored.deletedAt).toBeTruthy();
  });

  it('computes total income and total expense independently', async () => {
    await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 100 })));
    await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 50 })));
    await firstValueFrom(
      service.create(txnInput({ type: 'income', amount: 1000, categoryId: CATEGORY_B, name: 'Sueldo' }))
    );

    expect(service.getTotalExpense()).toBe(150);
    expect(service.getTotalIncome()).toBe(1000);
  });

  it('restricts totals to a date range when provided', async () => {
    await firstValueFrom(service.create(txnInput({ amount: 100, date: new Date('2026-01-01') })));
    await firstValueFrom(service.create(txnInput({ amount: 200, date: new Date('2026-03-01') })));

    const januaryTotal = service.getTotalExpense(new Date('2026-01-01'), new Date('2026-01-31'));
    expect(januaryTotal).toBe(100);
  });

  it('persists transactions across service instances via localStorage', async () => {
    await firstValueFrom(service.create(txnInput({ name: 'Persistente' })));

    const fresh = new TransactionService();
    const all = await firstValueFrom(fresh.getAll());
    expect(all.some((t) => t.name === 'Persistente')).toBeTrue();
  });

  it('restores Date objects for date/createdAt/updatedAt after reload from storage', async () => {
    await firstValueFrom(service.create(txnInput()));

    const fresh = new TransactionService();
    const all = await firstValueFrom(fresh.getAll());
    expect(all[0].date).toEqual(jasmine.any(Date));
    expect(all[0].createdAt).toEqual(jasmine.any(Date));
    expect(all[0].updatedAt).toEqual(jasmine.any(Date));
  });
});

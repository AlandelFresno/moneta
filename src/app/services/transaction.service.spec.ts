import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TransactionService } from './transaction.service';
import { AccountService } from './account.service';
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

    const fresh = new TransactionService(new AccountService());
    const all = await firstValueFrom(fresh.getAll());
    expect(all.some((t) => t.name === 'Persistente')).toBeTrue();
  });

  it('restores Date objects for date/createdAt/updatedAt after reload from storage', async () => {
    await firstValueFrom(service.create(txnInput()));

    const fresh = new TransactionService(new AccountService());
    const all = await firstValueFrom(fresh.getAll());
    expect(all[0].date).toEqual(jasmine.any(Date));
    expect(all[0].createdAt).toEqual(jasmine.any(Date));
    expect(all[0].updatedAt).toEqual(jasmine.any(Date));
  });

  it('keeps a soft-deleted tombstone in storage after a subsequent create (regression)', async () => {
    const created = await firstValueFrom(service.create(txnInput()));
    await firstValueFrom(service.delete(created.id));

    await firstValueFrom(service.create(txnInput({ name: 'Otra compra' })));

    const raw = JSON.parse(localStorage.getItem('transactions')!);
    const tombstone = raw.find((t: { id: string }) => t.id === created.id);
    expect(tombstone).toBeTruthy();
    expect(tombstone.deletedAt).toBeTruthy();
  });

  it('exposes tombstones via getAllIncludingDeleted but not via getAll', async () => {
    const created = await firstValueFrom(service.create(txnInput()));
    await firstValueFrom(service.delete(created.id));

    const active = await firstValueFrom(service.getAll());
    expect(active.find((t) => t.id === created.id)).toBeUndefined();

    const all = service.getAllIncludingDeleted();
    const tombstone = all.find((t) => t.id === created.id);
    expect(tombstone?.deletedAt).toEqual(jasmine.any(Date));
  });

  it('replaceAll persists and emits exactly what is passed', async () => {
    const created = await firstValueFrom(service.create(txnInput()));
    const replacement: Transaction = { ...created, amount: 999 };

    service.replaceAll([replacement]);

    const all = await firstValueFrom(service.getAll());
    expect(all.length).toBe(1);
    expect(all[0].amount).toBe(999);

    const raw = JSON.parse(localStorage.getItem('transactions')!);
    expect(raw.length).toBe(1);
    expect(raw[0].amount).toBe(999);
  });

  describe('account balance sync', () => {
    let accountService: AccountService;

    beforeEach(() => {
      accountService = TestBed.inject(AccountService);
    });

    async function makeAccount(balance: number) {
      return firstValueFrom(accountService.create({ name: 'Efectivo', type: 'cash', balance, color: '#10b981', icon: 'wallet' }));
    }

    it('does not touch any account when accountId is absent', async () => {
      const account = await makeAccount(1000);
      await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 100 })));

      const all = await firstValueFrom(accountService.getAll());
      expect(all.find((a) => a.id === account.id)?.balance).toBe(1000);
    });

    it('debits an expense and credits an income on create', async () => {
      const account = await makeAccount(1000);
      await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 100, accountId: account.id })));

      let all = await firstValueFrom(accountService.getAll());
      expect(all.find((a) => a.id === account.id)?.balance).toBe(900);

      await firstValueFrom(service.create(txnInput({ type: 'income', amount: 50, accountId: account.id, categoryId: CATEGORY_B })));
      all = await firstValueFrom(accountService.getAll());
      expect(all.find((a) => a.id === account.id)?.balance).toBe(950);
    });

    it('reverses the old delta and applies the new one when amount changes', async () => {
      const account = await makeAccount(1000);
      const created = await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 100, accountId: account.id })));

      await firstValueFrom(service.update(created.id, { amount: 300 }));

      const all = await firstValueFrom(accountService.getAll());
      expect(all.find((a) => a.id === account.id)?.balance).toBe(700);
    });

    it('moves the balance effect when the account changes', async () => {
      const accountA = await makeAccount(1000);
      const accountB = await makeAccount(500);
      const created = await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 100, accountId: accountA.id })));

      await firstValueFrom(service.update(created.id, { accountId: accountB.id }));

      const all = await firstValueFrom(accountService.getAll());
      expect(all.find((a) => a.id === accountA.id)?.balance).toBe(1000);
      expect(all.find((a) => a.id === accountB.id)?.balance).toBe(400);
    });

    it('reverses the delta on delete', async () => {
      const account = await makeAccount(1000);
      const created = await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 100, accountId: account.id })));

      await firstValueFrom(service.delete(created.id));

      const all = await firstValueFrom(accountService.getAll());
      expect(all.find((a) => a.id === account.id)?.balance).toBe(1000);
    });
  });
});

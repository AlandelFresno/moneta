import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TransactionService, TransactionFormInput } from './transaction.service';
import { AccountService } from './account.service';
import { TransactionCalculationService } from './transaction-calculation.service';
import { Transaction } from '../core/types/transaction.types';

function freshTransactionService(): TransactionService {
  return new TransactionService(new AccountService(), new TransactionCalculationService());
}

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

    const fresh = freshTransactionService();
    const all = await firstValueFrom(fresh.getAll());
    expect(all.some((t) => t.name === 'Persistente')).toBeTrue();
  });

  it('restores Date objects for date/createdAt/updatedAt after reload from storage', async () => {
    await firstValueFrom(service.create(txnInput()));

    const fresh = freshTransactionService();
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

    it('deleteMany reverses balances for every selected transaction in one pass', async () => {
      const account = await makeAccount(1000);
      const a = await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 100, accountId: account.id })));
      const b = await firstValueFrom(service.create(txnInput({ type: 'income', amount: 50, accountId: account.id, categoryId: CATEGORY_B })));

      await firstValueFrom(service.deleteMany([a.id, b.id]));

      const all = await firstValueFrom(accountService.getAll());
      expect(all.find((acc) => acc.id === account.id)?.balance).toBe(1000);

      const remaining = await firstValueFrom(service.getAll());
      expect(remaining.length).toBe(0);
    });
  });

  describe('deleteMany', () => {
    it('soft-deletes every given id and leaves others untouched', async () => {
      const a = await firstValueFrom(service.create(txnInput()));
      const b = await firstValueFrom(service.create(txnInput()));
      const c = await firstValueFrom(service.create(txnInput()));

      await firstValueFrom(service.deleteMany([a.id, b.id]));

      const remaining = await firstValueFrom(service.getAll());
      expect(remaining.map((t) => t.id)).toEqual([c.id]);
    });
  });

  describe('updateCategoryMany', () => {
    it('recategorizes every given id without touching amount or type', async () => {
      const a = await firstValueFrom(service.create(txnInput({ categoryId: CATEGORY_A })));
      const b = await firstValueFrom(service.create(txnInput({ categoryId: CATEGORY_A })));
      const c = await firstValueFrom(service.create(txnInput({ categoryId: CATEGORY_A })));

      await firstValueFrom(service.updateCategoryMany([a.id, b.id], CATEGORY_B));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((t) => t.id === a.id)?.categoryId).toBe(CATEGORY_B);
      expect(all.find((t) => t.id === b.id)?.categoryId).toBe(CATEGORY_B);
      expect(all.find((t) => t.id === c.id)?.categoryId).toBe(CATEGORY_A);
    });

    it('does not adjust any account balance', async () => {
      const accountService = TestBed.inject(AccountService);
      const account = await firstValueFrom(accountService.create({ name: 'Efectivo', type: 'cash', balance: 1000, color: '#10b981', icon: 'wallet' }));
      const a = await firstValueFrom(service.create(txnInput({ type: 'expense', amount: 100, accountId: account.id })));

      await firstValueFrom(service.updateCategoryMany([a.id], CATEGORY_B));

      const all = await firstValueFrom(accountService.getAll());
      expect(all.find((acc) => acc.id === account.id)?.balance).toBe(900);
    });
  });

  describe('saveFromForm', () => {
    it('saves valid items and drops blank rows', async () => {
      const outcome = await service.saveFromForm(
        formInput({ items: [{ id: null, name: ' Seguro ', amount: 20 }, { id: null, name: '', amount: null }] }),
        1
      );
      expect(outcome.status).toBe('saved');
      const saved = service.getAllIncludingDeleted()[0];
      expect(saved.items?.map((i) => [i.name, i.amount])).toEqual([['Seguro', 20]]);
    });

    it('rejects a half-filled item', async () => {
      const outcome = await service.saveFromForm(formInput({ items: [{ id: null, name: 'Seguro', amount: null }] }), 1);
      expect(outcome.status).toBe('invalid');
    });

    function formInput(overrides: Partial<TransactionFormInput> = {}): TransactionFormInput {
      return {
        id: null,
        categoryId: CATEGORY_A,
        accountId: null,
        type: 'expense',
        name: 'Compra',
        description: '',
        amount: 100,
        date: new Date(2026, 0, 15),
        isSplit: false,
        splitGroupId: null,
        splitLines: [],
        calculatorExpression: null,
        isPeriodStart: false,
        items: [],
        nestedCounting: 'parent',
        children: [],
        ...overrides
      };
    }

    it('rejects a blank name before checking anything else', async () => {
      const outcome = await service.saveFromForm(formInput({ name: '', categoryId: '' }), 1);
      expect(outcome).toEqual({ status: 'invalid', detail: 'Ingresá un nombre' });
    });

    it('rejects a non-split save with no category or a non-positive amount', async () => {
      expect(await service.saveFromForm(formInput({ categoryId: '' }), 1)).toEqual({
        status: 'invalid',
        detail: 'Completá categoría, nombre y un monto válido'
      });
      expect(await service.saveFromForm(formInput({ amount: 0 }), 1)).toEqual({
        status: 'invalid',
        detail: 'Completá categoría, nombre y un monto válido'
      });
    });

    it('creates a new transaction and reports it as created', async () => {
      const outcome = await service.saveFromForm(formInput({ name: 'Super' }), 1);
      expect(outcome).toEqual({ status: 'saved', summary: 'Transacción creada', transactionId: jasmine.any(String) });

      const all = await firstValueFrom(service.getAll());
      expect(all.some((t) => t.name === 'Super' && t.amount === 100)).toBeTrue();
    });

    it('updates an existing transaction in place and reports it as updated', async () => {
      const created = await firstValueFrom(service.create(txnInput({ name: 'Original' })));

      const outcome = await service.saveFromForm(formInput({ id: created.id, name: 'Editado' }), 1);

      expect(outcome).toEqual({ status: 'saved', summary: 'Transacción actualizada', transactionId: created.id });
      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('Editado');
    });

    it('replaces the old split-group lines when a split transaction is edited back down to a single line', async () => {
      const groupId = 'g1';
      const lineA = await firstValueFrom(service.create(txnInput({ name: 'Línea A', splitGroupId: groupId })));
      await firstValueFrom(service.create(txnInput({ name: 'Línea B', splitGroupId: groupId })));

      await service.saveFromForm(formInput({ id: lineA.id, splitGroupId: groupId, name: 'Unificada', amount: 300 }), 1);

      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('Unificada');
      expect(all[0].amount).toBe(300);
    });

    it('persists the calculator expression alongside a new transaction', async () => {
      const transactionCalculationService = TestBed.inject(TransactionCalculationService);

      const outcome = await service.saveFromForm(formInput({ calculatorExpression: '50 + 50' }), 1);
      expect(outcome.status).toBe('saved');

      const all = await firstValueFrom(service.getAll());
      const created = all[0];
      const calculations = await firstValueFrom(transactionCalculationService.getAll());
      expect(calculations.some((c) => c.transactionId === created.id && c.expression === '50 + 50')).toBeTrue();
    });

    it('clears a conflicting period-start marker in the same nominal period when a new one is saved', async () => {
      const oldMarker = await firstValueFrom(
        service.create(txnInput({ type: 'income', isPeriodStart: true, date: new Date(2026, 0, 6, 9, 0) }))
      );

      await service.saveFromForm(
        formInput({ type: 'income', isPeriodStart: true, date: new Date(2026, 0, 20), name: 'Nuevo cobro' }),
        1
      );

      const all = await firstValueFrom(service.getAll());
      expect(all.find((t) => t.id === oldMarker.id)?.isPeriodStart).toBeFalse();
      expect(all.find((t) => t.name === 'Nuevo cobro')?.isPeriodStart).toBeTrue();
    });

    describe('split transactions', () => {
      function splitFormInput(overrides: Partial<TransactionFormInput> = {}): TransactionFormInput {
        return formInput({
          isSplit: true,
          categoryId: '',
          amount: null,
          splitLines: [
            { categoryId: CATEGORY_A, amount: 60 },
            { categoryId: CATEGORY_B, amount: 40 }
          ],
          ...overrides
        });
      }

      it('rejects a split with fewer than 2 valid lines', async () => {
        const outcome = await service.saveFromForm(
          splitFormInput({ splitLines: [{ categoryId: CATEGORY_A, amount: 100 }] }),
          1
        );
        expect(outcome).toEqual({ status: 'invalid', detail: 'Agregá al menos 2 líneas con categoría y monto' });
      });

      it('creates one transaction per valid line, sharing a new split group id', async () => {
        const outcome = await service.saveFromForm(splitFormInput(), 1);
        expect(outcome).toEqual({ status: 'saved', summary: 'Transacción dividida creada', transactionId: jasmine.any(String) });

        const all = await firstValueFrom(service.getAll());
        expect(all.length).toBe(2);
        expect(all[0].splitGroupId).toBeTruthy();
        expect(all[0].splitGroupId).toBe(all[1].splitGroupId);
      });

      it('replaces every existing line of the group when an existing split is edited', async () => {
        const groupId = 'existing-group';
        await firstValueFrom(service.create(txnInput({ name: 'Vieja A', splitGroupId: groupId })));
        await firstValueFrom(service.create(txnInput({ name: 'Vieja B', splitGroupId: groupId })));

        const outcome = await service.saveFromForm(splitFormInput({ splitGroupId: groupId }), 1);

        expect(outcome).toEqual({ status: 'saved', summary: 'Transacción actualizada', transactionId: groupId });
        const all = await firstValueFrom(service.getAll());
        expect(all.length).toBe(2);
        expect(all.some((t) => t.name === 'Vieja A')).toBeFalse();
      });
    });
  });
  describe('nested transactions', () => {
    async function accountWithBalance(balance: number) {
      const accountService = TestBed.inject(AccountService);
      const account = await firstValueFrom(accountService.create({ name: 'Efectivo', type: 'cash', balance, color: '#10b981', icon: 'wallet' }));
      return { accountService, account };
    }

    async function balanceOf(accountService: AccountService, id: string): Promise<number | undefined> {
      return (await firstValueFrom(accountService.getAll())).find((acc) => acc.id === id)?.balance;
    }

    const child = (overrides = {}) => ({
      id: null,
      categoryId: CATEGORY_B,
      name: 'Extra',
      description: 'detalle',
      amount: 30,
      effect: 'add' as const,
      date: new Date(2026, 0, 16),
      ...overrides
    });

    function form(overrides: Partial<TransactionFormInput> = {}): TransactionFormInput {
      return {
        id: null,
        categoryId: CATEGORY_A,
        accountId: null,
        type: 'expense',
        name: 'Compra',
        description: '',
        amount: 100,
        date: new Date(2026, 0, 15),
        isSplit: false,
        splitGroupId: null,
        splitLines: [],
        calculatorExpression: null,
        isPeriodStart: false,
        items: [],
        nestedCounting: 'parent',
        children: [],
        ...overrides
      };
    }

    it('keeps every child field and collapses the family into the parent at its net total when counting by parent', async () => {
      await service.saveFromForm(form({ children: [child({ amount: 30 }), child({ name: 'Descuento', amount: 10, effect: 'subtract' })] }), 1);

      const nested = await firstValueFrom(service.getAllNested());
      const saved = nested.find((t) => t.name === 'Extra');
      expect(nested.length).toBe(3);
      expect(saved?.description).toBe('detalle');
      expect(saved?.categoryId).toBe(CATEGORY_B);
      expect(saved?.parentEffect).toBe('add');

      const effective = await firstValueFrom(service.getAll());
      expect(effective.length).toBe(1);
      expect(effective[0].amount).toBe(120);
    });

    it('counts each child on its own, subtracting as a negative amount, when counting separately', async () => {
      await service.saveFromForm(
        form({ nestedCounting: 'separate', children: [child({ amount: 30 }), child({ name: 'Descuento', amount: 10, effect: 'subtract' })] }),
        1
      );

      const effective = await firstValueFrom(service.getAll());
      expect(effective.map((t) => t.amount).sort((a, b) => a - b)).toEqual([-10, 30, 100]);
    });

    it('adjusts the account balance by the net total and reverts it when the family is deleted', async () => {
      const { accountService, account } = await accountWithBalance(1000);

      const outcome = await service.saveFromForm(form({ accountId: account.id, children: [child({ amount: 50 })] }), 1);
      expect(await balanceOf(accountService, account.id)).toBe(850);

      if (outcome.status !== 'saved') throw new Error('expected saved');
      await firstValueFrom(service.delete(outcome.transactionId));

      expect(await balanceOf(accountService, account.id)).toBe(1000);
      expect((await firstValueFrom(service.getAllNested())).length).toBe(0);
    });

    it('rewrites the balance when the counting mode changes', async () => {
      const { accountService, account } = await accountWithBalance(1000);
      const first = await service.saveFromForm(form({ accountId: account.id, children: [child({ amount: 50, effect: 'subtract' })] }), 1);
      if (first.status !== 'saved') throw new Error('expected saved');
      expect(await balanceOf(accountService, account.id)).toBe(950);

      const children = (await firstValueFrom(service.getAllNested())).filter((t) => t.parentId).map((t) => child({ id: t.id, amount: t.amount, effect: 'subtract' as const }));
      await service.saveFromForm(form({ id: first.transactionId, accountId: account.id, nestedCounting: 'separate', children }), 1);

      expect(await balanceOf(accountService, account.id)).toBe(950);
    });

    it('removes children left out of the form on edit', async () => {
      const first = await service.saveFromForm(form({ children: [child()] }), 1);
      if (first.status !== 'saved') throw new Error('expected saved');

      await service.saveFromForm(form({ id: first.transactionId, children: [] }), 1);

      const nested = await firstValueFrom(service.getAllNested());
      expect(nested.length).toBe(1);
      expect(nested[0].nestedCounting).toBeUndefined();
    });

    it('rejects an incomplete child and a non-positive net total', async () => {
      expect((await service.saveFromForm(form({ children: [child({ categoryId: '' })] }), 1)).status).toBe('invalid');
      expect((await service.saveFromForm(form({ children: [child({ amount: 100, effect: 'subtract' })] }), 1)).status).toBe('invalid');
    });
  });
});

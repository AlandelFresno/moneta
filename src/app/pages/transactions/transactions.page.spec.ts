import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import type { Confirmation } from 'primeng/api';
import { firstValueFrom } from 'rxjs';

import { TransactionsPage } from './transactions.page';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { BillService, BillDueStatus } from '../../services/bill.service';
import { AccountService } from '../../services/account.service';
import { BudgetService } from '../../services/budget.service';
import { TransactionCalculationService } from '../../services/transaction-calculation.service';
import { CsvService } from '../../services/csv.service';

import { Category } from '../../core/types/category.types';
import { Account } from '../../core/types/account.types';
import { Transaction } from '../../core/types/transaction.types';
import { Bill } from '../../core/types/bill.types';

function activatedRouteStub(queryParams: Record<string, string> = {}): ActivatedRoute {
  return { snapshot: { queryParamMap: convertToParamMap(queryParams) } } as ActivatedRoute;
}

type ConfirmCallback = () => Promise<void> | void;

/** Simulates a `<p-confirmDialog>` resolving the pending confirmation raised by `action`. */
async function confirmDialog(
  confirmationService: ConfirmationService,
  action: () => void,
  resolution: 'accept' | 'reject'
): Promise<void> {
  const pending = firstValueFrom(confirmationService.requireConfirmation$);
  action();
  const confirmation = (await pending) as Confirmation;
  const callback = confirmation[resolution] as ConfirmCallback | undefined;
  await callback?.();
}

function csvFileEvent(content: string): Event {
  const file = new File([content], 'import.csv', { type: 'text/csv' });
  const fakeInput = { files: [file], value: '' };
  return { target: fakeInput } as unknown as Event;
}

function noFileEvent(): Event {
  const fakeInput = { files: [] as File[], value: '' };
  return { target: fakeInput } as unknown as Event;
}

interface Setup {
  component: TransactionsPage;
  transactionService: TransactionService;
  categoryService: CategoryService;
  billService: BillService;
  accountService: AccountService;
  budgetService: BudgetService;
  transactionCalculationService: TransactionCalculationService;
  csvService: CsvService;
  confirmationService: ConfirmationService;
  messageService: MessageService;
  incomeCategory: Category;
  expenseCategory: Category;
  account: Account;
}

async function setup(queryParams: Record<string, string> = {}): Promise<Setup> {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      ConfirmationService,
      MessageService,
      { provide: ActivatedRoute, useValue: activatedRouteStub(queryParams) }
    ]
  });

  const categoryService = TestBed.inject(CategoryService);
  categoryService.replaceAll([]);

  const incomeCategory = await firstValueFrom(categoryService.create({ name: 'Salario', type: 'income', color: '#0f0', icon: 'tag' }));
  const expenseCategory = await firstValueFrom(categoryService.create({ name: 'Almacén', type: 'expense', color: '#f00', icon: 'tag' }));

  const accountService = TestBed.inject(AccountService);
  const account = await firstValueFrom(
    accountService.create({ name: 'Efectivo', type: 'cash', balance: 1000, color: '#111827', icon: 'wallet' })
  );

  const transactionService = TestBed.inject(TransactionService);
  const billService = TestBed.inject(BillService);
  const budgetService = TestBed.inject(BudgetService);
  const transactionCalculationService = TestBed.inject(TransactionCalculationService);
  const csvService = TestBed.inject(CsvService);
  const confirmationService = TestBed.inject(ConfirmationService);
  const messageService = TestBed.inject(MessageService);

  const fixture = TestBed.createComponent(TransactionsPage);
  const component = fixture.componentInstance;
  component.ngOnInit();

  return {
    component,
    transactionService,
    categoryService,
    billService,
    accountService,
    budgetService,
    transactionCalculationService,
    csvService,
    confirmationService,
    messageService,
    incomeCategory,
    expenseCategory,
    account
  };
}

function createTxn(
  transactionService: TransactionService,
  overrides: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>> & { categoryId: string }
): Promise<Transaction> {
  return firstValueFrom(
    transactionService.create({
      type: 'expense',
      name: 'Compra',
      description: '',
      amount: 100,
      date: new Date(2026, 2, 10),
      ...overrides
    })
  );
}

describe('TransactionsPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  describe('loading and filtering', () => {
    it('loads transactions enriched with category info, newest first', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Vieja', date: new Date(2026, 0, 1) });
      await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Nueva', date: new Date(2026, 5, 1) });

      expect(component.transactions.length).toBe(2);
      expect(component.transactions[0].name).toBe('Nueva');
      expect(component.transactions[0].categoryName).toBe('Almacén');
    });

    it('filters by type', async () => {
      const { component, transactionService, incomeCategory, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: incomeCategory.id, type: 'income', name: 'Sueldo' });
      await createTxn(transactionService, { categoryId: expenseCategory.id, type: 'expense', name: 'Gasto' });

      component.filters.type = 'income';
      component.applyFilters();

      expect(component.filteredTransactions.length).toBe(1);
      expect(component.filteredTransactions[0].name).toBe('Sueldo');
    });

    it('filters by category, search text (name/description/category) and amount range, all combined', async () => {
      const { component, transactionService, expenseCategory, incomeCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Supermercado', description: 'compras del mes', amount: 500 });
      await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Otro', description: '', amount: 50 });
      await createTxn(transactionService, { categoryId: incomeCategory.id, type: 'income', name: 'Supermercado coincidencia', amount: 500 });

      component.filters.categoryId = expenseCategory.id;
      component.filters.searchText = 'super';
      component.filters.minAmount = 100;
      component.filters.maxAmount = 1000;
      component.applyFilters();

      expect(component.filteredTransactions.length).toBe(1);
      expect(component.filteredTransactions[0].name).toBe('Supermercado');
    });

    it('recomputes stats (income, expense, balance, count) from the filtered set only', async () => {
      const { component, transactionService, incomeCategory, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: incomeCategory.id, type: 'income', amount: 1000 });
      await createTxn(transactionService, { categoryId: expenseCategory.id, type: 'expense', amount: 300 });
      await createTxn(transactionService, { categoryId: expenseCategory.id, type: 'expense', amount: 200 });

      expect(component.stats.totalIncome).toBe(1000);
      expect(component.stats.totalExpense).toBe(500);
      expect(component.stats.balance).toBe(500);
      expect(component.stats.count).toBe(3);
    });

    it('clearFilters resets every filter field and re-applies', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 500 });
      component.filters = { type: 'income', categoryId: expenseCategory.id, searchText: 'x', minAmount: 1, maxAmount: 2 };
      component.applyFilters();
      expect(component.filteredTransactions.length).toBe(0);

      component.clearFilters();

      expect(component.filters).toEqual({ type: 'all', categoryId: 'all', searchText: '', minAmount: null, maxAmount: null });
      expect(component.filteredTransactions.length).toBe(1);
    });

    it('onSearchInput debounces before updating the search filter', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Alquiler' });

      component.onSearchInput('alquiler');
      expect(component.filters.searchText).toBe('');

      await new Promise((resolve) => setTimeout(resolve, 350));

      expect(component.filters.searchText).toBe('alquiler');
      expect(component.filteredTransactions.length).toBe(1);
    });

    it('drops a selected id from the selection once it no longer matches the active filters', async () => {
      const { component, transactionService, expenseCategory, incomeCategory } = await setup();
      const kept = await createTxn(transactionService, { categoryId: expenseCategory.id, type: 'expense' });
      const dropped = await createTxn(transactionService, { categoryId: incomeCategory.id, type: 'income' });
      component.selectedIds.add(kept.id);
      component.selectedIds.add(dropped.id);

      component.filters.type = 'expense';
      component.applyFilters();

      expect(component.selectedIds.has(kept.id)).toBeTrue();
      expect(component.selectedIds.has(dropped.id)).toBeFalse();
    });
  });

  describe('split-group listing', () => {
    it('collapses a shared splitGroupId into one grouped item with a combined total', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 60, splitGroupId: 'grp-1' });
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 40, splitGroupId: 'grp-1' });

      const items = component.groupedTransactions.flatMap((g) => g.items);
      expect(items.length).toBe(1);
      expect(items[0].isSplit).toBeTrue();
      expect(items[0].lines.length).toBe(2);
      expect(items[0].totalAmount).toBe(100);
    });

    it('isExpanded/toggleExpand tracks expand state per key', async () => {
      const { component } = await setup();
      expect(component.isExpanded('grp-1')).toBeFalse();
      component.toggleExpand('grp-1');
      expect(component.isExpanded('grp-1')).toBeTrue();
      component.toggleExpand('grp-1');
      expect(component.isExpanded('grp-1')).toBeFalse();
    });

    it('isGroupSelected/toggleSelectGroup selects and deselects every line of a split item together', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 60, splitGroupId: 'grp-1' });
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 40, splitGroupId: 'grp-1' });
      const item = component.groupedTransactions.flatMap((g) => g.items)[0];

      expect(component.isGroupSelected(item)).toBeFalse();
      component.toggleSelectGroup(item);
      expect(component.isGroupSelected(item)).toBeTrue();
      expect(item.lines.every((line) => component.isSelected(line.id))).toBeTrue();

      component.toggleSelectGroup(item);
      expect(component.isGroupSelected(item)).toBeFalse();
    });
  });

  describe('amount calculator', () => {
    it('toggleCalculator opens seeded with the current form amount and computes its preview', async () => {
      const { component } = await setup();
      component.form.amount = 150;

      component.toggleCalculator();

      expect(component.calculatorOpen).toBeTrue();
      expect(component.calculatorInput).toBe('150');
      expect(component.calculatorPreview).toBe(150);
    });

    it('onCalculatorInputChange evaluates a valid expression and clears any error', async () => {
      const { component } = await setup();
      component.calculatorInput = '10 + 5 * 2';
      component.onCalculatorInputChange();
      expect(component.calculatorPreview).toBe(20);
      expect(component.calculatorError).toBeNull();
    });

    it('onCalculatorInputChange surfaces an error and clears the preview on an invalid expression', async () => {
      const { component } = await setup();
      component.calculatorInput = '10 + ';
      component.onCalculatorInputChange();
      expect(component.calculatorPreview).toBeNull();
      expect(component.calculatorError).toBeTruthy();
    });

    it('onCalculatorInputChange clears both preview and error for blank input', async () => {
      const { component } = await setup();
      component.calculatorInput = '   ';
      component.onCalculatorInputChange();
      expect(component.calculatorPreview).toBeNull();
      expect(component.calculatorError).toBeNull();
    });

    it('applyCalculator rounds the preview to cents, stamps the expression and closes the calculator', async () => {
      const { component } = await setup();
      component.calculatorOpen = true;
      component.calculatorInput = '10 / 3';
      component.onCalculatorInputChange();

      component.applyCalculator();

      expect(component.form.amount).toBe(3.33);
      expect(component.form.calculatorExpression).toBe('10 / 3');
      expect(component.calculatorOpen).toBeFalse();
    });

    it('applyCalculator is a no-op while the preview is invalid', async () => {
      const { component } = await setup();
      component.form.amount = 42;
      component.calculatorPreview = null;

      component.applyCalculator();

      expect(component.form.amount).toBe(42);
    });

    it('onAmountManuallyChanged clears a previously stamped calculator expression', async () => {
      const { component } = await setup();
      component.form.calculatorExpression = '1+1';
      component.onAmountManuallyChanged();
      expect(component.form.calculatorExpression).toBeNull();
    });

    it('onSplitToggle seeds two split lines from the current category/amount when turning split on', async () => {
      const { component, expenseCategory } = await setup();
      component.form.categoryId = expenseCategory.id;
      component.form.amount = 100;
      component.form.isSplit = true;

      component.onSplitToggle();

      expect(component.form.splitLines.length).toBe(2);
      expect(component.form.splitLines[0]).toEqual({ categoryId: expenseCategory.id, amount: 100 });
      expect(component.form.splitLines[1]).toEqual({ categoryId: '', amount: null });
      expect(component.form.isPeriodStart).toBeFalse();
    });

    it('onSplitToggle collapses back to the split total when turning split off', async () => {
      const { component } = await setup();
      const noAmount: number | null = null;
      component.form.amount = noAmount;
      component.form.splitLines = [
        { categoryId: 'a', amount: 30 },
        { categoryId: 'b', amount: 70 }
      ];
      component.form.isSplit = false;

      component.onSplitToggle();

      expect(component.form.amount as unknown as number).toBe(100);
    });

    it('onSplitToggle restores the pre-split isPeriodStart value when split is turned back off', async () => {
      const { component } = await setup();
      component.form.isPeriodStart = true;
      component.form.isSplit = true;

      component.onSplitToggle();
      expect(component.form.isPeriodStart).toBeFalse();

      component.form.isSplit = false;
      component.onSplitToggle();

      expect(component.form.isPeriodStart).toBeTrue();
    });

    it('addSplitLine appends an empty line; removeSplitLine refuses to go below two lines', async () => {
      const { component } = await setup();
      component.form.splitLines = [
        { categoryId: 'a', amount: 10 },
        { categoryId: 'b', amount: 20 }
      ];

      component.addSplitLine();
      expect(component.form.splitLines.length).toBe(3);

      component.removeSplitLine(0);
      expect(component.form.splitLines.length).toBe(2);

      component.removeSplitLine(0);
      expect(component.form.splitLines.length).toBe(2);
    });

    it('opening the create dialog resets any leftover calculator state', async () => {
      const { component } = await setup();
      component.calculatorOpen = true;
      component.calculatorInput = '1+1';
      component.calculatorPreview = 2;
      component.calculatorError = 'x';

      component.openCreateDialog('expense');

      expect(component.calculatorOpen).toBeFalse();
      expect(component.calculatorInput).toBe('');
      expect(component.calculatorPreview).toBeNull();
      expect(component.calculatorError).toBeNull();
    });
  });

  describe('create/edit dialogs', () => {
    it('openCreateDialog seeds an empty form of the given type and opens the dialog', async () => {
      const { component } = await setup();
      component.openCreateDialog('income');
      expect(component.form.type).toBe('income');
      expect(component.form.id).toBeNull();
      expect(component.dialogVisible).toBeTrue();
    });

    it('openEditDialog populates the form from an existing single transaction', async () => {
      const { component, transactionService, expenseCategory, account } = await setup();
      const txn = await createTxn(transactionService, { categoryId: expenseCategory.id, accountId: account.id, name: 'Luz', amount: 77 });

      component.openEditDialog(txn);

      expect(component.form.id).toBe(txn.id);
      expect(component.form.name).toBe('Luz');
      expect(component.form.amount).toBe(77);
      expect(component.form.accountId).toBe(account.id);
      expect(component.dialogVisible).toBeTrue();
    });

    it('editItem opens the plain edit dialog for a non-split item', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Solo' });
      const item = component.groupedTransactions.flatMap((g) => g.items)[0];

      component.editItem(item);

      expect(component.form.id).toBe(item.primary.id);
      expect(component.form.isSplit).toBeFalse();
    });

    it('editItem populates the split-edit form from every line of a split item', async () => {
      const { component, transactionService, expenseCategory, incomeCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 60, splitGroupId: 'grp-1', name: 'Compra grande' });
      await createTxn(transactionService, { categoryId: incomeCategory.id, amount: 40, splitGroupId: 'grp-1', name: 'Compra grande' });
      const item = component.groupedTransactions.flatMap((g) => g.items)[0];

      component.editItem(item);

      expect(component.form.isSplit).toBeTrue();
      expect(component.form.id).toBeNull();
      expect(component.form.splitGroupId).toBe('grp-1');
      expect(component.form.splitLines.length).toBe(2);
      expect(component.form.splitLines.map((l) => l.amount).sort()).toEqual([40, 60]);
    });
  });

  describe('deleteItem / deleteTransaction', () => {
    it('deleteItem on a non-split item deletes just that transaction after confirmation', async () => {
      const { component, transactionService, confirmationService, expenseCategory } = await setup();
      const txn = await createTxn(transactionService, { categoryId: expenseCategory.id });
      const item = component.groupedTransactions.flatMap((g) => g.items)[0];

      await confirmDialog(confirmationService, () => component.deleteItem(item), 'accept');

      expect(component.transactions.find((t) => t.id === txn.id)).toBeUndefined();
    });

    it('deleteItem on a split item deletes every line together after one confirmation', async () => {
      const { component, transactionService, confirmationService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 60, splitGroupId: 'grp-1' });
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 40, splitGroupId: 'grp-1' });
      const item = component.groupedTransactions.flatMap((g) => g.items)[0];

      await confirmDialog(confirmationService, () => component.deleteItem(item), 'accept');

      expect(component.transactions.length).toBe(0);
    });

    it('deleteTransaction does nothing until the confirmation is accepted', async () => {
      const { component, transactionService, confirmationService, expenseCategory } = await setup();
      const txn = await createTxn(transactionService, { categoryId: expenseCategory.id });

      await confirmDialog(confirmationService, () => component.deleteTransaction(txn), 'reject');

      expect(component.transactions.find((t) => t.id === txn.id)).toBeTruthy();
    });

    it('deleteTransaction also removes its linked calculator record', async () => {
      const { component, transactionService, transactionCalculationService, confirmationService, expenseCategory } = await setup();
      const txn = await createTxn(transactionService, { categoryId: expenseCategory.id });
      await firstValueFrom(transactionCalculationService.create({ transactionId: txn.id, expression: '1+1', result: 2 }));

      await confirmDialog(confirmationService, () => component.deleteTransaction(txn), 'accept');

      const remaining = await firstValueFrom(transactionCalculationService.getForTransaction(txn.id));
      expect(remaining.length).toBe(0);
    });
  });

  describe('saveTransaction', () => {
    it('warns and does not persist when the name is missing', async () => {
      const { component, transactionService, messageService, expenseCategory } = await setup();
      spyOn(messageService, 'add');
      component.form = { ...component.form, name: '', categoryId: expenseCategory.id, amount: 10 };

      await component.saveTransaction();

      expect(messageService.add).toHaveBeenCalled();
      expect((await firstValueFrom(transactionService.getAll())).length).toBe(0);
    });

    it('warns on a non-split save missing category or a non-positive amount', async () => {
      const { component, messageService } = await setup();
      spyOn(messageService, 'add');
      component.form = { ...component.form, name: 'x', categoryId: '', amount: 10 };
      await component.saveTransaction();
      expect(messageService.add).toHaveBeenCalled();

      component.form = { ...component.form, name: 'x', categoryId: 'cat', amount: 0 };
      await component.saveTransaction();
      expect(messageService.add).toHaveBeenCalledTimes(2);
    });

    it('creates a new single transaction and closes the dialog', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      component.dialogVisible = true;
      component.form = { ...component.form, name: 'Compra', categoryId: expenseCategory.id, amount: 250, isSplit: false };

      await component.saveTransaction();

      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(1);
      expect(all[0].amount).toBe(250);
      expect(component.dialogVisible).toBeFalse();
    });

    it('updates an existing transaction in place', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      const txn = await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Original', amount: 10 });
      component.openEditDialog(txn);
      component.form.name = 'Editada';
      component.form.amount = 999;

      await component.saveTransaction();

      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('Editada');
      expect(all[0].amount).toBe(999);
    });

    it('persists a linked TransactionCalculation record when a calculator expression was applied', async () => {
      const { component, transactionCalculationService, expenseCategory } = await setup();
      component.form = { ...component.form, name: 'Con calculadora', categoryId: expenseCategory.id, amount: 30, calculatorExpression: '10*3' };

      await component.saveTransaction();

      const all = await firstValueFrom(transactionCalculationService.getAll());
      expect(all.length).toBe(1);
      expect(all[0].expression).toBe('10*3');
      expect(all[0].result).toBe(30);
    });

    it('marks the transaction as the period start and clears any other marker in the same period bucket', async () => {
      const { component, transactionService, incomeCategory } = await setup();
      const existingMarker = await createTxn(transactionService, {
        categoryId: incomeCategory.id,
        type: 'income',
        date: new Date(2026, 2, 5),
        isPeriodStart: true
      });

      component.form = {
        ...component.form,
        name: 'Nuevo sueldo',
        type: 'income',
        categoryId: incomeCategory.id,
        amount: 500,
        date: new Date(2026, 2, 20),
        isPeriodStart: true
      };
      await component.saveTransaction();

      const all = await firstValueFrom(transactionService.getAll());
      const oldMarker = all.find((t) => t.id === existingMarker.id)!;
      const newMarker = all.find((t) => t.name === 'Nuevo sueldo')!;
      expect(oldMarker.isPeriodStart).toBeFalse();
      expect(newMarker.isPeriodStart).toBeTrue();
    });

    it('deletes the old split group first when a previously-split transaction is saved as a single line', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 60, splitGroupId: 'grp-1', name: 'Dividida' });
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 40, splitGroupId: 'grp-1', name: 'Dividida' });
      const item = component.groupedTransactions.flatMap((g) => g.items)[0];
      component.editItem(item);

      component.form.isSplit = false;
      component.form.categoryId = expenseCategory.id;
      component.form.amount = 100;

      await component.saveTransaction();

      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(1);
      expect(all[0].splitGroupId).toBeUndefined();
      expect(all[0].amount).toBe(100);
    });

    it('saveSplitTransaction warns and persists nothing with fewer than two valid lines', async () => {
      const { component, transactionService, messageService, expenseCategory } = await setup();
      spyOn(messageService, 'add');
      component.form = {
        ...component.form,
        name: 'Dividida',
        isSplit: true,
        splitLines: [{ categoryId: expenseCategory.id, amount: 50 }, { categoryId: '', amount: null }]
      };

      await component.saveTransaction();

      expect(messageService.add).toHaveBeenCalled();
      expect((await firstValueFrom(transactionService.getAll())).length).toBe(0);
    });

    it('saveSplitTransaction creates one transaction per valid line sharing a new splitGroupId', async () => {
      const { component, transactionService, expenseCategory, incomeCategory } = await setup();
      component.form = {
        ...component.form,
        name: 'Dividida',
        isSplit: true,
        splitLines: [
          { categoryId: expenseCategory.id, amount: 60 },
          { categoryId: incomeCategory.id, amount: 40 }
        ]
      };

      await component.saveTransaction();

      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(2);
      expect(all[0].splitGroupId).toBeTruthy();
      expect(all[0].splitGroupId).toBe(all[1].splitGroupId);
    });

    it('saveSplitTransaction replaces the existing group in place when editing a split transaction', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 60, splitGroupId: 'grp-1', name: 'Vieja' });
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 40, splitGroupId: 'grp-1', name: 'Vieja' });
      const item = component.groupedTransactions.flatMap((g) => g.items)[0];
      component.editItem(item);
      component.form.splitLines = [
        { categoryId: expenseCategory.id, amount: 30 },
        { categoryId: expenseCategory.id, amount: 70 }
      ];

      await component.saveTransaction();

      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(2);
      expect(all.every((t) => t.splitGroupId === 'grp-1')).toBeTrue();
      expect(all.map((t) => t.amount).sort()).toEqual([30, 70]);
    });
  });

  describe('bulk selection and actions', () => {
    it('isSelected/toggleSelect toggles membership', async () => {
      const { component } = await setup();
      expect(component.isSelected('a')).toBeFalse();
      component.toggleSelect('a');
      expect(component.isSelected('a')).toBeTrue();
      component.toggleSelect('a');
      expect(component.isSelected('a')).toBeFalse();
    });

    it('toggleSelectAllVisible selects then deselects every currently-filtered transaction', async () => {
      const { component, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id });
      await createTxn(transactionService, { categoryId: expenseCategory.id });

      component.toggleSelectAllVisible();
      expect(component.allVisibleSelected).toBeTrue();
      expect(component.selectedIds.size).toBe(2);

      component.toggleSelectAllVisible();
      expect(component.selectedIds.size).toBe(0);
    });

    it('clearSelection empties the selection', async () => {
      const { component } = await setup();
      component.selectedIds.add('a');
      component.clearSelection();
      expect(component.selectedIds.size).toBe(0);
    });

    it('bulkDeleteSelected deletes every selected transaction and clears the selection after confirmation', async () => {
      const { component, transactionService, confirmationService, expenseCategory } = await setup();
      const a = await createTxn(transactionService, { categoryId: expenseCategory.id });
      const b = await createTxn(transactionService, { categoryId: expenseCategory.id });
      component.selectedIds.add(a.id);
      component.selectedIds.add(b.id);

      await confirmDialog(confirmationService, () => component.bulkDeleteSelected(), 'accept');

      expect((await firstValueFrom(transactionService.getAll())).length).toBe(0);
      expect(component.selectedIds.size).toBe(0);
    });

    it('openBulkRecategorizeDialog resets the chosen category and opens the dialog', async () => {
      const { component } = await setup();
      component.bulkRecategorizeCategoryId = 'stale';
      component.openBulkRecategorizeDialog();
      expect(component.bulkRecategorizeCategoryId).toBeNull();
      expect(component.bulkRecategorizeDialogVisible).toBeTrue();
    });

    it('saveBulkRecategorize warns when no category was chosen', async () => {
      const { component, messageService } = await setup();
      spyOn(messageService, 'add');
      component.bulkRecategorizeCategoryId = null;

      await component.saveBulkRecategorize();

      expect(messageService.add).toHaveBeenCalled();
    });

    it('saveBulkRecategorize recategorizes every selected transaction, clears selection and closes the dialog', async () => {
      const { component, transactionService, expenseCategory, incomeCategory } = await setup();
      const a = await createTxn(transactionService, { categoryId: expenseCategory.id });
      const b = await createTxn(transactionService, { categoryId: expenseCategory.id });
      component.selectedIds.add(a.id);
      component.selectedIds.add(b.id);
      component.bulkRecategorizeDialogVisible = true;
      component.bulkRecategorizeCategoryId = incomeCategory.id;

      await component.saveBulkRecategorize();

      const all = await firstValueFrom(transactionService.getAll());
      expect(all.every((t) => t.categoryId === incomeCategory.id)).toBeTrue();
      expect(component.selectedIds.size).toBe(0);
      expect(component.bulkRecategorizeDialogVisible).toBeFalse();
    });
  });

  describe('quick category creation', () => {
    it('categoriesForType filters categories by type', async () => {
      const { component, expenseCategory, incomeCategory } = await setup();
      expect(component.categoriesForType('expense')).toEqual([expenseCategory]);
      expect(component.categoriesForType('income')).toEqual([incomeCategory]);
    });

    it('openCreateCategoryDialog resets the quick-category form and opens it', async () => {
      const { component } = await setup();
      component.categoryForm.name = 'stale';
      component.openCreateCategoryDialog();
      expect(component.categoryForm.name).toBe('');
      expect(component.categoryDialogVisible).toBeTrue();
    });

    it('saveQuickCategory warns when the name is blank', async () => {
      const { component, messageService } = await setup();
      spyOn(messageService, 'add');
      component.categoryForm.name = '   ';

      await component.saveQuickCategory();

      expect(messageService.add).toHaveBeenCalled();
    });

    it('saveQuickCategory creates the category, assigns it to the form and closes the dialog', async () => {
      const { component, categoryService } = await setup();
      component.form.type = 'expense';
      component.categoryForm = { name: 'Mascotas', color: '#abcdef', icon: 'paw' };
      component.categoryDialogVisible = true;

      await component.saveQuickCategory();

      const all = await firstValueFrom(categoryService.getAll());
      const created = all.find((c) => c.name === 'Mascotas')!;
      expect(created).toBeTruthy();
      expect(component.form.categoryId).toBe(created.id);
      expect(component.categoryDialogVisible).toBeFalse();
    });
  });

  describe('CSV export', () => {
    it('exportToCsv delegates to CsvService with the filtered transactions, categories and bills', async () => {
      const { component, csvService, transactionService, expenseCategory } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id });
      spyOn(csvService, 'exportToCsv');

      component.exportToCsv();

      expect(csvService.exportToCsv).toHaveBeenCalledWith(component.filteredTransactions, component.categories, component.bills);
    });
  });

  describe('CSV import', () => {
    it('does nothing when no file was chosen', async () => {
      const { component, transactionService } = await setup();
      await component.onCsvFileSelected(noFileEvent());
      expect((await firstValueFrom(transactionService.getAll())).length).toBe(0);
    });

    it('shows an error message when the file cannot be read as CSV sections', async () => {
      const { component, csvService, messageService } = await setup();
      spyOn(csvService, 'readCsvSections').and.rejectWith(new Error('boom'));
      spyOn(messageService, 'add');

      await component.onCsvFileSelected(csvFileEvent('irrelevant'));

      expect(messageService.add).toHaveBeenCalled();
    });

    it('imports new categories, bills and transactions found in the CSV, reporting a summary', async () => {
      const { component, transactionService, categoryService, billService, messageService } = await setup();
      spyOn(messageService, 'add');
      const csv = [
        'Name,Type,Color,Icon',
        'Mascotas,expense,#ffffff,paw',
        '',
        'Name,Description,Category,ApproxAmount,Period,DueDate,Active',
        'Internet,Fibra,Mascotas,1000,monthly,2026-01-05,true',
        '',
        'Date,Type,Category,Name,Amount,Description',
        '2026-03-01,expense,Mascotas,Comida gato,500,'
      ].join('\n');

      await component.onCsvFileSelected(csvFileEvent(csv));

      const categories = await firstValueFrom(categoryService.getAll());
      expect(categories.some((c) => c.name === 'Mascotas')).toBeTrue();
      const bills = await firstValueFrom(billService.getAll());
      expect(bills.some((b) => b.name === 'Internet')).toBeTrue();
      const transactions = await firstValueFrom(transactionService.getAll());
      expect(transactions.some((t) => t.name === 'Comida gato' && t.amount === 500)).toBeTrue();
      expect(messageService.add).toHaveBeenCalled();
    });

    it('warns "nothing to import" when the file has no valid rows and creates nothing else', async () => {
      const { component, messageService } = await setup();
      spyOn(messageService, 'add');
      const csv = ['Date,Type,Category,Name,Amount,Description', ''].join('\n');

      await component.onCsvFileSelected(csvFileEvent(csv));

      expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
    });

    it('asks for confirmation when duplicates are found, and imports only the new rows on accept', async () => {
      const { component, transactionService, expenseCategory, confirmationService } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Ya existe', amount: 100, date: new Date(2026, 2, 1) });
      const csv = [
        'Date,Type,Category,Name,Amount,Description',
        '2026-03-01,expense,Almacén,Ya existe,100,',
        '2026-03-02,expense,Almacén,Nueva,200,'
      ].join('\n');

      const pending = firstValueFrom(confirmationService.requireConfirmation$);
      await component.onCsvFileSelected(csvFileEvent(csv));
      const confirmation = (await pending) as Confirmation;
      await (confirmation.accept as ConfirmCallback)?.();

      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(2);
      expect(all.some((t) => t.name === 'Nueva')).toBeTrue();
    });

    it('imports every row, duplicates included, when the user rejects the "only new" offer', async () => {
      const { component, transactionService, expenseCategory, confirmationService } = await setup();
      await createTxn(transactionService, { categoryId: expenseCategory.id, name: 'Ya existe', amount: 100, date: new Date(2026, 2, 1) });
      const csv = [
        'Date,Type,Category,Name,Amount,Description',
        '2026-03-01,expense,Almacén,Ya existe,100,',
        '2026-03-02,expense,Almacén,Nueva,200,'
      ].join('\n');

      const pending = firstValueFrom(confirmationService.requireConfirmation$);
      await component.onCsvFileSelected(csvFileEvent(csv));
      const confirmation = (await pending) as Confirmation;
      await (confirmation.reject as ConfirmCallback)?.();

      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(3);
    });
  });

  describe('bill payment', () => {
    function makeStatus(bill: Bill): BillDueStatus {
      return { bill, periodDueDate: bill.dueDate, isOverdue: false };
    }

    it('openPayBillDialog seeds the pay amount from the bill and opens the dialog', async () => {
      const { component, billService, expenseCategory } = await setup();
      const bill = await firstValueFrom(
        billService.create({
          name: 'Luz', description: '', categoryId: expenseCategory.id, approxAmount: 150, period: 'monthly', dueDate: new Date(2026, 2, 5), active: true
        })
      );

      component.openPayBillDialog(makeStatus(bill));

      expect(component.payAmount).toBe(150);
      expect(component.payDialogVisible).toBeTrue();
      expect(component.payingBill?.bill.id).toBe(bill.id);
    });

    it('confirmBillPayment warns on a missing/invalid amount and does not create anything', async () => {
      const { component, messageService, billService, expenseCategory } = await setup();
      spyOn(messageService, 'add');
      const bill = await firstValueFrom(
        billService.create({
          name: 'Luz', description: '', categoryId: expenseCategory.id, approxAmount: 150, period: 'monthly', dueDate: new Date(2026, 2, 5), active: true
        })
      );
      component.openPayBillDialog(makeStatus(bill));
      component.payAmount = 0;

      await component.confirmBillPayment();

      expect(messageService.add).toHaveBeenCalled();
    });

    it('confirmBillPayment creates the expense transaction and records the payment on the bill', async () => {
      const { component, transactionService, billService, expenseCategory } = await setup();
      const bill = await firstValueFrom(
        billService.create({
          name: 'Luz', description: '', categoryId: expenseCategory.id, approxAmount: 150, period: 'monthly', dueDate: new Date(2026, 2, 5), active: true
        })
      );
      component.openPayBillDialog(makeStatus(bill));

      await component.confirmBillPayment();

      const transactions = await firstValueFrom(transactionService.getAll());
      expect(transactions.some((t) => t.name === 'Luz' && t.amount === 150)).toBeTrue();
      const bills = await firstValueFrom(billService.getAll());
      expect(bills.find((b) => b.id === bill.id)?.payments.length).toBe(1);
      expect(component.payDialogVisible).toBeFalse();
      expect(component.payingBill).toBeNull();
    });
  });

  describe('budget progress', () => {
    it('recomputes budgetProgress from the active budget and this month\'s transactions', async () => {
      const { component, budgetService, transactionService, expenseCategory } = await setup();
      await firstValueFrom(budgetService.save(new Date(), 1000, [{ categoryId: expenseCategory.id, amount: 400 }]));
      await createTxn(transactionService, { categoryId: expenseCategory.id, amount: 100, date: new Date() });

      component.onPeriodSettingsChange();

      expect(component.budgetProgress?.totalAllocated).toBe(400);
      expect(component.budgetProgress?.totalSpent).toBeGreaterThanOrEqual(100);
    });

    it('leaves budgetProgress null when there is no active budget', async () => {
      const { component } = await setup();
      expect(component.activeBudget).toBeNull();
      expect(component.budgetProgress).toBeNull();
    });
  });

  describe('formatDate', () => {
    it('formats a date in es-AR day/short-month/year style', async () => {
      const { component } = await setup();
      const formatted = component.formatDate(new Date(2026, 2, 15));
      expect(formatted).toContain('2026');
      expect(formatted).toMatch(/15/);
    });
  });

  describe('query param auto-open', () => {
    it('opens the create dialog for the type given in the ?type= query param', async () => {
      const { component } = await setup({ type: 'income' });
      expect(component.dialogVisible).toBeTrue();
      expect(component.form.type).toBe('income');
    });
  });
});

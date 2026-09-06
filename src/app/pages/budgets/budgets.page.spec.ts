import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService, MessageService, Confirmation } from 'primeng/api';

import { BudgetsPage } from './budgets.page';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { GoalService } from '../../services/goal.service';
import { AccountService } from '../../services/account.service';
import { PeriodSettingsService } from '../../services/period-settings.service';
import { Category } from '../../core/types/category.types';
import { Account, AccountType } from '../../core/types/account.types';
import { Goal } from '../../core/types/goal.types';
import { Transaction } from '../../core/types/transaction.types';
import { periodLabelMonth, addMonths } from '../../core/utils/period.util';

function categoryPayload(overrides: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Category, 'id' | 'createdAt' | 'updatedAt'> {
  return { name: 'Almacén', type: 'expense', color: '#f00', icon: 'tag', ...overrides };
}

function accountPayload(overrides: Partial<Omit<Account, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Account, 'id' | 'createdAt' | 'updatedAt'> {
  return { name: 'Efectivo', type: 'cash' as AccountType, balance: 1000, color: '#10b981', icon: 'wallet', ...overrides };
}

function goalPayload(overrides: Partial<Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  return { name: 'Viaje', targetAmount: 1000, currentAmount: 0, color: '#0f0', icon: 'plane', ...overrides };
}

function txnPayload(overrides: Partial<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> {
  return { categoryId: 'cat-1', type: 'expense', name: 'Compra', description: '', amount: 100, date: new Date(), ...overrides };
}

describe('BudgetsPage', () => {
  let fixture: ComponentFixture<BudgetsPage>;
  let component: BudgetsPage;
  let budgetService: BudgetService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;
  let goalService: GoalService;
  let accountService: AccountService;
  let periodSettingsService: PeriodSettingsService;
  let confirmationService: ConfirmationService;
  let messageService: MessageService;

  const now = new Date();
  const currentMonth = periodLabelMonth(now, 1);
  const nextMonth = addMonths(currentMonth, 1);
  const lastMonth = addMonths(currentMonth, -1);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), ConfirmationService, MessageService] });
    budgetService = TestBed.inject(BudgetService);
    categoryService = TestBed.inject(CategoryService);
    categoryService.replaceAll([]); // CategoryService seeds 2 default categories on empty storage — start each test from a clean slate
    transactionService = TestBed.inject(TransactionService);
    goalService = TestBed.inject(GoalService);
    accountService = TestBed.inject(AccountService);
    periodSettingsService = TestBed.inject(PeriodSettingsService);
    confirmationService = TestBed.inject(ConfirmationService);
    messageService = TestBed.inject(MessageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(BudgetsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function acceptNextConfirm(): { done: Promise<void> } {
    const holder: { done: Promise<void> } = { done: Promise.resolve() };
    spyOn(confirmationService, 'confirm').and.callFake((config: Confirmation) => {
      holder.done = Promise.resolve(config.accept?.());
      return confirmationService;
    });
    return holder;
  }

  describe('ngOnInit / onPeriodSettingsChange', () => {
    it('loads categories, goals, accounts and computes current/upcoming/history budgets and progress', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));
      await firstValueFrom(budgetService.save(currentMonth, 500, [{ categoryId: cat.id, amount: 500 }]));
      await firstValueFrom(transactionService.create(txnPayload({ categoryId: cat.id, amount: 200, date: now })));

      createComponent();

      expect(component.categories.length).toBe(1);
      expect(component.current?.totalAmount).toBe(500);
      expect(component.progress?.totalAllocated).toBe(500);
      expect(component.progress?.totalSpent).toBe(200);
      expect(component.progress?.categories[0].spent).toBe(200);
    });

    it('has no current budget and null progress when nothing was saved for this month', () => {
      createComponent();
      expect(component.current).toBeNull();
      expect(component.progress).toBeNull();
    });

    it('onPeriodSettingsChange re-reads the period start hour and shifts currentPeriodRange accordingly', async () => {
      await firstValueFrom(budgetService.save(currentMonth, 500, []));
      createComponent();
      const budgetBefore = component.current;

      periodSettingsService.setStartHour(9);
      component.onPeriodSettingsChange();

      expect(component.periodStartHour).toBe(9);
      expect(component.currentPeriodRange?.start.getHours()).toBe(9);
      // Only the hour boundary changed — startDay (and so the budget month label) is untouched.
      expect(component.current?.id).toBe(budgetBefore?.id);
    });
  });

  describe('openPlanNextMonthDialog / openEditCurrentDialog', () => {
    it('opens the form for next month from scratch when there is no upcoming budget yet', () => {
      createComponent();
      component.openPlanNextMonthDialog();

      expect(component.dialogVisible).toBeTrue();
      expect(component.targetMonth.getTime()).toBe(nextMonth.getTime());
      expect(component.totalAmount).toBeNull();
    });

    it('opens the form pre-filled with the existing upcoming budget when there is one', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));
      await firstValueFrom(budgetService.save(nextMonth, 800, [{ categoryId: cat.id, amount: 800 }]));
      createComponent();

      component.openPlanNextMonthDialog();

      expect(component.targetMonth.getTime()).toBe(nextMonth.getTime());
      expect(component.totalAmount).toBe(800);
      expect(component.rows.find((row) => row.categoryId === cat.id)?.included).toBeTrue();
    });

    it('openEditCurrentDialog does nothing when there is no current budget', () => {
      createComponent();
      component.openEditCurrentDialog();
      expect(component.dialogVisible).toBeFalse();
    });

    it('openEditCurrentDialog opens the form pre-filled with the current budget', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));
      await firstValueFrom(budgetService.save(currentMonth, 300, [{ categoryId: cat.id, amount: 300 }]));
      createComponent();

      component.openEditCurrentDialog();

      expect(component.dialogVisible).toBeTrue();
      expect(component.targetMonth.getTime()).toBe(currentMonth.getTime());
      expect(component.totalAmount).toBe(300);
    });
  });

  describe('cancelUpcoming / deactivateCurrent', () => {
    it('cancelUpcoming does nothing when there is no upcoming budget (no confirmation asked)', () => {
      createComponent();
      const confirmSpy = spyOn(confirmationService, 'confirm');
      component.cancelUpcoming();
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('cancelUpcoming deletes the upcoming budget once the user confirms', async () => {
      const upcoming = await firstValueFrom(budgetService.save(nextMonth, 500, []));
      createComponent();
      const confirmed = acceptNextConfirm();

      component.cancelUpcoming();
      await confirmed.done;

      const all = await firstValueFrom(budgetService.getAll());
      expect(all.find((b) => b.id === upcoming.id)).toBeUndefined();
    });

    it('deactivateCurrent does nothing when there is no current budget (no confirmation asked)', () => {
      createComponent();
      const confirmSpy = spyOn(confirmationService, 'confirm');
      component.deactivateCurrent();
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('deactivateCurrent soft-deletes the current budget once the user confirms', async () => {
      const current = await firstValueFrom(budgetService.save(currentMonth, 500, []));
      createComponent();
      const confirmed = acceptNextConfirm();

      component.deactivateCurrent();
      await confirmed.done;

      const all = await firstValueFrom(budgetService.getAll());
      expect(all.find((b) => b.id === current.id)).toBeUndefined();
    });
  });

  describe('autoFillSelected', () => {
    it('fills only the included rows using the selected suggest method, and syncs totalAmount to the new sum', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));
      const other = await firstValueFrom(categoryService.create(categoryPayload({ name: 'Ocio' })));
      await firstValueFrom(transactionService.create(txnPayload({ categoryId: cat.id, amount: 300, date: lastMonth })));
      createComponent();

      component.openPlanNextMonthDialog();
      component.suggestMethod = 'avg3';
      const row = component.rows.find((r) => r.categoryId === cat.id)!;
      const otherRow = component.rows.find((r) => r.categoryId === other.id)!;
      row.included = true;
      otherRow.included = false;

      component.autoFillSelected();

      expect(row.amount).toBe(100); // 300 spent once across a 3-month average
      expect(otherRow.amount).toBeNull();
      expect(component.totalAmount).toBe(100);
    });
  });

  describe('saveBudget', () => {
    beforeEach(() => {
      createComponent();
    });

    it('warns and does not save when totalAmount is missing', async () => {
      component.openPlanNextMonthDialog();
      component.totalAmount = null;
      const addSpy = spyOn(messageService, 'add');

      await component.saveBudget();

      expect(addSpy).toHaveBeenCalled();
      expect(component.dialogVisible).toBeTrue();
      expect((await firstValueFrom(budgetService.getAll())).length).toBe(0);
    });

    it('warns and does not save when totalAmount is zero or negative', async () => {
      component.openPlanNextMonthDialog();
      component.totalAmount = 0;

      await component.saveBudget();

      expect((await firstValueFrom(budgetService.getAll())).length).toBe(0);
    });

    it('warns and does not save when an included category row has no valid amount', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));

      component.openPlanNextMonthDialog();
      component.totalAmount = 500;
      const row = component.rows.find((r) => r.categoryId === cat.id)!;
      row.included = true;
      row.amount = null;

      await component.saveBudget();

      expect((await firstValueFrom(budgetService.getAll())).length).toBe(0);
    });

    it('warns and does not save when an included goal row is missing an account or a valid amount', async () => {
      await firstValueFrom(goalService.create(goalPayload()));

      component.openPlanNextMonthDialog();
      component.totalAmount = 500;
      component.goalRows[0].included = true;
      component.goalRows[0].amount = 200;
      component.goalRows[0].accountId = null;

      await component.saveBudget();

      expect((await firstValueFrom(budgetService.getAll())).length).toBe(0);
    });

    it('warns and does not save when allocations sum exceeds the total amount', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));

      component.openPlanNextMonthDialog();
      component.totalAmount = 100;
      const row = component.rows.find((r) => r.categoryId === cat.id)!;
      row.included = true;
      row.amount = 150;

      await component.saveBudget();

      expect((await firstValueFrom(budgetService.getAll())).length).toBe(0);
    });

    it('creates a new budget with the selected category and goal allocations, and closes the dialog', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));
      const account = await firstValueFrom(accountService.create(accountPayload()));
      const goal = await firstValueFrom(goalService.create(goalPayload()));

      component.openPlanNextMonthDialog();
      component.totalAmount = 700;
      const row = component.rows.find((r) => r.categoryId === cat.id)!;
      row.included = true;
      row.amount = 500;
      component.goalRows[0].included = true;
      component.goalRows[0].amount = 200;
      component.goalRows[0].accountId = account.id;

      await component.saveBudget();

      const all = await firstValueFrom(budgetService.getAll());
      expect(all.length).toBe(1);
      expect(all[0].totalAmount).toBe(700);
      expect(all[0].allocations).toEqual([{ categoryId: cat.id, amount: 500 }]);
      expect(all[0].goalAllocations).toEqual([{ goalId: goal.id, accountId: account.id, amount: 200 }]);
      expect(component.dialogVisible).toBeFalse();
    });

    it('updates the existing budget for that month instead of creating a duplicate', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));

      component.openPlanNextMonthDialog();
      component.totalAmount = 400;
      await component.saveBudget();

      component.openPlanNextMonthDialog();
      component.totalAmount = 900;
      const row = component.rows.find((r) => r.categoryId === cat.id)!;
      row.included = true;
      row.amount = 900;
      await component.saveBudget();

      const all = await firstValueFrom(budgetService.getAll());
      expect(all.length).toBe(1);
      expect(all[0].totalAmount).toBe(900);
    });
  });

  describe('formatMonthLabel / formatDate', () => {
    beforeEach(() => createComponent());

    it('capitalizes the localized month/year label', () => {
      const label = component.formatMonthLabel(new Date(2026, 7, 1));
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
      expect(label.toLowerCase()).toContain('agosto');
      expect(label).toContain('2026');
    });

    it('omits the time when the date is exactly midnight', () => {
      const formatted = component.formatDate(new Date(2026, 7, 6, 0, 0));
      expect(formatted).not.toMatch(/\d{2}:\d{2}/);
    });

    it('includes HH:mm when the date carries a specific time', () => {
      const formatted = component.formatDate(new Date(2026, 7, 6, 14, 32));
      expect(formatted).toContain('14:32');
    });
  });

  describe('form-row building (openFormDialog / buildRows / buildGoalRows / buildTargetMonthOptions)', () => {
    it('builds a row for every expense category (never income), sorted by historical spend descending', async () => {
      const cheap = await firstValueFrom(categoryService.create(categoryPayload({ name: 'Poco gasto' })));
      const pricey = await firstValueFrom(categoryService.create(categoryPayload({ name: 'Mucho gasto' })));
      await firstValueFrom(categoryService.create(categoryPayload({ name: 'Sueldo', type: 'income' })));
      await firstValueFrom(transactionService.create(txnPayload({ categoryId: cheap.id, amount: 50 })));
      await firstValueFrom(transactionService.create(txnPayload({ categoryId: pricey.id, amount: 900 })));
      createComponent();

      component.openPlanNextMonthDialog();

      expect(component.rows.length).toBe(2);
      expect(component.rows[0].categoryId).toBe(pricey.id);
      expect(component.rows[1].categoryId).toBe(cheap.id);
    });

    it('pre-checks and pre-fills rows from an existing budget allocation when editing', async () => {
      const cat = await firstValueFrom(categoryService.create(categoryPayload()));
      await firstValueFrom(budgetService.save(currentMonth, 300, [{ categoryId: cat.id, amount: 300 }]));
      createComponent();

      component.openEditCurrentDialog();

      const row = component.rows.find((r) => r.categoryId === cat.id)!;
      expect(row.included).toBeTrue();
      expect(row.amount).toBe(300);
    });

    it('builds one goal row per goal, pre-checked and pre-filled from an existing goal allocation', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload()));
      const account = await firstValueFrom(accountService.create(accountPayload()));
      await firstValueFrom(budgetService.save(currentMonth, 300, [], [{ goalId: goal.id, accountId: account.id, amount: 150 }]));
      createComponent();

      component.openEditCurrentDialog();

      expect(component.goalRows.length).toBe(1);
      expect(component.goalRows[0].included).toBeTrue();
      expect(component.goalRows[0].amount).toBe(150);
      expect(component.goalRows[0].accountId).toBe(account.id);
    });

    it('offers this month and next month as target month options', () => {
      createComponent();
      component.openPlanNextMonthDialog();

      expect(component.targetMonthOptions.length).toBe(2);
      expect(component.targetMonthOptions.map((opt) => opt.value.getTime())).toEqual([currentMonth.getTime(), nextMonth.getTime()]);
    });

    it('visibleRows keeps included rows regardless of the historical-spend filter, and drops unchecked ones below it', async () => {
      const included = await firstValueFrom(categoryService.create(categoryPayload({ name: 'Chica pero elegida' })));
      const excluded = await firstValueFrom(categoryService.create(categoryPayload({ name: 'Chica no elegida' })));
      createComponent();
      component.openPlanNextMonthDialog();

      component.minSpendFilter = 1000;
      const includedRow = component.rows.find((r) => r.categoryId === included.id)!;
      includedRow.included = true;

      const visibleIds = component.visibleRows.map((r) => r.categoryId);
      expect(visibleIds).toContain(included.id);
      expect(visibleIds).not.toContain(excluded.id);
    });
  });

  describe('rollover flow', () => {
    it('rolloverSummary names existing goal/account, and falls back to a placeholder once they are deleted', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload({ name: 'Auto' })));
      const account = await firstValueFrom(accountService.create(accountPayload({ name: 'Banco' })));
      await firstValueFrom(
        budgetService.save(lastMonth, 300, [], [{ goalId: goal.id, accountId: account.id, amount: 150 }])
      );
      createComponent();

      expect(component.pendingRollovers.length).toBe(1);
      const summaryBefore = component.rolloverSummary(component.pendingRollovers[0]);
      expect(summaryBefore).toContain('Auto');
      expect(summaryBefore).toContain('Banco');

      await firstValueFrom(goalService.delete(goal.id));
      await firstValueFrom(accountService.delete(account.id));
      component.onPeriodSettingsChange();
      // goals/accounts are cached from ngOnInit's last emission; re-fetch to reflect the deletions.
      component.goals = await firstValueFrom(goalService.getAll());
      component.accounts = await firstValueFrom(accountService.getAll());

      const summaryAfter = component.rolloverSummary(component.pendingRollovers[0]);
      expect(summaryAfter).toContain('Meta eliminada');
      expect(summaryAfter).toContain('Cuenta eliminada');
    });

    it('openRolloverDialog defaults to "saved" and pre-fills the source account when it still exists', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload()));
      const account = await firstValueFrom(accountService.create(accountPayload()));
      await firstValueFrom(budgetService.save(lastMonth, 300, [], [{ goalId: goal.id, accountId: account.id, amount: 150 }]));
      createComponent();

      component.openRolloverDialog(component.pendingRollovers[0]);

      expect(component.rolloverDialogVisible).toBeTrue();
      expect(component.rolloverForm.action).toBe('saved');
      expect(component.rolloverForm.sourceAccountId).toBe(account.id);
    });

    it('openRolloverDialog leaves the source blank when the original account no longer exists', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload()));
      const account = await firstValueFrom(accountService.create(accountPayload()));
      await firstValueFrom(budgetService.save(lastMonth, 300, [], [{ goalId: goal.id, accountId: account.id, amount: 150 }]));
      await firstValueFrom(accountService.delete(account.id));
      createComponent();
      component.accounts = await firstValueFrom(accountService.getAll());

      component.openRolloverDialog(component.pendingRollovers[0]);

      expect(component.rolloverForm.sourceAccountId).toBeNull();
    });

    it('"kept": marks the rollover resolved without moving any money', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload()));
      const account = await firstValueFrom(accountService.create(accountPayload({ balance: 1000 })));
      const budget = await firstValueFrom(budgetService.save(lastMonth, 300, [], [{ goalId: goal.id, accountId: account.id, amount: 150 }]));
      createComponent();
      component.openRolloverDialog(component.pendingRollovers[0]);
      component.rolloverForm = { action: 'kept', sourceAccountId: null, destinationAccountId: null };

      await component.saveRolloverResolution();

      const accounts = await firstValueFrom(accountService.getAll());
      expect(accounts.find((a) => a.id === account.id)?.balance).toBe(1000);
      const budgets = await firstValueFrom(budgetService.getAll());
      const resolved = budgets.find((b) => b.id === budget.id)!.goalAllocations[0];
      expect(resolved.resolution).toBe('kept');
      expect(resolved.resolvedAccountId).toBe(account.id);
      expect(component.rolloverDialogVisible).toBeFalse();
    });

    it('"transferred": warns and does nothing without a distinct destination account', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload()));
      const account = await firstValueFrom(accountService.create(accountPayload()));
      await firstValueFrom(budgetService.save(lastMonth, 300, [], [{ goalId: goal.id, accountId: account.id, amount: 150 }]));
      createComponent();
      component.openRolloverDialog(component.pendingRollovers[0]);
      component.rolloverForm = { action: 'transferred', sourceAccountId: account.id, destinationAccountId: account.id };

      await component.saveRolloverResolution();

      expect(component.rolloverDialogVisible).toBeTrue();
    });

    it('"transferred": moves the money between accounts and records the destination on resolution', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload()));
      const source = await firstValueFrom(accountService.create(accountPayload({ name: 'Origen', balance: 1000 })));
      const destination = await firstValueFrom(accountService.create(accountPayload({ name: 'Destino', balance: 0 })));
      const budget = await firstValueFrom(
        budgetService.save(lastMonth, 300, [], [{ goalId: goal.id, accountId: source.id, amount: 150 }])
      );
      createComponent();
      component.openRolloverDialog(component.pendingRollovers[0]);
      component.rolloverForm = { action: 'transferred', sourceAccountId: source.id, destinationAccountId: destination.id };

      await component.saveRolloverResolution();

      const accounts = await firstValueFrom(accountService.getAll());
      expect(accounts.find((a) => a.id === source.id)?.balance).toBe(850);
      expect(accounts.find((a) => a.id === destination.id)?.balance).toBe(150);
      const budgets = await firstValueFrom(budgetService.getAll());
      const resolved = budgets.find((b) => b.id === budget.id)!.goalAllocations[0];
      expect(resolved.resolution).toBe('transferred');
      expect(resolved.destinationAccountId).toBe(destination.id);
    });

    it('"saved": debits the source account and contributes the amount to the goal', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload({ currentAmount: 0 })));
      const account = await firstValueFrom(accountService.create(accountPayload({ balance: 1000 })));
      const budget = await firstValueFrom(
        budgetService.save(lastMonth, 300, [], [{ goalId: goal.id, accountId: account.id, amount: 150 }])
      );
      createComponent();
      component.openRolloverDialog(component.pendingRollovers[0]);
      component.rolloverForm = { action: 'saved', sourceAccountId: account.id, destinationAccountId: null };

      await component.saveRolloverResolution();

      const accounts = await firstValueFrom(accountService.getAll());
      expect(accounts.find((a) => a.id === account.id)?.balance).toBe(850);
      const goals = await firstValueFrom(goalService.getAll());
      expect(goals.find((g) => g.id === goal.id)?.currentAmount).toBe(150);
      const budgets = await firstValueFrom(budgetService.getAll());
      expect(budgets.find((b) => b.id === budget.id)!.goalAllocations[0].resolution).toBe('saved');
    });

    it('warns and does nothing when a non-"kept" action has no source account chosen', async () => {
      const goal = await firstValueFrom(goalService.create(goalPayload()));
      const account = await firstValueFrom(accountService.create(accountPayload()));
      await firstValueFrom(budgetService.save(lastMonth, 300, [], [{ goalId: goal.id, accountId: account.id, amount: 150 }]));
      createComponent();
      component.openRolloverDialog(component.pendingRollovers[0]);
      component.rolloverForm = { action: 'saved', sourceAccountId: null, destinationAccountId: null };

      await component.saveRolloverResolution();

      expect(component.rolloverDialogVisible).toBeTrue();
    });
  });
});

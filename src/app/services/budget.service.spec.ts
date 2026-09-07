import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetService, BudgetFormRow, BudgetFormGoalRow } from './budget.service';
import { PeriodSettingsService } from './period-settings.service';
import { DashboardService } from './dashboard.service';
import { AccountService } from './account.service';
import { GoalService } from './goal.service';
import { Budget, PendingGoalRollover } from '../core/types/budget.types';
import { Transaction } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';
import { Goal } from '../core/types/goal.types';

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: `cat-${Math.random()}`,
    name: 'Almacén',
    type: 'expense',
    color: '#f00',
    icon: 'tag',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: `goal-${Math.random()}`,
    name: 'Viaje',
    targetAmount: 1000,
    currentAmount: 0,
    color: '#0f0',
    icon: 'plane',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function makeRow(overrides: Partial<BudgetFormRow> = {}): BudgetFormRow {
  return { categoryId: 'cat-1', name: 'Almacén', color: '#f00', icon: 'tag', historicalTotal: 0, included: true, amount: 100, ...overrides };
}

function makeGoalRow(overrides: Partial<BudgetFormGoalRow> = {}): BudgetFormGoalRow {
  return { goalId: 'goal-1', name: 'Viaje', color: '#0f0', icon: 'plane', included: true, amount: 100, accountId: 'acc-1', ...overrides };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: `t-${Math.random()}`,
    categoryId: 'cat-1',
    type: 'expense',
    name: 'Compra',
    description: '',
    amount: 100,
    date: new Date(2026, 0, 15),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('BudgetService', () => {
  let service: BudgetService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(BudgetService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('save / getCurrent / getUpcoming / getHistory', () => {
    it('has nothing initially', async () => {
      expect(await firstValueFrom(service.getCurrent())).toBeNull();
      expect(await firstValueFrom(service.getUpcoming())).toBeNull();
      expect(await firstValueFrom(service.getHistory())).toEqual([]);
    });

    it('save() targeting the current calendar month makes it the current budget', async () => {
      const march = new Date(2026, 2, 15);
      await firstValueFrom(service.save(march, 10000, [{ categoryId: 'cat-1', amount: 5000 }]));

      const all = await firstValueFrom(service.getAll());
      expect(service.currentBudget(all, march)?.totalAmount).toBe(10000);
      expect(service.upcomingBudget(all, march)).toBeNull();
    });

    it('save() targeting next month makes it the upcoming budget, not current', async () => {
      const march = new Date(2026, 2, 15);
      const april = new Date(2026, 3, 1);
      await firstValueFrom(service.save(april, 20000, []));

      const all = await firstValueFrom(service.getAll());
      expect(service.currentBudget(all, march)).toBeNull();
      expect(service.upcomingBudget(all, march)?.totalAmount).toBe(20000);
    });

    it('save() called twice for the same month upserts in place instead of creating a second record', async () => {
      const march = new Date(2026, 2, 15);
      const first = await firstValueFrom(service.save(march, 10000, []));
      const second = await firstValueFrom(service.save(march, 15000, [{ categoryId: 'cat-1', amount: 7000 }]));

      expect(second.id).toBe(first.id);
      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(1);
      expect(all[0].totalAmount).toBe(15000);
    });

    it('historyBudgets returns past months sorted most-recent-first, excluding current/future', async () => {
      const reference = new Date(2026, 2, 15);
      await firstValueFrom(service.save(new Date(2026, 0, 1), 1000, []));
      await firstValueFrom(service.save(new Date(2026, 1, 1), 2000, []));
      await firstValueFrom(service.save(new Date(2026, 2, 1), 3000, []));
      await firstValueFrom(service.save(new Date(2026, 3, 1), 4000, []));

      const all = await firstValueFrom(service.getAll());
      const history = service.historyBudgets(all, reference);
      expect(history.map((b) => b.totalAmount)).toEqual([2000, 1000]);
    });
  });

  describe('delete (pause / cancel)', () => {
    it('soft-deletes, removing it from current but keeping it in storage', async () => {
      const march = new Date(2026, 2, 15);
      const created = await firstValueFrom(service.save(march, 10000, []));
      await firstValueFrom(service.delete(created.id));

      const all = await firstValueFrom(service.getAll());
      expect(service.currentBudget(all, march)).toBeNull();

      const raw = JSON.parse(localStorage.getItem('budgets')!);
      expect(raw.find((b: { id: string }) => b.id === created.id).deletedAt).toBeTruthy();
    });

    it('exposes tombstones via getAllIncludingDeleted but not via getAll', async () => {
      const created = await firstValueFrom(service.save(new Date(2026, 2, 15), 10000, []));
      await firstValueFrom(service.delete(created.id));

      const tombstone = service.getAllIncludingDeleted().find((b) => b.id === created.id);
      expect(tombstone?.deletedAt).toEqual(jasmine.any(Date));
    });

    it('replaceAll persists and emits exactly what is passed', async () => {
      const created = await firstValueFrom(service.save(new Date(2026, 2, 15), 10000, []));
      const replacement = { ...created, totalAmount: 99999 };

      service.replaceAll([replacement]);

      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(1);
      expect(all[0].totalAmount).toBe(99999);
    });

    it('persists across service instances via localStorage', async () => {
      await firstValueFrom(service.save(new Date(2026, 2, 15), 12345, []));

      const fresh = new BudgetService(new PeriodSettingsService(), new DashboardService(), new AccountService(), new GoalService());
      const all = await firstValueFrom(fresh.getAll());
      expect(all.some((b) => b.totalAmount === 12345)).toBeTrue();
    });
  });

  describe('carryForwardIfNeeded', () => {
    it('fills the gap from the last non-deleted month up through the reference month', async () => {
      await firstValueFrom(service.save(new Date(2026, 0, 1), 5000, [{ categoryId: 'cat-1', amount: 2000 }]));

      service.carryForwardIfNeeded(new Date(2026, 2, 10));

      const all = await firstValueFrom(service.getAll());
      const months = all.map((b) => b.month.getTime()).sort();
      expect(months).toEqual([
        new Date(2026, 0, 1).getTime(),
        new Date(2026, 1, 1).getTime(),
        new Date(2026, 2, 1).getTime()
      ]);
      const march = service.currentBudget(all, new Date(2026, 2, 10));
      expect(march?.totalAmount).toBe(5000);
      expect(march?.allocations).toEqual([{ categoryId: 'cat-1', amount: 2000 }]);
    });

    it('does nothing when a record already exists for the reference month', async () => {
      await firstValueFrom(service.save(new Date(2026, 2, 1), 7000, []));

      service.carryForwardIfNeeded(new Date(2026, 2, 10));

      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(1);
    });

    it('copies goal allocations forward stripped of any prior resolution', async () => {
      const created = await firstValueFrom(
        service.save(new Date(2026, 0, 1), 5000, [], [{ goalId: 'goal-1', accountId: 'acc-1', amount: 1000 }])
      );
      await firstValueFrom(
        service.markGoalAllocationResolved(created.id, 'goal-1', 'saved', 'acc-1')
      );

      service.carryForwardIfNeeded(new Date(2026, 1, 10));

      const all = await firstValueFrom(service.getAll());
      const feb = service.currentBudget(all, new Date(2026, 1, 10));
      expect(feb?.goalAllocations).toEqual([{ goalId: 'goal-1', accountId: 'acc-1', amount: 1000 }]);
    });

    it('does not resurrect a month after the latest record was explicitly paused (deleted)', async () => {
      const created = await firstValueFrom(service.save(new Date(2026, 0, 1), 5000, []));
      await firstValueFrom(service.delete(created.id));

      service.carryForwardIfNeeded(new Date(2026, 2, 10));

      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(0);
    });

    it('does nothing when there is no budget history at all', () => {
      service.carryForwardIfNeeded(new Date(2026, 2, 10));
      expect(service.getAllIncludingDeleted().length).toBe(0);
    });
  });

  describe('suggestMonthlyLimit', () => {
    // reference: March 2026. History: Dec 200, Jan 400, Feb 600 (most recent last).
    const reference = new Date(2026, 2, 15);
    const transactions: Transaction[] = [
      makeTransaction({ categoryId: 'cat-1', amount: 200, date: new Date(2025, 11, 5) }),
      makeTransaction({ categoryId: 'cat-1', amount: 400, date: new Date(2026, 0, 5) }),
      makeTransaction({ categoryId: 'cat-1', amount: 600, date: new Date(2026, 1, 5) })
    ];

    it('lastMonth: most recent complete month total', () => {
      expect(service.suggestMonthlyLimit(transactions, 'cat-1', 'lastMonth', reference)).toBe(600);
    });

    it('avg3: mean of the last 3 months', () => {
      expect(service.suggestMonthlyLimit(transactions, 'cat-1', 'avg3', reference)).toBe(400);
    });

    it('avgAll: mean across every month with data', () => {
      expect(service.suggestMonthlyLimit(transactions, 'cat-1', 'avgAll', reference)).toBe(400);
    });

    it('median6: median of the last 6 months (zero-filled where no spend)', () => {
      expect(service.suggestMonthlyLimit(transactions, 'cat-1', 'median6', reference)).toBe(100);
    });

    it('returns 0 for a category with no expense history', () => {
      expect(service.suggestMonthlyLimit(transactions, 'cat-unknown', 'avg3', reference)).toBe(0);
    });
  });

  describe('budgetProgress', () => {
    it('computes allocated, spent, unallocated and percentages', () => {
      const budget: Budget = {
        id: 'b1',
        month: new Date(2026, 2, 1),
        totalAmount: 10000,
        allocations: [
          { categoryId: 'cat-1', amount: 6000 },
          { categoryId: 'cat-2', amount: 2000 }
        ],
        goalAllocations: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const monthTxns: Transaction[] = [
        makeTransaction({ categoryId: 'cat-1', amount: 3000 }),
        makeTransaction({ categoryId: 'cat-2', amount: 2500 }),
        makeTransaction({ categoryId: 'cat-3', amount: 500 })
      ];

      const progress = service.budgetProgress(budget, monthTxns);
      expect(progress.totalAllocated).toBe(8000);
      expect(progress.unallocated).toBe(2000);
      expect(progress.totalSpent).toBe(6000);
      expect(progress.totalPct).toBe(60);

      const cat1 = progress.categories.find((c) => c.categoryId === 'cat-1')!;
      expect(cat1.spent).toBe(3000);
      expect(cat1.pct).toBe(50);

      const cat2 = progress.categories.find((c) => c.categoryId === 'cat-2')!;
      expect(cat2.spent).toBe(2500);
      expect(cat2.pct).toBe(125);
    });

    it('counts goal allocations toward totalAllocated/unallocated and lists them separately', () => {
      const budget: Budget = {
        id: 'b1',
        month: new Date(2026, 2, 1),
        totalAmount: 10000,
        allocations: [{ categoryId: 'cat-1', amount: 6000 }],
        goalAllocations: [{ goalId: 'goal-1', accountId: 'acc-1', amount: 1000 }],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const progress = service.budgetProgress(budget, []);
      expect(progress.totalAllocated).toBe(7000);
      expect(progress.unallocated).toBe(3000);
      expect(progress.goals).toEqual([{ goalId: 'goal-1', amount: 1000 }]);
    });
  });

  describe('pendingGoalRollovers', () => {
    it('returns unresolved goal allocations from past-month budgets only', async () => {
      const past = await firstValueFrom(
        service.save(new Date(2026, 0, 1), 5000, [], [{ goalId: 'goal-1', accountId: 'acc-1', amount: 1000 }])
      );
      await firstValueFrom(service.save(new Date(2026, 2, 1), 5000, [], [{ goalId: 'goal-1', accountId: 'acc-1', amount: 1000 }]));

      const all = await firstValueFrom(service.getAll());
      const pending = service.pendingGoalRollovers(all, new Date(2026, 2, 10));

      expect(pending.length).toBe(1);
      expect(pending[0].budget.id).toBe(past.id);
      expect(pending[0].allocation.goalId).toBe('goal-1');
    });

    it('excludes allocations that were already resolved', async () => {
      const past = await firstValueFrom(
        service.save(new Date(2026, 0, 1), 5000, [], [{ goalId: 'goal-1', accountId: 'acc-1', amount: 1000 }])
      );
      await firstValueFrom(service.markGoalAllocationResolved(past.id, 'goal-1', 'kept', 'acc-1'));

      const all = await firstValueFrom(service.getAll());
      expect(service.pendingGoalRollovers(all, new Date(2026, 2, 10))).toEqual([]);
    });

    it('excludes past budgets that were paused (deleted)', async () => {
      const past = await firstValueFrom(
        service.save(new Date(2026, 0, 1), 5000, [], [{ goalId: 'goal-1', accountId: 'acc-1', amount: 1000 }])
      );
      await firstValueFrom(service.delete(past.id));

      const all = await firstValueFrom(service.getAll());
      expect(service.pendingGoalRollovers(all, new Date(2026, 2, 10))).toEqual([]);
    });
  });

  describe('markGoalAllocationResolved', () => {
    it('sets resolution fields on the matching allocation only', async () => {
      const created = await firstValueFrom(
        service.save(new Date(2026, 0, 1), 5000, [], [
          { goalId: 'goal-1', accountId: 'acc-1', amount: 1000 },
          { goalId: 'goal-2', accountId: 'acc-1', amount: 500 }
        ])
      );

      await firstValueFrom(service.markGoalAllocationResolved(created.id, 'goal-1', 'transferred', 'acc-1', 'acc-2'));

      const all = await firstValueFrom(service.getAll());
      const budget = all.find((b) => b.id === created.id)!;
      const goal1 = budget.goalAllocations.find((a) => a.goalId === 'goal-1')!;
      const goal2 = budget.goalAllocations.find((a) => a.goalId === 'goal-2')!;

      expect(goal1.resolution).toBe('transferred');
      expect(goal1.resolvedAccountId).toBe('acc-1');
      expect(goal1.destinationAccountId).toBe('acc-2');
      expect(goal2.resolution).toBeUndefined();
    });
  });

  describe('custom period start day', () => {
    let periodSettings: PeriodSettingsService;

    beforeEach(() => {
      periodSettings = TestBed.inject(PeriodSettingsService);
      periodSettings.setStartDay(6);
    });

    it('currentBudget labels a day-1-to-5 reference under the previous calendar month', async () => {
      // Paid the 6th: Aug 3 is still "July's" period.
      await firstValueFrom(service.save(new Date(2026, 6, 1), 5000, []));

      const all = await firstValueFrom(service.getAll());
      expect(service.currentBudget(all, new Date(2026, 7, 3))?.totalAmount).toBe(5000);
    });

    it('currentBudget labels a day-on-or-after-startDay reference under that calendar month', async () => {
      await firstValueFrom(service.save(new Date(2026, 7, 1), 6000, []));

      const all = await firstValueFrom(service.getAll());
      expect(service.currentBudget(all, new Date(2026, 7, 6))?.totalAmount).toBe(6000);
    });

    it('upcomingBudget shifts along with the custom label', async () => {
      await firstValueFrom(service.save(new Date(2026, 7, 1), 7000, []));

      const all = await firstValueFrom(service.getAll());
      // Reference Aug 3 -> current label = July, so upcoming = August.
      expect(service.upcomingBudget(all, new Date(2026, 7, 3))?.totalAmount).toBe(7000);
    });

    it('carryForwardIfNeeded fills gaps using the custom label month', async () => {
      await firstValueFrom(service.save(new Date(2026, 5, 1), 1000, []));

      // Aug 20 is on-or-after startDay=6, so its label is August itself.
      service.carryForwardIfNeeded(new Date(2026, 7, 20));

      const all = await firstValueFrom(service.getAll());
      const months = all.map((b) => b.month.getTime()).sort();
      expect(months).toEqual([new Date(2026, 5, 1).getTime(), new Date(2026, 6, 1).getTime(), new Date(2026, 7, 1).getTime()]);
    });
  });

  describe('buildAllocationRows', () => {
    it('builds a row per expense category, sorted by historical spend descending', () => {
      const cheap = makeCategory({ id: 'cat-1', name: 'Poco gasto' });
      const pricey = makeCategory({ id: 'cat-2', name: 'Mucho gasto' });
      const transactions = [
        makeTransaction({ categoryId: 'cat-1', type: 'expense', amount: 50 }),
        makeTransaction({ categoryId: 'cat-2', type: 'expense', amount: 900 })
      ];

      const rows = service.buildAllocationRows([cheap, pricey], transactions, []);

      expect(rows.length).toBe(2);
      expect(rows[0].categoryId).toBe('cat-2');
      expect(rows[0].historicalTotal).toBe(900);
      expect(rows[1].categoryId).toBe('cat-1');
    });

    it('ignores income transactions when totaling historical spend', () => {
      const cat = makeCategory({ id: 'cat-1' });
      const transactions = [makeTransaction({ categoryId: 'cat-1', type: 'income', amount: 5000 })];

      const rows = service.buildAllocationRows([cat], transactions, []);
      expect(rows[0].historicalTotal).toBe(0);
    });

    it('pre-checks and pre-fills a row from an existing allocation', () => {
      const cat = makeCategory({ id: 'cat-1' });

      const rows = service.buildAllocationRows([cat], [], [{ categoryId: 'cat-1', amount: 300 }]);

      expect(rows[0].included).toBeTrue();
      expect(rows[0].amount).toBe(300);
    });
  });

  describe('buildGoalRows', () => {
    it('builds one row per goal, pre-checked and pre-filled from an existing goal allocation', () => {
      const goal = makeGoal({ id: 'goal-1' });

      const rows = service.buildGoalRows([goal], [{ goalId: 'goal-1', accountId: 'acc-1', amount: 150 }]);

      expect(rows.length).toBe(1);
      expect(rows[0].included).toBeTrue();
      expect(rows[0].amount).toBe(150);
      expect(rows[0].accountId).toBe('acc-1');
    });

    it('leaves a goal with no existing allocation unchecked', () => {
      const goal = makeGoal({ id: 'goal-1' });
      const rows = service.buildGoalRows([goal], []);
      expect(rows[0].included).toBeFalse();
      expect(rows[0].amount).toBeNull();
    });
  });

  describe('buildTargetMonthOptions', () => {
    it('offers this month and next month by default', () => {
      const reference = new Date(2026, 5, 15);
      const options = service.buildTargetMonthOptions(new Date(2026, 5, 1), reference);

      expect(options.length).toBe(2);
      expect(options[0].value).toEqual(new Date(2026, 5, 1));
      expect(options[1].value).toEqual(new Date(2026, 6, 1));
    });

    it('adds a third option when preferred is neither this month nor next (e.g. period start day changed since saving)', () => {
      const reference = new Date(2026, 5, 15);
      const preferred = new Date(2026, 8, 1);

      const options = service.buildTargetMonthOptions(preferred, reference);

      expect(options.length).toBe(3);
      expect(options[2].value).toEqual(preferred);
    });
  });

  describe('saveFromRows', () => {
    it('rejects a missing or non-positive total amount', async () => {
      expect(await service.saveFromRows(new Date(2026, 0, 1), null, [], [])).toEqual({
        status: 'invalid',
        summary: 'Ingresá un monto total válido'
      });
      expect(await service.saveFromRows(new Date(2026, 0, 1), 0, [], [])).toEqual({
        status: 'invalid',
        summary: 'Ingresá un monto total válido'
      });
    });

    it('rejects an included row with no amount or a negative amount', async () => {
      const outcome = await service.saveFromRows(new Date(2026, 0, 1), 500, [makeRow({ amount: null })], []);
      expect(outcome).toEqual({
        status: 'invalid',
        summary: 'Montos incompletos',
        detail: 'Completá un monto válido para cada categoría seleccionada'
      });
    });

    it('rejects an included goal row missing an account or a valid amount', async () => {
      const outcome = await service.saveFromRows(new Date(2026, 0, 1), 500, [], [makeGoalRow({ accountId: null })]);
      expect(outcome).toEqual({
        status: 'invalid',
        summary: 'Metas incompletas',
        detail: 'Completá cuenta de origen y un monto válido para cada meta seleccionada'
      });
    });

    it('rejects when allocated categories + goals exceed the total amount', async () => {
      const outcome = await service.saveFromRows(new Date(2026, 0, 1), 100, [makeRow({ amount: 80 })], [makeGoalRow({ amount: 50 })]);
      expect(outcome).toEqual({
        status: 'invalid',
        summary: 'Presupuesto sobreasignado',
        detail: 'La suma de las categorías y metas supera el monto total'
      });
    });

    it('saves only the included rows as allocations/goal allocations', async () => {
      const rows = [makeRow({ categoryId: 'cat-1', amount: 200, included: true }), makeRow({ categoryId: 'cat-2', included: false })];
      const goalRows = [makeGoalRow({ goalId: 'goal-1', amount: 100, included: true })];

      const outcome = await service.saveFromRows(new Date(2026, 0, 1), 500, rows, goalRows);
      expect(outcome).toEqual({ status: 'saved' });

      const all = await firstValueFrom(service.getAll());
      expect(all[0].allocations).toEqual([{ categoryId: 'cat-1', amount: 200 }]);
      expect(all[0].goalAllocations).toEqual([{ goalId: 'goal-1', accountId: 'acc-1', amount: 100 }]);
    });
  });

  describe('resolveRollover', () => {
    function pendingRollover(overrides: Partial<PendingGoalRollover['allocation']> = {}): PendingGoalRollover {
      return {
        budget: {
          id: 'b1',
          month: new Date(2026, 0, 1),
          totalAmount: 500,
          allocations: [],
          goalAllocations: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        allocation: { goalId: 'goal-1', accountId: 'acc-1', amount: 200, ...overrides }
      };
    }

    it('rejects a non-kept action with no source account', async () => {
      const outcome = await service.resolveRollover(pendingRollover(), { action: 'saved', sourceAccountId: null, destinationAccountId: null });
      expect(outcome).toEqual({ status: 'invalid', summary: 'Elegí de qué cuenta sale el dinero' });
    });

    it('rejects a transfer with no destination, or the same account as source and destination', async () => {
      const outcome = await service.resolveRollover(pendingRollover(), {
        action: 'transferred',
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-1'
      });
      expect(outcome).toEqual({ status: 'invalid', summary: 'Elegí una cuenta de destino distinta' });
    });

    it('transfers the amount between accounts and marks the allocation resolved', async () => {
      const accountService = TestBed.inject(AccountService);
      const from = await firstValueFrom(accountService.create({ name: 'Efectivo', type: 'cash', balance: 1000, color: '#10b981', icon: 'wallet' }));
      const to = await firstValueFrom(accountService.create({ name: 'Banco', type: 'bank', balance: 200, color: '#3b82f6', icon: 'building' }));
      const created = await firstValueFrom(
        service.save(new Date(2026, 0, 1), 500, [], [{ goalId: 'goal-1', accountId: from.id, amount: 200 }])
      );
      const pending: PendingGoalRollover = { budget: created, allocation: created.goalAllocations[0] };

      const outcome = await service.resolveRollover(pending, { action: 'transferred', sourceAccountId: from.id, destinationAccountId: to.id });
      expect(outcome).toEqual({ status: 'resolved' });

      const accounts = await firstValueFrom(accountService.getAll());
      expect(accounts.find((a) => a.id === from.id)?.balance).toBe(800);
      expect(accounts.find((a) => a.id === to.id)?.balance).toBe(400);

      const all = await firstValueFrom(service.getAll());
      const allocation = all[0].goalAllocations[0];
      expect(allocation.resolution).toBe('transferred');
      expect(allocation.destinationAccountId).toBe(to.id);
    });

    it('debits the source account and contributes to the goal when saved', async () => {
      const accountService = TestBed.inject(AccountService);
      const goalService = TestBed.inject(GoalService);
      const account = await firstValueFrom(accountService.create({ name: 'Efectivo', type: 'cash', balance: 1000, color: '#10b981', icon: 'wallet' }));
      const goal = await firstValueFrom(goalService.create({ name: 'Viaje', targetAmount: 1000, currentAmount: 0, color: '#0f0', icon: 'plane' }));
      const created = await firstValueFrom(
        service.save(new Date(2026, 0, 1), 500, [], [{ goalId: goal.id, accountId: account.id, amount: 300 }])
      );
      const pending: PendingGoalRollover = { budget: created, allocation: created.goalAllocations[0] };

      const outcome = await service.resolveRollover(pending, { action: 'saved', sourceAccountId: account.id, destinationAccountId: null });
      expect(outcome).toEqual({ status: 'resolved' });

      const accounts = await firstValueFrom(accountService.getAll());
      expect(accounts.find((a) => a.id === account.id)?.balance).toBe(700);

      const goals = await firstValueFrom(goalService.getAll());
      expect(goals.find((g) => g.id === goal.id)?.currentAmount).toBe(300);
    });

    it('leaves account/goal balances untouched when kept, only marking the allocation resolved', async () => {
      const created = await firstValueFrom(
        service.save(new Date(2026, 0, 1), 500, [], [{ goalId: 'goal-1', accountId: 'acc-1', amount: 200 }])
      );
      const pending: PendingGoalRollover = { budget: created, allocation: created.goalAllocations[0] };

      const outcome = await service.resolveRollover(pending, { action: 'kept', sourceAccountId: null, destinationAccountId: null });
      expect(outcome).toEqual({ status: 'resolved' });

      const all = await firstValueFrom(service.getAll());
      const allocation = all[0].goalAllocations[0];
      expect(allocation.resolution).toBe('kept');
      expect(allocation.resolvedAccountId).toBe('acc-1');
    });
  });
});

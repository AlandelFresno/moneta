import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetService } from './budget.service';
import { Budget } from '../core/types/budget.types';
import { Transaction } from '../core/types/transaction.types';

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

      const fresh = new BudgetService();
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
});

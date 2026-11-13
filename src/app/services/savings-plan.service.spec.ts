import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SavingsPlanService } from './savings-plan.service';
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
    date: new Date(2026, 2, 10),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'b-1',
    month: new Date(2026, 2, 1),
    totalAmount: 400,
    allocations: [{ categoryId: 'cat-1', amount: 300 }],
    goalAllocations: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('SavingsPlanService', () => {
  let service: SavingsPlanService;
  const reference = new Date(2026, 2, 15);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(SavingsPlanService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('save / getPlan / delete', () => {
    it('has no plan initially', async () => {
      expect(await firstValueFrom(service.getPlan())).toBeNull();
    });

    it('save() keeps a single plan and updates it in place', async () => {
      await firstValueFrom(service.save(80, null));
      await firstValueFrom(service.save(70, 5000));

      const plan = await firstValueFrom(service.getPlan());
      expect(plan?.targetPct).toBe(70);
      expect(plan?.incomeOverride).toBe(5000);
      expect(service.getAllIncludingDeleted().length).toBe(1);
    });

    it('delete() soft-deletes so the plan disappears but the tombstone syncs', async () => {
      await firstValueFrom(service.save(80, null));
      await firstValueFrom(service.delete());

      expect(await firstValueFrom(service.getPlan())).toBeNull();
      expect(service.getAllIncludingDeleted()[0].deletedAt).toBeDefined();
    });
  });

  describe('summarize', () => {
    const transactions = [
      makeTransaction({ type: 'income', amount: 1000, date: new Date(2026, 0, 5) }),
      makeTransaction({ type: 'income', amount: 2000, date: new Date(2026, 1, 5) }),
      makeTransaction({ type: 'expense', amount: 250, categoryId: 'cat-1', date: new Date(2026, 2, 10) }),
      makeTransaction({ type: 'expense', amount: 40, categoryId: 'cat-2', date: new Date(2026, 2, 11) })
    ];

    it('averages prior periods with income to estimate the ticket', async () => {
      const plan = await firstValueFrom(service.save(80, null));
      const summary = service.summarize(plan, transactions, null, reference);

      expect(summary.income).toBe(1500);
      expect(summary.incomeIsEstimate).toBeTrue();
      expect(summary.savingsGoal).toBe(1200);
      expect(summary.ticket).toBe(300);
    });

    it('uses the income override instead of the average', async () => {
      const plan = await firstValueFrom(service.save(50, 1000));
      const summary = service.summarize(plan, transactions, null, reference);

      expect(summary.income).toBe(1000);
      expect(summary.incomeIsEstimate).toBeFalse();
      expect(summary.ticket).toBe(500);
    });

    it('reports spend, saved %, and remaining buffer against the ticket', async () => {
      const plan = await firstValueFrom(service.save(80, null));
      const summary = service.summarize(plan, transactions, null, reference);

      expect(summary.spent).toBe(290);
      expect(summary.saved).toBe(1210);
      expect(summary.savedPct).toBeCloseTo(80.67, 1);
      expect(summary.buffer).toBe(10);
      expect(summary.bufferPct).toBeCloseTo(0.67, 1);
    });

    it('buffer goes negative when spending exceeds the ticket', async () => {
      const plan = await firstValueFrom(service.save(90, null));
      const summary = service.summarize(plan, transactions, null, reference);

      expect(summary.ticket).toBe(150);
      expect(summary.buffer).toBe(-140);
    });

    it('falls back to this period income when there is no history', async () => {
      const plan = await firstValueFrom(service.save(80, null));
      const onlyCurrent = [makeTransaction({ type: 'income', amount: 800, date: new Date(2026, 2, 2) })];
      const summary = service.summarize(plan, onlyCurrent, null, reference);

      expect(summary.income).toBe(800);
      expect(summary.ticket).toBe(160);
    });

    it('has no saved % when there is no income at all', async () => {
      const plan = await firstValueFrom(service.save(80, null));
      const summary = service.summarize(plan, [], null, reference);

      expect(summary.income).toBe(0);
      expect(summary.savedPct).toBeNull();
    });

    it('merges budget allocations with actual spend per category', async () => {
      const plan = await firstValueFrom(service.save(80, null));
      const summary = service.summarize(plan, transactions, makeBudget(), reference);

      expect(summary.budgetTotal).toBe(400);
      expect(summary.rows).toEqual([
        { categoryId: 'cat-1', planned: 300, actual: 250 },
        { categoryId: 'cat-2', planned: null, actual: 40 }
      ]);
    });
  });

  describe('periodTrend', () => {
    it('returns one point per period, oldest first, with saved % per period', () => {
      const transactions = [
        makeTransaction({ type: 'income', amount: 1000, date: new Date(2026, 1, 5) }),
        makeTransaction({ type: 'expense', amount: 200, date: new Date(2026, 1, 8) }),
        makeTransaction({ type: 'income', amount: 1000, date: new Date(2026, 2, 5) }),
        makeTransaction({ type: 'expense', amount: 500, date: new Date(2026, 2, 8) })
      ];

      const trend = service.periodTrend(transactions, reference, 3);

      expect(trend.length).toBe(3);
      expect(trend[0].savedPct).toBeNull();
      expect(trend[1].savedPct).toBe(80);
      expect(trend[2].savedPct).toBe(50);
    });
  });
});

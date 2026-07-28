import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BillService } from './bill.service';
import { Bill } from '../core/types/bill.types';

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'b1',
    name: 'Internet',
    description: '',
    categoryId: 'cat-1',
    approxAmount: 5000,
    period: 'monthly',
    dueDate: new Date(2026, 0, 10),
    active: true,
    payments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('BillService', () => {
  let service: BillService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(BillService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('currentPeriodDueDate — monthly', () => {
    it('uses the same day-of-month in the current month', () => {
      const bill = makeBill({ period: 'monthly', dueDate: new Date(2026, 0, 10) });
      const result = service.currentPeriodDueDate(bill, new Date(2026, 2, 15));
      expect(result).toEqual(new Date(2026, 2, 10));
    });

    it('clamps to the last day of a shorter month (e.g. due-day 31 in February)', () => {
      const bill = makeBill({ period: 'monthly', dueDate: new Date(2026, 0, 31) });
      const result = service.currentPeriodDueDate(bill, new Date(2026, 1, 15));
      expect(result).toEqual(new Date(2026, 1, 28));
    });
  });

  describe('currentPeriodDueDate — yearly', () => {
    it('uses the same month+day in the current year', () => {
      const bill = makeBill({ period: 'yearly', dueDate: new Date(2020, 2, 15) });
      const result = service.currentPeriodDueDate(bill, new Date(2026, 5, 1));
      expect(result).toEqual(new Date(2026, 2, 15));
    });
  });

  describe('currentPeriodDueDate — weekly', () => {
    it('finds the most recent occurrence of the due day-of-week, not future', () => {
      // dueDate is a Tuesday (day 2); "now" is a Friday
      const dueDate = new Date(2026, 0, 6); // Tuesday
      expect(dueDate.getDay()).toBe(2);
      const bill = makeBill({ period: 'weekly', dueDate });

      const now = new Date(2026, 0, 9); // Friday
      expect(now.getDay()).toBe(5);

      const result = service.currentPeriodDueDate(bill, now);
      expect(result).toEqual(new Date(2026, 0, 6));
    });
  });

  describe('isPaidForPeriod', () => {
    it('monthly: a payment anywhere in the same month counts as paid', () => {
      const bill = makeBill({
        period: 'monthly',
        payments: [{ id: 'p1', paidDate: new Date(2026, 2, 28), amount: 5000, transactionId: 't1' }]
      });
      const periodDue = new Date(2026, 2, 10);
      expect(service.isPaidForPeriod(bill, periodDue)).toBeTrue();
    });

    it('monthly: a payment in a different month does not count', () => {
      const bill = makeBill({
        period: 'monthly',
        payments: [{ id: 'p1', paidDate: new Date(2026, 1, 28), amount: 5000, transactionId: 't1' }]
      });
      const periodDue = new Date(2026, 2, 10);
      expect(service.isPaidForPeriod(bill, periodDue)).toBeFalse();
    });

    it('yearly: a payment anywhere in the same year counts as paid', () => {
      const bill = makeBill({
        period: 'yearly',
        payments: [{ id: 'p1', paidDate: new Date(2026, 8, 1), amount: 5000, transactionId: 't1' }]
      });
      const periodDue = new Date(2026, 2, 15);
      expect(service.isPaidForPeriod(bill, periodDue)).toBeTrue();
    });
  });

  describe('dueStatuses', () => {
    it('includes a bill whose period due date has passed and is unpaid', () => {
      const bill = makeBill({ period: 'monthly', dueDate: new Date(2026, 0, 5) });
      const now = new Date(2026, 2, 20);

      const statuses = service.dueStatuses([bill], now);
      expect(statuses.length).toBe(1);
      expect(statuses[0].isOverdue).toBeTrue();
    });

    it('excludes a bill already paid for the current period', () => {
      const bill = makeBill({
        period: 'monthly',
        dueDate: new Date(2026, 0, 5),
        payments: [{ id: 'p1', paidDate: new Date(2026, 2, 6), amount: 5000, transactionId: 't1' }]
      });
      const now = new Date(2026, 2, 20);

      const statuses = service.dueStatuses([bill], now);
      expect(statuses.length).toBe(0);
    });

    it('excludes an inactive bill', () => {
      const bill = makeBill({ period: 'monthly', dueDate: new Date(2026, 0, 5), active: false });
      const now = new Date(2026, 2, 20);

      const statuses = service.dueStatuses([bill], now);
      expect(statuses.length).toBe(0);
    });

    it('excludes a bill whose due date has not arrived yet this period', () => {
      const bill = makeBill({ period: 'monthly', dueDate: new Date(2026, 0, 25) });
      const now = new Date(2026, 2, 10); // due date this month is the 25th, not reached yet

      const statuses = service.dueStatuses([bill], now);
      expect(statuses.length).toBe(0);
    });

    it('marks isOverdue false when due exactly today', () => {
      const bill = makeBill({ period: 'monthly', dueDate: new Date(2026, 0, 10) });
      const now = new Date(2026, 2, 10);

      const statuses = service.dueStatuses([bill], now);
      expect(statuses.length).toBe(1);
      expect(statuses[0].isOverdue).toBeFalse();
    });

    it('excludes a bill whose anchor date is still in the future, even if that day-of-month already passed this month (regression)', () => {
      // Created "today" (Jul 28) with a future anchor of Aug 5. Without the fix, the monthly
      // day-of-month pattern (day 5) would be reapplied to the current month (Jul 5, already
      // passed) and wrongly flag the brand-new bill as overdue.
      const bill = makeBill({ period: 'monthly', dueDate: new Date(2026, 7, 5) });
      const now = new Date(2026, 6, 28);

      const statuses = service.dueStatuses([bill], now);
      expect(statuses.length).toBe(0);
    });
  });

  describe('CRUD + persistence', () => {
    it('creates a bill with generated id and empty payments', async () => {
      const created = await firstValueFrom(
        service.create({
          name: 'Alquiler',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 100000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );

      expect(created.id).toBeTruthy();
      expect(created.payments).toEqual([]);
    });

    it('records a payment, appending to the payments array without touching earlier entries', async () => {
      const created = await firstValueFrom(
        service.create({
          name: 'Alquiler',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 100000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );

      await firstValueFrom(service.recordPayment(created.id, 100000, 'txn-1', new Date(2026, 0, 6)));
      await firstValueFrom(service.recordPayment(created.id, 105000, 'txn-2', new Date(2026, 1, 6)));

      const all = await firstValueFrom(service.getAll());
      const bill = all.find((b) => b.id === created.id)!;
      expect(bill.payments.length).toBe(2);
      expect(bill.payments[0].amount).toBe(100000);
      expect(bill.payments[1].amount).toBe(105000);
    });

    it('changing dueDate does not alter existing payment history', async () => {
      const created = await firstValueFrom(
        service.create({
          name: 'Alquiler',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 100000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );

      await firstValueFrom(service.recordPayment(created.id, 100000, 'txn-1', new Date(2026, 0, 6)));
      await firstValueFrom(service.update(created.id, { dueDate: new Date(2026, 0, 15) }));

      const all = await firstValueFrom(service.getAll());
      const bill = all.find((b) => b.id === created.id)!;
      expect(bill.payments.length).toBe(1);
      expect(bill.payments[0].paidDate).toEqual(new Date(2026, 0, 6));
      expect(bill.dueDate).toEqual(new Date(2026, 0, 15));
    });

    it('persists across service instances via localStorage', async () => {
      await firstValueFrom(
        service.create({
          name: 'Persistente',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 1000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );

      const fresh = new BillService();
      const all = await firstValueFrom(fresh.getAll());
      expect(all.some((b) => b.name === 'Persistente')).toBeTrue();
    });

    it('soft-deletes a bill, removing it from getAll but keeping it in storage', async () => {
      const created = await firstValueFrom(
        service.create({
          name: 'Temporal',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 1000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );

      await firstValueFrom(service.delete(created.id));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((b) => b.id === created.id)).toBeUndefined();

      const raw = JSON.parse(localStorage.getItem('bills')!);
      const stored = raw.find((b: { id: string }) => b.id === created.id);
      expect(stored.deletedAt).toBeTruthy();
    });

    it('keeps a soft-deleted tombstone in storage after a subsequent create (regression)', async () => {
      const created = await firstValueFrom(
        service.create({
          name: 'Temporal',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 1000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );
      await firstValueFrom(service.delete(created.id));

      await firstValueFrom(
        service.create({
          name: 'Otra',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 2000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );

      const raw = JSON.parse(localStorage.getItem('bills')!);
      const tombstone = raw.find((b: { id: string }) => b.id === created.id);
      expect(tombstone).toBeTruthy();
      expect(tombstone.deletedAt).toBeTruthy();
    });

    it('exposes tombstones via getAllIncludingDeleted but not via getAll', async () => {
      const created = await firstValueFrom(
        service.create({
          name: 'Temporal',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 1000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );
      await firstValueFrom(service.delete(created.id));

      const active = await firstValueFrom(service.getAll());
      expect(active.find((b) => b.id === created.id)).toBeUndefined();

      const all = service.getAllIncludingDeleted();
      const tombstone = all.find((b) => b.id === created.id);
      expect(tombstone?.deletedAt).toEqual(jasmine.any(Date));
    });

    it('replaceAll persists and emits exactly what is passed', async () => {
      const created = await firstValueFrom(
        service.create({
          name: 'Original',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 1000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );
      const replacement: Bill = { ...created, name: 'Reemplazado' };

      service.replaceAll([replacement]);

      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('Reemplazado');

      const raw = JSON.parse(localStorage.getItem('bills')!);
      expect(raw.length).toBe(1);
      expect(raw[0].name).toBe('Reemplazado');
    });
  });
});

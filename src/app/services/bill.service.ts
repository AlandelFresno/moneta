import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Bill, BillPayment, BillPeriod } from '../core/types/bill.types';

interface StoredBillPayment extends Omit<BillPayment, 'paidDate'> {
  paidDate: string;
}

export interface StoredBill extends Omit<Bill, 'dueDate' | 'endDate' | 'payments' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  dueDate: string;
  endDate?: string;
  payments: StoredBillPayment[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toBill(stored: StoredBill): Bill {
  return {
    ...stored,
    dueDate: new Date(stored.dueDate),
    endDate: stored.endDate ? new Date(stored.endDate) : undefined,
    payments: stored.payments.map((p) => ({ ...p, paidDate: new Date(p.paidDate) })),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromBill(bill: Bill): StoredBill {
  return {
    ...bill,
    dueDate: bill.dueDate.toISOString(),
    endDate: bill.endDate ? bill.endDate.toISOString() : undefined,
    payments: bill.payments.map((p) => ({ ...p, paidDate: p.paidDate.toISOString() })),
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
    deletedAt: bill.deletedAt ? bill.deletedAt.toISOString() : undefined
  };
}

export interface BillDueStatus {
  bill: Bill;
  periodDueDate: Date;
  isOverdue: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BillService {
  private readonly storageKey = 'bills';
  private readonly allSubject = new BehaviorSubject<Bill[]>(this.loadAll());
  readonly bills$: Observable<Bill[]> = this.allSubject.pipe(map((bills) => bills.filter((bill) => !bill.deletedAt)));

  private loadAll(): Bill[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    const stored: StoredBill[] = JSON.parse(raw);
    return stored.map((bill) => toBill(bill));
  }

  private persist(bills: Bill[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(bills.map((bill) => fromBill(bill))));
  }

  getAll(): Observable<Bill[]> {
    return this.bills$;
  }

  getAllIncludingDeleted(): Bill[] {
    return this.allSubject.value;
  }

  replaceAll(bills: Bill[]): void {
    this.persist(bills);
    this.allSubject.next(bills);
  }

  create(bill: Omit<Bill, 'id' | 'payments' | 'createdAt' | 'updatedAt'>): Observable<Bill> {
    const now = new Date();
    const newBill: Bill = {
      ...bill,
      id: this.generateId(),
      payments: [],
      createdAt: now,
      updatedAt: now
    };

    const bills = [...this.allSubject.value, newBill];
    this.persist(bills);
    this.allSubject.next(bills);

    return new Observable((subscriber) => {
      subscriber.next(newBill);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Bill, 'id' | 'payments' | 'createdAt'>>): Observable<void> {
    const bills = this.allSubject.value.map((bill) =>
      bill.id === id ? { ...bill, ...updates, updatedAt: new Date() } : bill
    );
    this.persist(bills);
    this.allSubject.next(bills);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const now = new Date();
    const bills = this.allSubject.value.map((bill) =>
      bill.id === id ? { ...bill, deletedAt: now, updatedAt: now } : bill
    );
    this.persist(bills);
    this.allSubject.next(bills);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  recordPayment(id: string, amount: number, transactionId: string, paidDate: Date): Observable<void> {
    const payment: BillPayment = {
      id: this.generateId(),
      paidDate,
      amount,
      transactionId
    };

    const bills = this.allSubject.value.map((bill) =>
      bill.id === id ? { ...bill, payments: [...bill.payments, payment], updatedAt: new Date() } : bill
    );
    this.persist(bills);
    this.allSubject.next(bills);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /**
   * The due date for the period containing `now`, derived from the bill's anchor `dueDate`.
   * If the anchor's first occurrence hasn't happened yet (anchor is still in the future),
   * that first occurrence is returned as-is — recurrence only starts once it's passed.
   */
  currentPeriodDueDate(bill: Bill, now: Date): Date {
    const anchor = new Date(bill.dueDate.getFullYear(), bill.dueDate.getMonth(), bill.dueDate.getDate());
    if (anchor.getTime() > now.getTime()) {
      return anchor;
    }

    if (bill.period === 'weekly') {
      const targetDay = bill.dueDate.getDay();
      const diff = now.getDay() - targetDay;
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    if (bill.period === 'monthly') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const day = Math.min(bill.dueDate.getDate(), daysInMonth);
      return new Date(now.getFullYear(), now.getMonth(), day);
    }

    // yearly: same month+day, this year
    return new Date(now.getFullYear(), bill.dueDate.getMonth(), bill.dueDate.getDate());
  }

  /** Next unpaid due date at or after `now` — the current period's date if still unpaid, otherwise the following period. */
  nextDueDate(bill: Bill, now: Date): Date {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const current = this.currentPeriodDueDate(bill, now);

    if (current.getTime() >= today.getTime() && !this.isPaidForPeriod(bill, current)) {
      return current;
    }
    if (!this.isPaidForPeriod(bill, current) && current.getTime() < today.getTime()) {
      return current;
    }

    return this.advancePeriod(bill, current);
  }

  private advancePeriod(bill: Bill, from: Date): Date {
    if (bill.period === 'weekly') {
      return new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    }
    if (bill.period === 'monthly') {
      const daysInNextMonth = new Date(from.getFullYear(), from.getMonth() + 2, 0).getDate();
      const day = Math.min(bill.dueDate.getDate(), daysInNextMonth);
      return new Date(from.getFullYear(), from.getMonth() + 1, day);
    }
    return new Date(from.getFullYear() + 1, from.getMonth(), from.getDate());
  }

  isPaidForPeriod(bill: Bill, periodDueDate: Date): boolean {
    return bill.payments.some((payment) => this.isSamePeriod(bill.period, payment.paidDate, periodDueDate));
  }

  private isSamePeriod(period: BillPeriod, a: Date, b: Date): boolean {
    if (period === 'yearly') {
      return a.getFullYear() === b.getFullYear();
    }
    if (period === 'monthly') {
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    }
    const weekOf = (d: Date) => Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000));
    return weekOf(a) === weekOf(b);
  }

  /** True once a bill's end date has passed or all its installments have been paid. */
  isFinished(bill: Bill, now: Date): boolean {
    if (bill.endDate !== undefined && now.getTime() > bill.endDate.getTime()) return true;
    if (bill.totalInstallments !== undefined && bill.payments.length >= bill.totalInstallments) return true;
    return false;
  }

  /** Active, not-finished bills whose current period is due (today or earlier) and not yet paid this period. */
  dueStatuses(bills: Bill[], now: Date): BillDueStatus[] {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

    return bills
      .filter((bill) => bill.active && !this.isFinished(bill, now))
      // Anchor date itself hasn't arrived yet — don't apply the recurring day-of-month/week/year
      // pattern retroactively to periods before the bill's own first occurrence existed.
      .filter((bill) => startOfDay(bill.dueDate).getTime() <= today.getTime())
      .map((bill) => {
        const periodDueDate = this.currentPeriodDueDate(bill, now);
        return { bill, periodDueDate };
      })
      .filter(({ bill, periodDueDate }) => periodDueDate.getTime() <= today.getTime() && !this.isPaidForPeriod(bill, periodDueDate))
      .map(({ bill, periodDueDate }) => ({
        bill,
        periodDueDate,
        isOverdue: periodDueDate.getTime() < today.getTime()
      }));
  }

  /** Active, not-finished bills with a next unpaid due date within `days` from now (inclusive), soonest first. */
  upcomingBills(bills: Bill[], now: Date, days: number): BillDueStatus[] {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);

    return bills
      .filter((bill) => bill.active && !this.isFinished(bill, now))
      .map((bill) => ({ bill, periodDueDate: this.nextDueDate(bill, now) }))
      .filter(({ periodDueDate }) => periodDueDate.getTime() <= horizon.getTime())
      .map(({ bill, periodDueDate }) => ({
        bill,
        periodDueDate,
        isOverdue: periodDueDate.getTime() < today.getTime()
      }))
      .sort((a, b) => a.periodDueDate.getTime() - b.periodDueDate.getTime());
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

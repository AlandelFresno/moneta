import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Bill, BillPayment, BillPeriod } from '../core/types/bill.types';

interface StoredBillPayment extends Omit<BillPayment, 'paidDate'> {
  paidDate: string;
}

interface StoredBill extends Omit<Bill, 'dueDate' | 'payments' | 'createdAt' | 'updatedAt'> {
  dueDate: string;
  payments: StoredBillPayment[];
  createdAt: string;
  updatedAt: string;
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
  private readonly billsSubject = new BehaviorSubject<Bill[]>(this.loadFromStorage());
  readonly bills$: Observable<Bill[]> = this.billsSubject.asObservable();

  private loadFromStorage(): Bill[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    const stored: StoredBill[] = JSON.parse(raw);
    return stored.map((bill) => this.toBill(bill));
  }

  private toBill(stored: StoredBill): Bill {
    return {
      ...stored,
      dueDate: new Date(stored.dueDate),
      payments: stored.payments.map((p) => ({ ...p, paidDate: new Date(p.paidDate) })),
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt)
    };
  }

  private persist(bills: Bill[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(bills));
  }

  getAll(): Observable<Bill[]> {
    return this.bills$;
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

    const bills = [...this.billsSubject.value, newBill];
    this.persist(bills);
    this.billsSubject.next(bills);

    return new Observable((subscriber) => {
      subscriber.next(newBill);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Bill, 'id' | 'payments' | 'createdAt'>>): Observable<void> {
    const bills = this.billsSubject.value.map((bill) =>
      bill.id === id ? { ...bill, ...updates, updatedAt: new Date() } : bill
    );
    this.persist(bills);
    this.billsSubject.next(bills);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const bills = this.billsSubject.value.filter((bill) => bill.id !== id);
    this.persist(bills);
    this.billsSubject.next(bills);

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

    const bills = this.billsSubject.value.map((bill) =>
      bill.id === id ? { ...bill, payments: [...bill.payments, payment], updatedAt: new Date() } : bill
    );
    this.persist(bills);
    this.billsSubject.next(bills);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /** The due date for the period containing `now`, derived from the bill's anchor `dueDate`. */
  currentPeriodDueDate(bill: Bill, now: Date): Date {
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

  /** Active bills whose current period is due (today or earlier) and not yet paid this period. */
  dueStatuses(bills: Bill[], now: Date): BillDueStatus[] {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return bills
      .filter((bill) => bill.active)
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

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

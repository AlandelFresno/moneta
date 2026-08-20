import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Transaction, TransactionType } from '../core/types/transaction.types';
import { AccountService } from './account.service';

export interface StoredTransaction extends Omit<Transaction, 'date' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toTransaction(stored: StoredTransaction): Transaction {
  return {
    ...stored,
    date: new Date(stored.date),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromTransaction(txn: Transaction): StoredTransaction {
  return {
    ...txn,
    date: txn.date.toISOString(),
    createdAt: txn.createdAt.toISOString(),
    updatedAt: txn.updatedAt.toISOString(),
    deletedAt: txn.deletedAt ? txn.deletedAt.toISOString() : undefined
  };
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly storageKey = 'transactions';
  private readonly allSubject = new BehaviorSubject<Transaction[]>(this.loadAll());
  readonly transactions$: Observable<Transaction[]> = this.allSubject.pipe(
    map((transactions) => transactions.filter((txn) => !txn.deletedAt))
  );

  constructor(private readonly accountService: AccountService) {}

  private loadAll(): Transaction[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    const stored: StoredTransaction[] = JSON.parse(raw);
    return stored.map((txn) => toTransaction(txn));
  }

  private persist(transactions: Transaction[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(transactions.map((txn) => fromTransaction(txn))));
  }

  getAll(): Observable<Transaction[]> {
    return this.transactions$;
  }

  getAllIncludingDeleted(): Transaction[] {
    return this.allSubject.value;
  }

  replaceAll(transactions: Transaction[]): void {
    this.persist(transactions);
    this.allSubject.next(transactions);
  }

  getByCategory(categoryId: string): Observable<Transaction[]> {
    return new Observable((subscriber) =>
      this.transactions$.subscribe((transactions) => {
        subscriber.next(transactions.filter((txn) => txn.categoryId === categoryId));
      })
    );
  }

  getByType(type: TransactionType): Observable<Transaction[]> {
    return new Observable((subscriber) =>
      this.transactions$.subscribe((transactions) => {
        subscriber.next(transactions.filter((txn) => txn.type === type));
      })
    );
  }

  getByDateRange(startDate: Date, endDate: Date): Observable<Transaction[]> {
    return new Observable((subscriber) =>
      this.transactions$.subscribe((transactions) => {
        subscriber.next(transactions.filter((txn) => txn.date >= startDate && txn.date <= endDate));
      })
    );
  }

  create(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Observable<Transaction> {
    const now = new Date();
    const newTransaction: Transaction = {
      ...transaction,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    const transactions = [...this.allSubject.value, newTransaction];
    this.persist(transactions);
    this.allSubject.next(transactions);

    if (newTransaction.accountId) {
      this.accountService.adjustBalance(newTransaction.accountId, this.signedDelta(newTransaction));
    }

    return new Observable((subscriber) => {
      subscriber.next(newTransaction);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Observable<void> {
    const existing = this.allSubject.value.find((txn) => txn.id === id);
    const transactions = this.allSubject.value.map((txn) =>
      txn.id === id ? { ...txn, ...updates, updatedAt: new Date() } : txn
    );
    this.persist(transactions);
    this.allSubject.next(transactions);

    if (existing) {
      const updated = transactions.find((txn) => txn.id === id)!;
      if (existing.accountId) {
        this.accountService.adjustBalance(existing.accountId, -this.signedDelta(existing));
      }
      if (updated.accountId) {
        this.accountService.adjustBalance(updated.accountId, this.signedDelta(updated));
      }
    }

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const now = new Date();
    const existing = this.allSubject.value.find((txn) => txn.id === id);
    const transactions = this.allSubject.value.map((txn) =>
      txn.id === id ? { ...txn, deletedAt: now, updatedAt: now } : txn
    );
    this.persist(transactions);
    this.allSubject.next(transactions);

    if (existing?.accountId && !existing.deletedAt) {
      this.accountService.adjustBalance(existing.accountId, -this.signedDelta(existing));
    }

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  private signedDelta(txn: Pick<Transaction, 'type' | 'amount'>): number {
    return txn.type === 'income' ? txn.amount : -txn.amount;
  }

  getTotalIncome(startDate?: Date, endDate?: Date): number {
    return this.sumByType('income', startDate, endDate);
  }

  getTotalExpense(startDate?: Date, endDate?: Date): number {
    return this.sumByType('expense', startDate, endDate);
  }

  private sumByType(type: TransactionType, startDate?: Date, endDate?: Date): number {
    let transactions = this.allSubject.value.filter((txn) => !txn.deletedAt && txn.type === type);
    if (startDate && endDate) {
      transactions = transactions.filter((txn) => txn.date >= startDate && txn.date <= endDate);
    }
    return transactions.reduce((sum, txn) => sum + txn.amount, 0);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

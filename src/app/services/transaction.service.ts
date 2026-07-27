import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Transaction, TransactionType } from '../core/types/transaction.types';

interface StoredTransaction extends Omit<Transaction, 'date' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly storageKey = 'transactions';
  private readonly transactionsSubject = new BehaviorSubject<Transaction[]>(this.loadFromStorage());
  readonly transactions$: Observable<Transaction[]> = this.transactionsSubject.asObservable();

  private loadFromStorage(): Transaction[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    const stored: StoredTransaction[] = JSON.parse(raw);
    return stored
      .filter((txn) => !txn.deletedAt)
      .map((txn) => this.toTransaction(txn));
  }

  private toTransaction(stored: StoredTransaction): Transaction {
    return {
      ...stored,
      date: new Date(stored.date),
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
      deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
    };
  }

  private persist(transactions: Transaction[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(transactions));
  }

  getAll(): Observable<Transaction[]> {
    return this.transactions$;
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

    const transactions = [...this.transactionsSubject.value, newTransaction];
    this.persist(transactions);
    this.transactionsSubject.next(transactions);

    return new Observable((subscriber) => {
      subscriber.next(newTransaction);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Observable<void> {
    const transactions = this.transactionsSubject.value.map((txn) =>
      txn.id === id ? { ...txn, ...updates, updatedAt: new Date() } : txn
    );
    this.persist(transactions);
    this.transactionsSubject.next(transactions);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const raw = localStorage.getItem(this.storageKey);
    const stored: StoredTransaction[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    const updated = stored.map((txn) => (txn.id === id ? { ...txn, deletedAt: now, updatedAt: now } : txn));
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
    this.transactionsSubject.next(this.transactionsSubject.value.filter((txn) => txn.id !== id));

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  getTotalIncome(startDate?: Date, endDate?: Date): number {
    return this.sumByType('income', startDate, endDate);
  }

  getTotalExpense(startDate?: Date, endDate?: Date): number {
    return this.sumByType('expense', startDate, endDate);
  }

  private sumByType(type: TransactionType, startDate?: Date, endDate?: Date): number {
    let transactions = this.transactionsSubject.value.filter((txn) => txn.type === type);
    if (startDate && endDate) {
      transactions = transactions.filter((txn) => txn.date >= startDate && txn.date <= endDate);
    }
    return transactions.reduce((sum, txn) => sum + txn.amount, 0);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

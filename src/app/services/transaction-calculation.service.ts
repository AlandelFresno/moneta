import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { TransactionCalculation } from '../core/types/transaction-calculation.types';

export interface StoredTransactionCalculation extends Omit<TransactionCalculation, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toTransactionCalculation(stored: StoredTransactionCalculation): TransactionCalculation {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromTransactionCalculation(calculation: TransactionCalculation): StoredTransactionCalculation {
  return {
    ...calculation,
    createdAt: calculation.createdAt.toISOString(),
    updatedAt: calculation.updatedAt.toISOString(),
    deletedAt: calculation.deletedAt ? calculation.deletedAt.toISOString() : undefined
  };
}

@Injectable({
  providedIn: 'root'
})
export class TransactionCalculationService {
  private readonly storageKey = 'transaction_calculations';
  private readonly allSubject = new BehaviorSubject<TransactionCalculation[]>(this.loadAll());
  readonly calculations$: Observable<TransactionCalculation[]> = this.allSubject.pipe(
    map((calculations) => calculations.filter((calc) => !calc.deletedAt))
  );

  private loadAll(): TransactionCalculation[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];
    const stored: StoredTransactionCalculation[] = JSON.parse(raw);
    return stored.map((calc) => toTransactionCalculation(calc));
  }

  private persist(calculations: TransactionCalculation[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(calculations.map((calc) => fromTransactionCalculation(calc))));
  }

  getAll(): Observable<TransactionCalculation[]> {
    return this.calculations$;
  }

  getAllIncludingDeleted(): TransactionCalculation[] {
    return this.allSubject.value;
  }

  replaceAll(calculations: TransactionCalculation[]): void {
    this.persist(calculations);
    this.allSubject.next(calculations);
  }

  getForTransaction(transactionId: string): Observable<TransactionCalculation[]> {
    return new Observable((subscriber) =>
      this.calculations$.subscribe((calculations) => {
        subscriber.next(calculations.filter((calc) => calc.transactionId === transactionId));
      })
    );
  }

  create(calculation: Omit<TransactionCalculation, 'id' | 'createdAt' | 'updatedAt'>): Observable<TransactionCalculation> {
    const now = new Date();
    const newCalculation: TransactionCalculation = {
      ...calculation,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    const calculations = [...this.allSubject.value, newCalculation];
    this.persist(calculations);
    this.allSubject.next(calculations);

    return new Observable((subscriber) => {
      subscriber.next(newCalculation);
      subscriber.complete();
    });
  }

  /** Soft-deletes every calculation tied to a transaction — used when the transaction itself is deleted. No-op if there are none. */
  deleteForTransaction(transactionId: string): Observable<void> {
    const now = new Date();
    const calculations = this.allSubject.value.map((calc) =>
      calc.transactionId === transactionId && !calc.deletedAt ? { ...calc, deletedAt: now, updatedAt: now } : calc
    );
    this.persist(calculations);
    this.allSubject.next(calculations);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

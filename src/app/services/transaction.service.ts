import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, lastValueFrom } from 'rxjs';
import { NestedCounting, NestedEffect, Transaction, TransactionType } from '../core/types/transaction.types';
import { AccountService } from './account.service';
import { TransactionCalculationService } from './transaction-calculation.service';
import { periodStart } from '../core/utils/period.util';
import { SplitLine, validSplitLines } from '../core/utils/split-lines.util';
import { LineItemInput, validLineItems, hasIncompleteLineItem } from '../core/utils/line-items.util';
import { effectiveTransactions } from '../core/utils/transaction-nesting.util';

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

export interface NestedChildInput {
  id: string | null;
  categoryId: string;
  name: string;
  description: string;
  amount: number | null;
  effect: NestedEffect;
  date: Date;
}

export interface TransactionFormInput {
  id: string | null;
  categoryId: string;
  accountId: string | null;
  type: TransactionType;
  name: string;
  description: string;
  amount: number | null;
  date: Date;
  isSplit: boolean;
  splitGroupId: string | null;
  splitLines: SplitLine[];
  calculatorExpression: string | null;
  isPeriodStart: boolean;
  items: LineItemInput[];
  nestedCounting: NestedCounting;
  children: NestedChildInput[];
}

export type TransactionSaveOutcome =
  | { status: 'invalid'; detail: string }
  | { status: 'saved'; summary: string; transactionId: string };

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly storageKey = 'transactions';
  private readonly allSubject = new BehaviorSubject<Transaction[]>(this.loadAll());
  /** Every active record, children included — what the transactions list renders. */
  readonly nested$: Observable<Transaction[]> = this.allSubject.pipe(
    map((transactions) => transactions.filter((txn) => !txn.deletedAt))
  );
  /** Active records as aggregates should count them (see effectiveTransactions). */
  readonly transactions$: Observable<Transaction[]> = this.nested$.pipe(map((transactions) => effectiveTransactions(transactions)));

  constructor(
    private readonly accountService: AccountService,
    private readonly transactionCalculationService: TransactionCalculationService
  ) {}

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

  getAllNested(): Observable<Transaction[]> {
    return this.nested$;
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
    this.commit(transactions);

    return new Observable((subscriber) => {
      subscriber.next(newTransaction);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Observable<void> {
    const transactions = this.allSubject.value.map((txn) =>
      txn.id === id ? { ...txn, ...updates, updatedAt: new Date() } : txn
    );
    this.commit(transactions);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const now = new Date();
    const transactions = this.allSubject.value.map((txn) =>
      txn.id === id || txn.parentId === id ? { ...txn, deletedAt: txn.deletedAt ?? now, updatedAt: now } : txn
    );
    this.commit(transactions);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /** Soft-deletes every given id in one pass — one persist/emit instead of one per id. */
  deleteMany(ids: string[]): Observable<void> {
    const idSet = new Set(ids);
    const now = new Date();
    const transactions = this.allSubject.value.map((txn) =>
      idSet.has(txn.id) || (txn.parentId && idSet.has(txn.parentId)) ? { ...txn, deletedAt: txn.deletedAt ?? now, updatedAt: now } : txn
    );
    this.commit(transactions);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /** Recategorizes every given id in one pass. Never touches account balances — categoryId doesn't affect signedDelta. */
  updateCategoryMany(ids: string[], categoryId: string): Observable<void> {
    const idSet = new Set(ids);
    const now = new Date();
    const transactions = this.allSubject.value.map((txn) => (idSet.has(txn.id) ? { ...txn, categoryId, updatedAt: now } : txn));
    this.persist(transactions);
    this.allSubject.next(transactions);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /** Validates and saves a transaction form (single or split), including calculator-expression persistence and period-marker conflict resolution. Returns why it was rejected, or the toast summary to show on success. */
  async saveFromForm(form: TransactionFormInput, periodStartDay: number): Promise<TransactionSaveOutcome> {
    if (!form.name) {
      return { status: 'invalid', detail: 'Ingresá un nombre' };
    }

    if (form.isSplit) {
      return this.saveSplitFromForm(form);
    }

    if (!form.categoryId || form.amount === null || form.amount <= 0) {
      return { status: 'invalid', detail: 'Completá categoría, nombre y un monto válido' };
    }

    const children = form.children.filter((child) => child.categoryId || child.name || child.amount !== null);
    if (children.some((child) => !child.categoryId || !child.name || child.amount === null || child.amount <= 0)) {
      return { status: 'invalid', detail: 'Completá nombre, categoría y un monto válido en cada sub-transacción' };
    }
    if (hasIncompleteLineItem(form.items)) {
      return { status: 'invalid', detail: 'Completá nombre y un monto válido en cada ítem' };
    }
    const net = children.reduce((sum, child) => sum + (child.effect === 'subtract' ? -child.amount! : child.amount!), form.amount);
    if (net <= 0) {
      return { status: 'invalid', detail: 'El total con las sub-transacciones debe ser mayor a 0' };
    }

    let formId = form.id;
    // Editing a transaction that used to be split, now saved as a single line: drop the old group first.
    if (form.splitGroupId) {
      const oldIds = this.activeTransactions()
        .filter((t) => t.splitGroupId === form.splitGroupId)
        .map((t) => t.id);
      await lastValueFrom(this.deleteMany(oldIds));
      formId = null;
    }

    const payload = {
      categoryId: form.categoryId,
      accountId: form.accountId ?? undefined,
      type: form.type,
      name: form.name,
      description: form.description,
      amount: form.amount,
      date: form.date,
      isPeriodStart: form.isPeriodStart,
      items: this.itemsOrUndefined(form.items),
      nestedCounting: children.length > 0 ? form.nestedCounting : undefined
    };

    let transactionId: string;
    let summary: string;
    if (formId) {
      await lastValueFrom(this.update(formId, payload));
      transactionId = formId;
      summary = 'Transacción actualizada';
    } else {
      const created = await lastValueFrom(this.create(payload));
      transactionId = created.id;
      summary = 'Transacción creada';
    }

    await this.syncChildren(transactionId, form, children);

    if (form.calculatorExpression) {
      await lastValueFrom(
        this.transactionCalculationService.create({
          transactionId,
          expression: form.calculatorExpression,
          result: form.amount
        })
      );
    }

    if (form.isPeriodStart) {
      await this.clearConflictingPeriodMarkers(form.date, transactionId, periodStartDay);
    }

    return { status: 'saved', summary, transactionId };
  }

  private itemsOrUndefined(inputs: LineItemInput[]): Transaction['items'] {
    const items = validLineItems(inputs);
    return items.length > 0 ? items : undefined;
  }

  private async syncChildren(parentId: string, form: TransactionFormInput, children: NestedChildInput[]): Promise<void> {
    const kept = new Set(children.map((child) => child.id).filter((id): id is string => id !== null));
    const removed = this.activeTransactions()
      .filter((txn) => txn.parentId === parentId && !kept.has(txn.id))
      .map((txn) => txn.id);
    if (removed.length > 0) await lastValueFrom(this.deleteMany(removed));

    for (const child of children) {
      const payload = {
        categoryId: child.categoryId,
        accountId: form.accountId ?? undefined,
        type: form.type,
        name: child.name,
        description: child.description,
        amount: child.amount!,
        date: child.date,
        parentId,
        parentEffect: child.effect
      };
      if (child.id) await lastValueFrom(this.update(child.id, payload));
      else await lastValueFrom(this.create(payload));
    }
  }

  private async saveSplitFromForm(form: TransactionFormInput): Promise<TransactionSaveOutcome> {
    const validLines = validSplitLines(form.splitLines);
    if (validLines.length < 2) {
      return { status: 'invalid', detail: 'Agregá al menos 2 líneas con categoría y monto' };
    }

    const isUpdate = form.splitGroupId !== null || form.id !== null;

    if (form.splitGroupId) {
      const oldIds = this.activeTransactions()
        .filter((t) => t.splitGroupId === form.splitGroupId)
        .map((t) => t.id);
      await lastValueFrom(this.deleteMany(oldIds));
    } else if (form.id) {
      await lastValueFrom(this.delete(form.id));
      await lastValueFrom(this.transactionCalculationService.deleteForTransaction(form.id));
    }

    const groupId = form.splitGroupId ?? this.generateSplitGroupId();
    for (const line of validLines) {
      await lastValueFrom(
        this.create({
          categoryId: line.categoryId,
          accountId: form.accountId ?? undefined,
          type: form.type,
          name: form.name,
          description: form.description,
          amount: line.amount!,
          date: form.date,
          splitGroupId: groupId
        })
      );
    }

    return { status: 'saved', summary: isUpdate ? 'Transacción actualizada' : 'Transacción dividida creada', transactionId: groupId };
  }

  private activeTransactions(): Transaction[] {
    return this.allSubject.value.filter((txn) => !txn.deletedAt);
  }

  /** At most one active period-start marker per nominal period bucket — re-marking a transaction clears any other one already marked for the same period. */
  private async clearConflictingPeriodMarkers(date: Date, keepId: string, startDay: number): Promise<void> {
    const bucket = periodStart(date, startDay).getTime();
    const conflicts = this.activeTransactions().filter(
      (t) => t.isPeriodStart && t.id !== keepId && periodStart(t.date, startDay).getTime() === bucket
    );
    for (const conflict of conflicts) {
      await lastValueFrom(this.update(conflict.id, { isPeriodStart: false }));
    }
  }

  private generateSplitGroupId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /** Persists `next` and applies to account balances exactly the difference between what the old and new records contribute. */
  private commit(next: Transaction[]): void {
    const before = this.accountImpact(this.allSubject.value);
    const after = this.accountImpact(next);
    this.persist(next);
    this.allSubject.next(next);

    for (const accountId of new Set([...before.keys(), ...after.keys()])) {
      const delta = (after.get(accountId) ?? 0) - (before.get(accountId) ?? 0);
      if (delta !== 0) this.accountService.adjustBalance(accountId, delta);
    }
  }

  private accountImpact(transactions: Transaction[]): Map<string, number> {
    const impact = new Map<string, number>();
    for (const txn of effectiveTransactions(transactions.filter((t) => !t.deletedAt))) {
      if (!txn.accountId) continue;
      const signed = txn.type === 'income' ? txn.amount : -txn.amount;
      impact.set(txn.accountId, (impact.get(txn.accountId) ?? 0) + signed);
    }
    return impact;
  }

  getTotalIncome(startDate?: Date, endDate?: Date): number {
    return this.sumByType('income', startDate, endDate);
  }

  getTotalExpense(startDate?: Date, endDate?: Date): number {
    return this.sumByType('expense', startDate, endDate);
  }

  private sumByType(type: TransactionType, startDate?: Date, endDate?: Date): number {
    let transactions = effectiveTransactions(this.activeTransactions()).filter((txn) => txn.type === type);
    if (startDate && endDate) {
      transactions = transactions.filter((txn) => txn.date >= startDate && txn.date <= endDate);
    }
    return transactions.reduce((sum, txn) => sum + txn.amount, 0);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

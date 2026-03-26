import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Transaction } from '../models';
import { AccountService } from './account.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private readonly STORAGE_KEY = 'budget_transactions';
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();

  constructor(private accountService: AccountService) {
    this.loadTransactions();
  }

  private loadTransactions(): void {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      const transactions = JSON.parse(data).map((txn: any) => ({
        ...txn,
        date: new Date(txn.date),
        createdAt: new Date(txn.createdAt),
        updatedAt: new Date(txn.updatedAt),
        deletedAt: txn.deletedAt ? new Date(txn.deletedAt) : undefined
      })).filter((txn: any) => !txn.deletedAt);
      this.transactionsSubject.next(transactions);
    }
  }

  private saveTransactions(transactions: Transaction[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(transactions));
    this.transactionsSubject.next(transactions);
  }

  getTransactions(): Transaction[] {
    return this.transactionsSubject.value;
  }

  getTransactionById(id: string): Transaction | undefined {
    return this.transactionsSubject.value.find(txn => txn.id === id);
  }

  getTransactionsByAccount(accountId: string): Transaction[] {
    return this.transactionsSubject.value.filter(txn => txn.accountId === accountId);
  }

  getTransactionsByCategory(categoryId: string): Transaction[] {
    return this.transactionsSubject.value.filter(txn => txn.categoryId === categoryId);
  }

  getTransactionsByType(type: 'income' | 'expense'): Transaction[] {
    return this.transactionsSubject.value.filter(txn => txn.type === type);
  }

  getTransactionsByDateRange(startDate: Date, endDate: Date): Transaction[] {
    return this.transactionsSubject.value.filter(txn => {
      const date = new Date(txn.date);
      return date >= startDate && date <= endDate;
    });
  }

  createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Transaction {
    const newTransaction: Transaction = {
      ...transaction,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const transactions = [...this.transactionsSubject.value, newTransaction];
    this.saveTransactions(transactions);

    // Update account balance with currency conversion
    const amount = transaction.type === 'income' ? transaction.amount : -transaction.amount;
    this.accountService.updateBalance(transaction.accountId, amount, transaction.currency);

    return newTransaction;
  }

  updateTransaction(id: string, updates: Partial<Transaction>): void {
    const oldTransaction = this.getTransactionById(id);
    if (!oldTransaction) return;

    // Revert old balance change with original currency
    const oldAmount = oldTransaction.type === 'income' ? -oldTransaction.amount : oldTransaction.amount;
    this.accountService.updateBalance(oldTransaction.accountId, oldAmount, oldTransaction.currency);

    const transactions = this.transactionsSubject.value.map(txn =>
      txn.id === id
        ? { ...txn, ...updates, updatedAt: new Date() }
        : txn
    );
    this.saveTransactions(transactions);

    // Apply new balance change with updated currency
    const updatedTransaction = transactions.find(t => t.id === id)!;
    const newAmount = updatedTransaction.type === 'income' ? updatedTransaction.amount : -updatedTransaction.amount;
    this.accountService.updateBalance(updatedTransaction.accountId, newAmount, updatedTransaction.currency);
  }

  deleteTransaction(id: string): void {
    const transaction = this.getTransactionById(id);
    if (!transaction) return;

    // Revert balance change with transaction currency
    const amount = transaction.type === 'income' ? -transaction.amount : transaction.amount;
    this.accountService.updateBalance(transaction.accountId, amount, transaction.currency);

    const stored = localStorage.getItem(this.STORAGE_KEY);
    const all = stored ? JSON.parse(stored) : [];
    const updated = all.map((txn: any) =>
      txn.id === id ? { ...txn, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : txn
    );
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    this.transactionsSubject.next(this.transactionsSubject.value.filter(txn => txn.id !== id));
  }

  getTotalIncome(startDate?: Date, endDate?: Date): number {
    let transactions = this.getTransactionsByType('income');
    if (startDate && endDate) {
      transactions = transactions.filter(txn => {
        const date = new Date(txn.date);
        return date >= startDate && date <= endDate;
      });
    }
    return transactions.reduce((sum, txn) => sum + txn.amount, 0);
  }

  getTotalExpense(startDate?: Date, endDate?: Date): number {
    let transactions = this.getTransactionsByType('expense');
    if (startDate && endDate) {
      transactions = transactions.filter(txn => {
        const date = new Date(txn.date);
        return date >= startDate && date <= endDate;
      });
    }
    return transactions.reduce((sum, txn) => sum + txn.amount, 0);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

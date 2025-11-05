import { Injectable, signal } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { Budget } from '../models/budget.model';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private transactions = signal<Transaction[]>([]);
  private budgets = signal<Budget[]>([]);

  // Getters
  getTransactions = this.transactions.asReadonly();
  getBudgets = this.budgets.asReadonly();

  // Add transaction
  addTransaction(transaction: Omit<Transaction, 'id'>) {
    const newTransaction: Transaction = {
      ...transaction,
      id: crypto.randomUUID()
    };
    this.transactions.update(transactions => [...transactions, newTransaction]);
  }

  // Delete transaction
  deleteTransaction(id: string) {
    this.transactions.update(transactions =>
      transactions.filter(t => t.id !== id)
    );
  }

  // Add budget
  addBudget(budget: Omit<Budget, 'id' | 'spent'>) {
    const newBudget: Budget = {
      ...budget,
      id: crypto.randomUUID(),
      spent: 0
    };
    this.budgets.update(budgets => [...budgets, newBudget]);
  }

  // Calculate total income
  getTotalIncome(): number {
    return this.transactions().reduce((total, t) =>
      t.type === 'income' ? total + t.amount : total, 0
    );
  }

  // Calculate total expenses
  getTotalExpenses(): number {
    return this.transactions().reduce((total, t) =>
      t.type === 'expense' ? total + t.amount : total, 0
    );
  }

  // Get balance
  getBalance(): number {
    return this.getTotalIncome() - this.getTotalExpenses();
  }
}

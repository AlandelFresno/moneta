import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Budget } from '../models/budget.model';
import { Transaction } from '../models/transaction.model';
import { TransactionService } from './transaction.service';
import { ExchangeRateService } from './exchange-rate.service';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private readonly STORAGE_KEY = 'budgets';
  private budgetsSubject = new BehaviorSubject<Budget[]>([]);
  public budgets$ = this.budgetsSubject.asObservable();

  constructor(
    private transactionService: TransactionService,
    private exchangeRateService: ExchangeRateService
  ) {
    this.loadBudgets();
  }

  private loadBudgets(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const budgets = JSON.parse(stored, (key, value) => {
          if (key === 'startDate' || key === 'endDate' || key === 'createdAt' || key === 'updatedAt') {
            return value ? new Date(value) : undefined;
          }
          return value;
        });
        this.budgetsSubject.next(budgets);
      } catch (error) {
        console.error('Error loading budgets:', error);
        this.budgetsSubject.next([]);
      }
    }
  }

  private saveBudgets(budgets: Budget[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(budgets));
    this.budgetsSubject.next(budgets);
  }

  getBudgets(): Budget[] {
    return this.budgetsSubject.getValue();
  }

  getBudgetById(id: string): Budget | undefined {
    return this.budgetsSubject.getValue().find(b => b.id === id);
  }

  getBudgetsByCategory(categoryId: string): Budget[] {
    return this.budgetsSubject.getValue().filter(b => b.categoryId === categoryId);
  }

  addBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Budget {
    const newBudget: Budget = {
      ...budget,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const budgets = [...this.budgetsSubject.getValue(), newBudget];
    this.saveBudgets(budgets);
    return newBudget;
  }

  updateBudget(id: string, updates: Partial<Omit<Budget, 'id' | 'createdAt'>>): boolean {
    const budgets = this.budgetsSubject.getValue();
    const index = budgets.findIndex(b => b.id === id);

    if (index === -1) return false;

    budgets[index] = {
      ...budgets[index],
      ...updates,
      updatedAt: new Date()
    };

    this.saveBudgets(budgets);
    return true;
  }

  deleteBudget(id: string): boolean {
    const budgets = this.budgetsSubject.getValue().filter(b => b.id !== id);
    this.saveBudgets(budgets);
    return true;
  }

  /**
   * Calcula el gasto actual para un presupuesto en el período especificado
   */
  calculateSpent(budget: Budget): number {
    const { startDate, endDate } = this.getPeriodDates(budget);
    const transactions = this.transactionService.getTransactions();

    // Filtrar transacciones por categoría, tipo expense y período
    const relevantTransactions = transactions.filter(t => {
      if (t.categoryId !== budget.categoryId) return false;
      if (t.type !== 'expense') return false;

      const txDate = new Date(t.date);
      return txDate >= startDate && txDate <= endDate;
    });

    // Sumar los gastos, convirtiendo a la moneda del presupuesto
    let total = 0;
    for (const transaction of relevantTransactions) {
      if (transaction.currency === budget.currency) {
        // Misma moneda, sumar directamente
        total += transaction.amount;
      } else {
        // Convertir usando el servicio de conversión (usa las tasas actuales en caché)
        const converted = this.exchangeRateService.convertToPreferredCurrency(
          transaction.amount,
          transaction.currency,
          budget.currency
        );
        total += converted;
      }
    }

    return total;
  }

  /**
   * Obtiene las fechas de inicio y fin del período de un presupuesto
   */
  private getPeriodDates(budget: Budget): { startDate: Date; endDate: Date } {
    const now = new Date();

    if (budget.startDate && budget.endDate) {
      // Usar fechas personalizadas si existen
      return {
        startDate: new Date(budget.startDate),
        endDate: new Date(budget.endDate)
      };
    }

    let startDate: Date;
    let endDate: Date;

    switch (budget.period) {
      case 'weekly':
        // Inicio de la semana (lunes)
        startDate = new Date(now);
        const day = startDate.getDay();
        const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);

        // Fin de la semana (domingo)
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'monthly':
        // Inicio del mes
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);

        // Fin del mes
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'yearly':
        // Inicio del año
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);

        // Fin del año
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        startDate = new Date(now);
        endDate = new Date(now);
    }

    return { startDate, endDate };
  }

  /**
   * Calcula el porcentaje gastado de un presupuesto
   */
  getSpentPercentage(budget: Budget): number {
    const spent = this.calculateSpent(budget);
    if (budget.limit === 0) return 0;
    return (spent / budget.limit) * 100;
  }

  /**
   * Verifica si un presupuesto está cerca del límite (basado en alertThreshold)
   */
  isNearLimit(budget: Budget): boolean {
    if (!budget.alertThreshold) return false;
    const percentage = this.getSpentPercentage(budget);
    return percentage >= budget.alertThreshold && percentage < 100;
  }

  /**
   * Verifica si un presupuesto ha excedido el límite
   */
  isOverLimit(budget: Budget): boolean {
    const spent = this.calculateSpent(budget);
    return spent > budget.limit;
  }

  /**
   * Obtiene el monto restante de un presupuesto
   */
  getRemainingAmount(budget: Budget): number {
    const spent = this.calculateSpent(budget);
    return Math.max(0, budget.limit - spent);
  }

  /**
   * Obtiene estadísticas resumidas de todos los presupuestos
   */
  getBudgetSummary(): {
    total: number;
    spent: number;
    remaining: number;
    overBudget: number;
    nearLimit: number;
  } {
    const budgets = this.budgetsSubject.getValue();

    let total = 0;
    let spent = 0;
    let overBudget = 0;
    let nearLimit = 0;

    budgets.forEach(budget => {
      total += budget.limit;
      const budgetSpent = this.calculateSpent(budget);
      spent += budgetSpent;

      if (this.isOverLimit(budget)) overBudget++;
      if (this.isNearLimit(budget)) nearLimit++;
    });

    return {
      total,
      spent,
      remaining: Math.max(0, total - spent),
      overBudget,
      nearLimit
    };
  }
}

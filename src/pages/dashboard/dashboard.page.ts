import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { Account } from '../../models/account.model';
import { Category } from '../../models/category.model';
import { Transaction } from '../../models/transaction.model';
import { AccountService } from '../../services/account.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';

interface ExtendedTransaction extends Transaction {
  accountName: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Stats
  totalBalance = 0;
  monthIncome = 0;
  monthExpense = 0;
  totalAccounts = 0;

  // Data
  accounts: Account[] = [];
  recentTransactions: ExtendedTransaction[] = [];

  constructor(
    private accountService: AccountService,
    private categoryService: CategoryService,
    private transactionService: TransactionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.accountService.accounts$,
      this.categoryService.categories$,
      this.transactionService.transactions$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([accounts, categories, transactions]) => {
        this.accounts = accounts;
        this.calculateStats(accounts, transactions);
        this.loadRecentTransactions(transactions, accounts, categories);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  calculateStats(accounts: Account[], transactions: Transaction[]): void {
    // Total balance
    this.totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    this.totalAccounts = accounts.length;

    // Current month income/expense
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    this.monthIncome = transactions
      .filter(t => {
        const txDate = new Date(t.date);
        return t.type === 'income' && txDate >= startOfMonth && txDate <= endOfMonth;
      })
      .reduce((sum, t) => sum + t.amount, 0);

    this.monthExpense = transactions
      .filter(t => {
        const txDate = new Date(t.date);
        return t.type === 'expense' && txDate >= startOfMonth && txDate <= endOfMonth;
      })
      .reduce((sum, t) => sum + t.amount, 0);
  }

  loadRecentTransactions(
    transactions: Transaction[],
    accounts: Account[],
    categories: Category[]
  ): void {
    // Get last 10 transactions sorted by date
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    this.recentTransactions = sorted.slice(0, 10).map(tx => {
      const account = accounts.find(a => a.id === tx.accountId);
      const category = categories.find(c => c.id === tx.categoryId);

      return {
        ...tx,
        accountName: account?.name || 'Unknown',
        categoryName: category?.name || 'Unknown',
        categoryColor: category?.color || '#6b7280',
        categoryIcon: category?.icon || 'pi-question'
      };
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date));
  }

  getAccountIcon(type: string): string {
    const icons: { [key: string]: string } = {
      bank: 'pi-building',
      cash: 'pi-wallet',
      credit: 'pi-credit-card',
      savings: 'pi-shield',
      investment: 'pi-chart-line'
    };
    return icons[type] || 'pi-wallet';
  }

  navigateToTransactions(): void {
    this.router.navigate(['/transactions']);
  }

  navigateToCategories(): void {
    this.router.navigate(['/categories']);
  }

  navigateToAccounts(): void {
    // TODO: Navigate to accounts page when implemented
    console.log('Navigate to accounts');
  }
}

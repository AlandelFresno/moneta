import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Account } from '../models';
import { ExchangeRateService } from './exchange-rate.service';

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private readonly STORAGE_KEY = 'budget_accounts';
  private accountsSubject = new BehaviorSubject<Account[]>([]);
  public accounts$ = this.accountsSubject.asObservable();

  constructor(private exchangeRateService: ExchangeRateService) {
    this.loadAccounts();
  }

  private loadAccounts(): void {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      const accounts = JSON.parse(data).map((acc: any) => ({
        ...acc,
        icon: acc.icon?.startsWith('pi-') ? acc.icon.substring(3) : acc.icon,
        createdAt: new Date(acc.createdAt),
        updatedAt: new Date(acc.updatedAt),
        deletedAt: acc.deletedAt ? new Date(acc.deletedAt) : undefined
      })).filter((acc: any) => !acc.deletedAt);
      this.accountsSubject.next(accounts);
    } else {
      // Initialize with default accounts
      this.initializeDefaultAccounts();
    }
  }

  private saveAccounts(accounts: Account[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accounts));
    this.accountsSubject.next(accounts);
  }

  private initializeDefaultAccounts(): void {
    const defaultAccounts: Account[] = [
      {
        id: this.generateId(),
        name: 'Cash',
        type: 'cash',
        balance: 0,
        currency: 'USD',
        color: '#10b981',
        icon: 'wallet',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: this.generateId(),
        name: 'Bank Account',
        type: 'bank',
        balance: 0,
        currency: 'USD',
        color: '#3b82f6',
        icon: 'building',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    this.saveAccounts(defaultAccounts);
  }

  getAccounts(): Account[] {
    return this.accountsSubject.value;
  }

  getAccountById(id: string): Account | undefined {
    return this.accountsSubject.value.find(acc => acc.id === id);
  }

  createAccount(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Account {
    const newAccount: Account = {
      ...account,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const accounts = [...this.accountsSubject.value, newAccount];
    this.saveAccounts(accounts);
    return newAccount;
  }

  updateAccount(id: string, updates: Partial<Account>): void {
    const accounts = this.accountsSubject.value.map(acc =>
      acc.id === id
        ? { ...acc, ...updates, updatedAt: new Date() }
        : acc
    );
    this.saveAccounts(accounts);
  }

  deleteAccount(id: string): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const all = stored ? JSON.parse(stored) : [];
    const updated = all.map((acc: any) =>
      acc.id === id ? { ...acc, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : acc
    );
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    this.accountsSubject.next(this.accountsSubject.value.filter(acc => acc.id !== id));
  }

  updateBalance(accountId: string, amount: number, transactionCurrency?: string, skipConversion = false): void {
    const account = this.getAccountById(accountId);
    if (!account) {
      console.warn(`⚠️ [AccountService] Account not found: ${accountId}`);
      return;
    }

    // Convertir el monto a la moneda de la cuenta si es diferente
    let amountInAccountCurrency = amount;
    if (!skipConversion && transactionCurrency && transactionCurrency !== account.currency) {
      amountInAccountCurrency = this.exchangeRateService.convertToPreferredCurrency(
        amount,
        transactionCurrency,
        account.currency
      );
      console.log(`💱 [AccountService] Convirtiendo ${amount} ${transactionCurrency} a ${amountInAccountCurrency.toFixed(2)} ${account.currency}`);
    }

    const accounts = this.accountsSubject.value.map(acc =>
      acc.id === accountId
        ? { ...acc, balance: acc.balance + amountInAccountCurrency, updatedAt: new Date() }
        : acc
    );
    this.saveAccounts(accounts);
  }

  getTotalBalance(): number {
    return this.accountsSubject.value.reduce((sum, acc) => sum + acc.balance, 0);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

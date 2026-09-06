import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Account, AccountTransfer } from '../core/types/account.types';

export interface StoredAccount extends Omit<Account, 'createdAt' | 'updatedAt' | 'deletedAt' | 'reconciledAt'> {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  reconciledAt?: string;
}

export interface StoredAccountTransfer extends Omit<AccountTransfer, 'date' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toAccount(stored: StoredAccount): Account {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined,
    reconciledAt: stored.reconciledAt ? new Date(stored.reconciledAt) : undefined
  };
}

export function fromAccount(account: Account): StoredAccount {
  return {
    ...account,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    deletedAt: account.deletedAt ? account.deletedAt.toISOString() : undefined,
    reconciledAt: account.reconciledAt ? account.reconciledAt.toISOString() : undefined
  };
}

export function toTransfer(stored: StoredAccountTransfer): AccountTransfer {
  return {
    ...stored,
    date: new Date(stored.date),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromTransfer(transfer: AccountTransfer): StoredAccountTransfer {
  return {
    ...transfer,
    date: transfer.date.toISOString(),
    createdAt: transfer.createdAt.toISOString(),
    updatedAt: transfer.updatedAt.toISOString(),
    deletedAt: transfer.deletedAt ? transfer.deletedAt.toISOString() : undefined
  };
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private readonly accountsStorageKey = 'accounts';
  private readonly transfersStorageKey = 'account_transfers';

  private readonly accountsSubject = new BehaviorSubject<Account[]>(this.loadAccounts());
  private readonly transfersSubject = new BehaviorSubject<AccountTransfer[]>(this.loadTransfers());

  readonly accounts$: Observable<Account[]> = this.accountsSubject.pipe(
    map((accounts) => accounts.filter((account) => !account.deletedAt))
  );
  readonly transfers$: Observable<AccountTransfer[]> = this.transfersSubject.pipe(
    map((transfers) => transfers.filter((transfer) => !transfer.deletedAt))
  );

  private loadAccounts(): Account[] {
    const raw = localStorage.getItem(this.accountsStorageKey);
    if (!raw) return [];
    const stored: StoredAccount[] = JSON.parse(raw);
    return stored.map((account) => toAccount(account));
  }

  private loadTransfers(): AccountTransfer[] {
    const raw = localStorage.getItem(this.transfersStorageKey);
    if (!raw) return [];
    const stored: StoredAccountTransfer[] = JSON.parse(raw);
    return stored.map((transfer) => toTransfer(transfer));
  }

  private persistAccounts(accounts: Account[]): void {
    localStorage.setItem(this.accountsStorageKey, JSON.stringify(accounts.map((account) => fromAccount(account))));
  }

  private persistTransfers(transfers: AccountTransfer[]): void {
    localStorage.setItem(this.transfersStorageKey, JSON.stringify(transfers.map((transfer) => fromTransfer(transfer))));
  }

  getAll(): Observable<Account[]> {
    return this.accounts$;
  }

  getAllIncludingDeleted(): Account[] {
    return this.accountsSubject.value;
  }

  replaceAll(accounts: Account[]): void {
    this.persistAccounts(accounts);
    this.accountsSubject.next(accounts);
  }

  getTransfers(): Observable<AccountTransfer[]> {
    return this.transfers$;
  }

  getAllTransfersIncludingDeleted(): AccountTransfer[] {
    return this.transfersSubject.value;
  }

  replaceAllTransfers(transfers: AccountTransfer[]): void {
    this.persistTransfers(transfers);
    this.transfersSubject.next(transfers);
  }

  create(account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Observable<Account> {
    const now = new Date();
    const newAccount: Account = {
      ...account,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    const accounts = [...this.accountsSubject.value, newAccount];
    this.persistAccounts(accounts);
    this.accountsSubject.next(accounts);

    return new Observable((subscriber) => {
      subscriber.next(newAccount);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>): Observable<void> {
    const accounts = this.accountsSubject.value.map((account) =>
      account.id === id ? { ...account, ...updates, updatedAt: new Date() } : account
    );
    this.persistAccounts(accounts);
    this.accountsSubject.next(accounts);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const now = new Date();
    const accounts = this.accountsSubject.value.map((account) =>
      account.id === id ? { ...account, deletedAt: now, updatedAt: now } : account
    );
    this.persistAccounts(accounts);
    this.accountsSubject.next(accounts);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /** In-place balance adjustment, used by TransactionService and transfer()/deleteTransfer() below. No-op if the account doesn't exist (e.g. was deleted). */
  adjustBalance(accountId: string, delta: number): void {
    const accounts = this.accountsSubject.value.map((account) =>
      account.id === accountId ? { ...account, balance: account.balance + delta, updatedAt: new Date() } : account
    );
    this.persistAccounts(accounts);
    this.accountsSubject.next(accounts);
  }

  transfer(fromAccountId: string, toAccountId: string, amount: number, date: Date, description: string): Observable<AccountTransfer> {
    const now = new Date();
    const newTransfer: AccountTransfer = {
      id: this.generateId(),
      fromAccountId,
      toAccountId,
      amount,
      date,
      description,
      createdAt: now,
      updatedAt: now
    };

    const transfers = [...this.transfersSubject.value, newTransfer];
    this.persistTransfers(transfers);
    this.transfersSubject.next(transfers);

    this.adjustBalance(fromAccountId, -amount);
    this.adjustBalance(toAccountId, amount);

    return new Observable((subscriber) => {
      subscriber.next(newTransfer);
      subscriber.complete();
    });
  }

  deleteTransfer(id: string): Observable<void> {
    const existing = this.transfersSubject.value.find((transfer) => transfer.id === id);
    if (!existing || existing.deletedAt) {
      return new Observable((subscriber) => {
        subscriber.next();
        subscriber.complete();
      });
    }

    const now = new Date();
    const transfers = this.transfersSubject.value.map((transfer) =>
      transfer.id === id ? { ...transfer, deletedAt: now, updatedAt: now } : transfer
    );
    this.persistTransfers(transfers);
    this.transfersSubject.next(transfers);

    this.adjustBalance(existing.fromAccountId, existing.amount);
    this.adjustBalance(existing.toAccountId, -existing.amount);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

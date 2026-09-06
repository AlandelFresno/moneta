export type AccountType = 'bank' | 'cash' | 'credit' | 'savings' | 'investment';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  icon: string;
  /** Last time the tracked balance was checked against a real statement — set together with reconciledBalance. */
  reconciledAt?: Date;
  reconciledBalance?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface AccountTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

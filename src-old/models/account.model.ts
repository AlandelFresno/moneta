export interface Account {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'credit' | 'savings' | 'investment';
  balance: number;
  currency: string;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type AccountType = Account['type'];

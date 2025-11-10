export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TransactionType = Transaction['type'];

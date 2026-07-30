export interface Transaction {
  id: string;
  categoryId: string;
  type: 'income' | 'expense';
  name: string;
  description: string;
  amount: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type TransactionType = Transaction['type'];

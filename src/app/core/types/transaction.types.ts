export interface Transaction {
  id: string;
  categoryId: string;
  accountId?: string;
  type: 'income' | 'expense';
  name: string;
  description: string;
  amount: number;
  date: Date;
  /** Shared by every line of a split transaction; undefined for a regular single-category transaction. */
  splitGroupId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type TransactionType = Transaction['type'];

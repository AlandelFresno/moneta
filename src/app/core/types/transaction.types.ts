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
  /** Marks this transaction's exact date+time as the real start of a budgeting period, overriding the default day/hour rule for that occurrence — e.g. the salary deposit. */
  isPeriodStart?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type TransactionType = Transaction['type'];

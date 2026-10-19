import { LineItem } from './line-item.types';

export type NestedEffect = 'add' | 'subtract';

/** 'parent': only the parent, at its net total, counts in balances/budgets/analytics. 'separate': every child counts on its own, with its category and sign. */
export type NestedCounting = 'parent' | 'separate';

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
  /** Set on a nested child: the transaction whose total this one adds to or subtracts from. */
  parentId?: string;
  parentEffect?: NestedEffect;
  /** Set on a parent that has children. */
  nestedCounting?: NestedCounting;
  items?: LineItem[];
  /** Marks this transaction's exact date+time as the real start of a budgeting period, overriding the default day/hour rule for that occurrence — e.g. the salary deposit. */
  isPeriodStart?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type TransactionType = Transaction['type'];

import { LineItem } from './line-item.types';

export type BillPeriod = 'weekly' | 'monthly' | 'yearly';

export interface BillPayment {
  id: string;
  paidDate: Date;
  amount: number;
  /** Absent when someone else paid and no transaction was created on this account. */
  transactionId?: string;
  /** Due date of the period this payment covers. Absent on older payments, which cover the period `paidDate` falls in. */
  periodDueDate?: Date;
}

export interface Bill {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  approxAmount: number;
  /** What the bill covers; copied onto each payment transaction. */
  items?: LineItem[];
  period: BillPeriod;
  // Anchor date the recurrence is read from: day-of-week for weekly,
  // day-of-month for monthly, month+day for yearly. Changing it only
  // affects future occurrences — past BillPayment entries are untouched.
  dueDate: Date;
  // Optional termination conditions — at most one is normally set. Once either is met,
  // the bill stops showing up as due/upcoming (see BillService.isFinished), independent
  // of `active` which is a separate manual pause.
  endDate?: Date;
  totalInstallments?: number;
  active: boolean;
  payments: BillPayment[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

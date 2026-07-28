export type BillPeriod = 'weekly' | 'monthly' | 'yearly';

export interface BillPayment {
  id: string;
  paidDate: Date;
  amount: number;
  transactionId: string;
}

export interface Bill {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  approxAmount: number;
  period: BillPeriod;
  // Anchor date the recurrence is read from: day-of-week for weekly,
  // day-of-month for monthly, month+day for yearly. Changing it only
  // affects future occurrences — past BillPayment entries are untouched.
  dueDate: Date;
  active: boolean;
  payments: BillPayment[];
  createdAt: Date;
  updatedAt: Date;
}

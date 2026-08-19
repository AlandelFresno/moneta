export interface BudgetAllocation {
  categoryId: string;
  amount: number;
}

export interface Budget {
  id: string;
  month: Date;
  totalAmount: number;
  allocations: BudgetAllocation[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export type BudgetSuggestMethod = 'lastMonth' | 'avg3' | 'avgAll' | 'median6';

export interface CategoryProgress {
  categoryId: string;
  allocated: number;
  spent: number;
  pct: number | null;
}

export interface BudgetProgress {
  totalAllocated: number;
  unallocated: number;
  totalSpent: number;
  totalPct: number | null;
  categories: CategoryProgress[];
}

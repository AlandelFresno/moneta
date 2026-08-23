export interface BudgetAllocation {
  categoryId: string;
  amount: number;
}

export type GoalAllocationResolution = 'kept' | 'transferred' | 'saved';

export interface BudgetGoalAllocation {
  goalId: string;
  accountId: string;
  amount: number;
  resolution?: GoalAllocationResolution;
  resolvedAccountId?: string;
  destinationAccountId?: string;
}

export interface Budget {
  id: string;
  month: Date;
  totalAmount: number;
  allocations: BudgetAllocation[];
  goalAllocations: BudgetGoalAllocation[];
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

export interface BudgetGoalProgress {
  goalId: string;
  amount: number;
}

export interface BudgetProgress {
  totalAllocated: number;
  unallocated: number;
  totalSpent: number;
  totalPct: number | null;
  categories: CategoryProgress[];
  goals: BudgetGoalProgress[];
}

export interface PendingGoalRollover {
  budget: Budget;
  allocation: BudgetGoalAllocation;
}

export const BUDGET_WARN_THRESHOLD = 80;
export const BUDGET_OVER_THRESHOLD = 100;

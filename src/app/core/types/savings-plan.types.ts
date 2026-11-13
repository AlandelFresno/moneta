export interface SavingsPlan {
  id: string;
  targetPct: number;
  /** Net monthly income to plan against; when unset the plan uses the average of recent periods. */
  incomeOverride?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface SavingsPlanCategoryRow {
  categoryId: string;
  planned: number | null;
  actual: number;
}

export interface SavingsPlanSummary {
  income: number;
  incomeIsEstimate: boolean;
  targetPct: number;
  savingsGoal: number;
  /** Max spend that still hits the target: income - savingsGoal. */
  ticket: number;
  spent: number;
  saved: number;
  savedPct: number | null;
  /** ticket - spent: room left before missing the target; negative means over. */
  buffer: number;
  bufferPct: number | null;
  budgetTotal: number | null;
  rows: SavingsPlanCategoryRow[];
}

export interface SavingsTrendPoint {
  label: string;
  income: number;
  expense: number;
  savedPct: number | null;
}

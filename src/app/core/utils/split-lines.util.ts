export interface SplitLine {
  categoryId: string;
  amount: number | null;
}

export function splitLinesTotal(lines: SplitLine[]): number {
  return lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
}

/** Starter lines when a transaction is first split: its current category/amount, plus one blank line. */
export function seedSplitLines(categoryId: string, amount: number | null): SplitLine[] {
  return [
    { categoryId, amount },
    { categoryId: '', amount: null }
  ];
}

/** At least two lines are required for a split — refuses to go below that. */
export function withoutSplitLine(lines: SplitLine[], index: number): SplitLine[] {
  if (lines.length <= 2) return lines;
  return lines.filter((_, i) => i !== index);
}

/** Lines ready to save: a category and a positive amount. */
export function validSplitLines(lines: SplitLine[]): SplitLine[] {
  return lines.filter((line) => line.categoryId && line.amount !== null && line.amount > 0);
}

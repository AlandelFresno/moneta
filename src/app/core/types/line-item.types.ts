/** A named part of what a transaction or bill pays for (e.g. card statement → "Seguro de salud"). Informational: never affects balances, budgets or categories. */
export interface LineItem {
  id: string;
  name: string;
  amount: number;
}

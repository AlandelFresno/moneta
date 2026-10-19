import { LineItem } from '../types/line-item.types';

export interface LineItemInput {
  id: string | null;
  name: string;
  amount: number | null;
}

export function emptyLineItemInput(): LineItemInput {
  return { id: null, name: '', amount: null };
}

export function toLineItemInputs(items: LineItem[] | undefined): LineItemInput[] {
  return (items ?? []).map((item) => ({ ...item }));
}

/** Rows with a name and a positive amount, as persistable items. Blank rows are dropped. */
export function validLineItems(inputs: LineItemInput[]): LineItem[] {
  return inputs
    .filter((input) => input.name.trim() && input.amount !== null && input.amount > 0)
    .map((input) => ({
      id: input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      name: input.name.trim(),
      amount: input.amount!
    }));
}

/** True when a row is partly filled: name without amount, or amount without name. */
export function hasIncompleteLineItem(inputs: LineItemInput[]): boolean {
  return inputs.some((input) => {
    const hasName = input.name.trim() !== '';
    const hasAmount = input.amount !== null;
    return (hasName || hasAmount) && !(hasName && input.amount !== null && input.amount > 0);
  });
}

export function lineItemsTotal(items: { amount: number | null }[]): number {
  return items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
}

export function lineItemNames(holder: { items?: LineItem[] }): string {
  return (holder.items ?? []).map((item) => item.name).join(', ');
}

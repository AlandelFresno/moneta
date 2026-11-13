import { SavingsPlan, SavingsTarget } from '../types/savings-plan.types';

/** Target in force during the period labelled `labelMonth`, or null when the plan didn't exist yet. */
export function targetForPeriod(plan: SavingsPlan, labelMonth: Date): number | null {
  const inForce = plan.targets.filter((target) => target.from.getTime() <= labelMonth.getTime());
  return inForce.length > 0 ? inForce[inForce.length - 1].pct : null;
}

export function currentTargetPct(plan: SavingsPlan): number {
  return plan.targets[plan.targets.length - 1].pct;
}

/** Records `pct` from `labelMonth` onward without touching earlier periods; an edit within the same period replaces that period's entry. */
export function withTarget(targets: SavingsTarget[], pct: number, labelMonth: Date): SavingsTarget[] {
  const last = targets[targets.length - 1];
  if (last && last.pct === pct) return targets;
  if (last && last.from.getTime() === labelMonth.getTime()) {
    return [...targets.slice(0, -1), { from: labelMonth, pct }];
  }
  return [...targets, { from: labelMonth, pct }];
}

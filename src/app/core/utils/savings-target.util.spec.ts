import { SavingsPlan } from '../types/savings-plan.types';
import { currentTargetPct, targetForPeriod, withTarget } from './savings-target.util';

function plan(targets: SavingsPlan['targets']): SavingsPlan {
  return { id: 'p', targets, createdAt: new Date(), updatedAt: new Date() };
}

describe('savings-target util', () => {
  const nov = new Date(2026, 10, 1);
  const dec = new Date(2026, 11, 1);

  it('targetForPeriod is null before the plan existed', () => {
    expect(targetForPeriod(plan([{ from: nov, pct: 25 }]), new Date(2026, 9, 1))).toBeNull();
  });

  it('targetForPeriod uses the latest target in force for that period', () => {
    const p = plan([
      { from: nov, pct: 25 },
      { from: dec, pct: 50 }
    ]);
    expect(targetForPeriod(p, nov)).toBe(25);
    expect(targetForPeriod(p, dec)).toBe(50);
    expect(targetForPeriod(p, new Date(2027, 0, 1))).toBe(50);
  });

  it('currentTargetPct is the last target', () => {
    expect(currentTargetPct(plan([{ from: nov, pct: 25 }, { from: dec, pct: 50 }]))).toBe(50);
  });

  it('withTarget appends a new entry from the given month and keeps earlier ones', () => {
    expect(withTarget([{ from: nov, pct: 25 }], 50, dec)).toEqual([
      { from: nov, pct: 25 },
      { from: dec, pct: 50 }
    ]);
  });

  it('withTarget replaces the entry when edited within the same period', () => {
    expect(withTarget([{ from: nov, pct: 25 }], 30, nov)).toEqual([{ from: nov, pct: 30 }]);
  });

  it('withTarget is a no-op when the percentage did not change', () => {
    const targets = [{ from: nov, pct: 25 }];
    expect(withTarget(targets, 25, dec)).toBe(targets);
  });
});

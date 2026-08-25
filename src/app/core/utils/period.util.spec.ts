import { periodStart, actualPeriodStart, periodRange, periodLabelMonth, addMonths } from './period.util';
import { Transaction } from '../types/transaction.types';

function makeTxn(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? 'txn-1',
    categoryId: 'cat-1',
    type: 'income',
    name: 'Sueldo',
    description: '',
    amount: 1000,
    date: new Date(2026, 7, 6),
    createdAt: new Date(2026, 7, 6),
    updatedAt: new Date(2026, 7, 6),
    ...overrides
  };
}

describe('periodStart', () => {
  it('at startDay=1, matches the plain calendar month start', () => {
    expect(periodStart(new Date(2026, 7, 3), 1)).toEqual(new Date(2026, 7, 1));
    expect(periodStart(new Date(2026, 7, 31), 1)).toEqual(new Date(2026, 7, 1));
  });

  it('at a custom startDay, a date before it belongs to last month\'s period', () => {
    expect(periodStart(new Date(2026, 7, 3), 6)).toEqual(new Date(2026, 6, 6));
  });

  it('at a custom startDay, a date on/after it belongs to this month\'s period', () => {
    expect(periodStart(new Date(2026, 7, 6), 6)).toEqual(new Date(2026, 7, 6));
    expect(periodStart(new Date(2026, 7, 20), 6)).toEqual(new Date(2026, 7, 6));
  });

  it('rolls the year back correctly across January', () => {
    expect(periodStart(new Date(2026, 0, 3), 6)).toEqual(new Date(2025, 11, 6));
  });
});

describe('actualPeriodStart', () => {
  it('falls back to the nominal day/hour boundary when no marker exists', () => {
    expect(actualPeriodStart(new Date(2026, 7, 20), [], 6, 14)).toEqual(new Date(2026, 7, 6, 14));
  });

  it('uses a marked transaction\'s exact timestamp when it buckets into the same nominal period', () => {
    const marker = makeTxn({ isPeriodStart: true, date: new Date(2026, 7, 6, 14, 32) });
    expect(actualPeriodStart(new Date(2026, 7, 20), [marker], 6, 0)).toEqual(new Date(2026, 7, 6, 14, 32));
  });

  it('ignores a marker from a different nominal bucket', () => {
    const marker = makeTxn({ isPeriodStart: true, date: new Date(2026, 6, 6, 9) });
    expect(actualPeriodStart(new Date(2026, 7, 20), [marker], 6, 0)).toEqual(new Date(2026, 7, 6, 0));
  });

  it('ignores transactions not flagged as isPeriodStart', () => {
    const notMarked = makeTxn({ isPeriodStart: false, date: new Date(2026, 7, 6, 14, 32) });
    expect(actualPeriodStart(new Date(2026, 7, 20), [notMarked], 6, 0)).toEqual(new Date(2026, 7, 6, 0));
  });

  it('picks the earliest marker when more than one lands in the same bucket', () => {
    const later = makeTxn({ id: 'a', isPeriodStart: true, date: new Date(2026, 7, 6, 18) });
    const earlier = makeTxn({ id: 'b', isPeriodStart: true, date: new Date(2026, 7, 6, 9) });
    expect(actualPeriodStart(new Date(2026, 7, 20), [later, earlier], 6, 0)).toEqual(new Date(2026, 7, 6, 9));
  });
});

describe('periodRange', () => {
  it('at startDay=1, hour=0, no markers — matches the plain calendar month exactly', () => {
    expect(periodRange(new Date(2026, 7, 15), 1, 0, [])).toEqual({
      start: new Date(2026, 7, 1),
      end: new Date(2026, 7, 31, 23, 59, 59, 999)
    });
  });

  it('spans startDay of one month through just before startDay next month', () => {
    expect(periodRange(new Date(2026, 7, 3), 6, 0, [])).toEqual({
      start: new Date(2026, 6, 6),
      end: new Date(new Date(2026, 7, 6).getTime() - 1)
    });
    expect(periodRange(new Date(2026, 7, 20), 6, 0, [])).toEqual({
      start: new Date(2026, 7, 6),
      end: new Date(new Date(2026, 8, 6).getTime() - 1)
    });
  });

  it('respects a non-zero default start hour when no marker exists', () => {
    const range = periodRange(new Date(2026, 7, 20), 6, 14, []);
    expect(range.start).toEqual(new Date(2026, 7, 6, 14));
    expect(range.end).toEqual(new Date(new Date(2026, 8, 6, 14).getTime() - 1));
  });

  it('a marker transaction shifts the real boundary, splitting same-day transactions correctly', () => {
    const marker = makeTxn({ isPeriodStart: true, date: new Date(2026, 7, 6, 14, 32) });
    const range = periodRange(new Date(2026, 7, 20), 6, 0, [marker]);
    expect(range.start).toEqual(new Date(2026, 7, 6, 14, 32));

    const beforeMarker = new Date(2026, 7, 6, 10);
    const afterMarker = new Date(2026, 7, 6, 15);
    expect(beforeMarker.getTime() < range.start.getTime()).toBe(true);
    expect(afterMarker.getTime() >= range.start.getTime()).toBe(true);
  });
});

describe('periodLabelMonth', () => {
  it('at startDay=1, matches the plain calendar month', () => {
    expect(periodLabelMonth(new Date(2026, 7, 15), 1)).toEqual(new Date(2026, 7, 1));
  });

  it('a day-1-to-5 expense is labeled under the previous month', () => {
    expect(periodLabelMonth(new Date(2026, 7, 3), 6)).toEqual(new Date(2026, 6, 1));
  });

  it('a day-on-or-after-startDay expense is labeled under the current month', () => {
    expect(periodLabelMonth(new Date(2026, 7, 6), 6)).toEqual(new Date(2026, 7, 1));
  });
});

describe('addMonths', () => {
  it('advances the month, preserving the day', () => {
    expect(addMonths(new Date(2026, 0, 1), 1)).toEqual(new Date(2026, 1, 1));
    expect(addMonths(new Date(2026, 0, 6), 3)).toEqual(new Date(2026, 3, 6));
  });

  it('rolls the year forward across December', () => {
    expect(addMonths(new Date(2026, 11, 1), 1)).toEqual(new Date(2027, 0, 1));
  });
});

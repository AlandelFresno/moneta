import { periodStart, periodRange, periodLabelMonth, addMonths } from './period.util';

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

describe('periodRange', () => {
  it('at startDay=1, matches the plain calendar month exactly', () => {
    expect(periodRange(new Date(2026, 7, 15), 1)).toEqual({
      start: new Date(2026, 7, 1),
      end: new Date(2026, 7, 31)
    });
  });

  it('spans startDay of one month through the day before startDay next month', () => {
    expect(periodRange(new Date(2026, 7, 3), 6)).toEqual({
      start: new Date(2026, 6, 6),
      end: new Date(2026, 7, 5)
    });
    expect(periodRange(new Date(2026, 7, 20), 6)).toEqual({
      start: new Date(2026, 7, 6),
      end: new Date(2026, 8, 5)
    });
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

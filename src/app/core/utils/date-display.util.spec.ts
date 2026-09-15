import { formatDate, formatMonthLabel } from './date-display.util';

describe('formatDate', () => {
  it('formats a midnight date without a time component', () => {
    const formatted = formatDate(new Date(2026, 0, 15));
    expect(formatted).not.toMatch(/\d{2}:\d{2}/);
    expect(formatted).toContain('2026');
  });

  it('appends the time when the date carries hour/minute precision (e.g. a period marker)', () => {
    expect(formatDate(new Date(2026, 0, 15, 14, 32))).toContain('14:32');
  });

  it('pads single-digit hours and minutes', () => {
    expect(formatDate(new Date(2026, 0, 15, 9, 5))).toContain('09:05');
  });
});

describe('formatMonthLabel', () => {
  it('capitalizes the localized month/year label', () => {
    const label = formatMonthLabel(new Date(2026, 7, 1));
    expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    expect(label.toLowerCase()).toContain('agosto');
    expect(label).toContain('2026');
  });
});

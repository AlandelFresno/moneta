const DATE_FORMATTER = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });

/** Day/month/year, plus the time when `date` doesn't fall on midnight (e.g. an hour-precision period marker). */
export function formatDate(date: Date): string {
  const base = DATE_FORMATTER.format(date);
  if (date.getHours() === 0 && date.getMinutes() === 0) return base;
  return `${base} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Capitalized "Month Year" (e.g. "Marzo 2026") — used for month-grouped labels (a budget's month, a transaction group). */
export function formatMonthLabel(date: Date): string {
  const label = MONTH_LABEL_FORMATTER.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

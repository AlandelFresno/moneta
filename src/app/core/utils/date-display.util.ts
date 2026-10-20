const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const pad = (value: number): string => String(value).padStart(2, '0');

/** "05 octubre (05/10)" — day + month name, then the same day as DD/MM. */
export function formatDayMonth(date: Date): string {
  const day = pad(date.getDate());
  return `${day} ${MONTH_NAMES[date.getMonth()]} (${day}/${pad(date.getMonth() + 1)})`;
}

/** Same as `formatDayMonth`, always followed by HH:mm. */
export function formatDateTime(date: Date): string {
  return `${formatDayMonth(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });

/** "DD month (DD/MM)", plus the time when `date` doesn't fall on midnight (e.g. an hour-precision period marker). */
export function formatDate(date: Date): string {
  if (date.getHours() === 0 && date.getMinutes() === 0) return formatDayMonth(date);
  return formatDateTime(date);
}

/** Capitalized "Month Year" (e.g. "Marzo 2026") — used for month-grouped labels (a budget's month, a transaction group). */
export function formatMonthLabel(date: Date): string {
  const label = MONTH_LABEL_FORMATTER.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Argentine convention: "." thousands separator, "," decimal separator (e.g. "$ 1.981.000,00", "-$ 50.000,00"). */
export function parseArsAmount(raw: string): number {
  const cleaned = raw.replace(/\$/g, '').replace(/\s/g, '');
  const negative = cleaned.startsWith('-');
  const digits = cleaned.replace(/^-/, '').replace(/\./g, '').replace(',', '.');
  const value = parseFloat(digits);
  return negative ? -value : value;
}

/** US convention: "," thousands separator, "." decimal separator (e.g. "$ 3,040.00"). */
export function parseUsStyleAmount(raw: string): number {
  const cleaned = raw.replace(/\$/g, '').replace(/\s/g, '');
  const negative = cleaned.startsWith('-');
  const digits = cleaned.replace(/^-/, '').replace(/,/g, '');
  const value = parseFloat(digits);
  return negative ? -value : value;
}

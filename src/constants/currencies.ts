export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'ARS', name: 'Peso Argentino', symbol: '$' },
  { code: 'USD', name: 'Dólar Estadounidense', symbol: 'US$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'BRL', name: 'Real Brasileño', symbol: 'R$' }
];

export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map(c => c.code);

export function getCurrencyByCode(code: string): Currency | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === code);
}

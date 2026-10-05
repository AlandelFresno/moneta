import { parseArsAmount, parseUsStyleAmount } from './currency-parse.util';

describe('parseArsAmount', () => {
  it('parses a dot-thousands comma-decimal amount', () => {
    expect(parseArsAmount('$ 1.981.000,00')).toBe(1981000);
  });

  it('parses a negative amount', () => {
    expect(parseArsAmount('-$ 50.000,00')).toBe(-50000);
  });

  it('parses an amount with no thousands separator', () => {
    expect(parseArsAmount('$ 73.359,24')).toBe(73359.24);
  });

  it('parses a small amount under a thousand', () => {
    expect(parseArsAmount('$ 0,50')).toBe(0.5);
  });
});

describe('parseUsStyleAmount', () => {
  it('parses a comma-thousands dot-decimal amount', () => {
    expect(parseUsStyleAmount('$ 3,040.00')).toBe(3040);
  });

  it('parses a negative amount', () => {
    expect(parseUsStyleAmount('-$ 1,250.50')).toBe(-1250.5);
  });

  it('parses an amount with no thousands separator', () => {
    expect(parseUsStyleAmount('$ 345.32')).toBe(345.32);
  });
});

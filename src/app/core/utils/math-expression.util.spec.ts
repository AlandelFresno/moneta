import { evaluateMathExpression, evaluateCalculatorInput } from './math-expression.util';

describe('evaluateMathExpression', () => {
  it('evaluates a plain number', () => {
    expect(evaluateMathExpression('42')).toBe(42);
  });

  it('respects operator precedence', () => {
    expect(evaluateMathExpression('2 + 3 * 4')).toBe(14);
  });

  it('respects parentheses', () => {
    expect(evaluateMathExpression('(2 + 3) * 4')).toBe(20);
  });

  it('handles unary minus', () => {
    expect(evaluateMathExpression('-5 + 10')).toBe(5);
  });

  it('handles decimals with a dot', () => {
    expect(evaluateMathExpression('1.5 + 2.25')).toBeCloseTo(3.75);
  });

  it('handles decimals with a comma', () => {
    expect(evaluateMathExpression('1,5 + 2,25')).toBeCloseTo(3.75);
  });

  it('ignores surrounding and internal whitespace', () => {
    expect(evaluateMathExpression('  10  -  4  ')).toBe(6);
  });

  it('throws on division by zero', () => {
    expect(() => evaluateMathExpression('5 / 0')).toThrow();
  });

  it('throws on an empty expression', () => {
    expect(() => evaluateMathExpression('   ')).toThrow();
  });

  it('throws on invalid characters', () => {
    expect(() => evaluateMathExpression('5 + a')).toThrow();
  });

  it('throws on an unclosed parenthesis', () => {
    expect(() => evaluateMathExpression('(1 + 2')).toThrow();
  });

  it('throws on trailing garbage after a valid expression', () => {
    expect(() => evaluateMathExpression('2 + 2 3')).toThrow();
  });
});

describe('evaluateCalculatorInput', () => {
  it('returns the evaluated preview with no error for a valid expression', () => {
    expect(evaluateCalculatorInput('2 + 3')).toEqual({ preview: 5, error: null });
  });

  it('clears both preview and error for blank input, instead of reporting the empty-expression error', () => {
    expect(evaluateCalculatorInput('   ')).toEqual({ preview: null, error: null });
  });

  it('captures a thrown error message and clears the preview', () => {
    const result = evaluateCalculatorInput('5 / 0');
    expect(result.preview).toBeNull();
    expect(result.error).toBe('División por cero');
  });
});

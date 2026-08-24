/** Recursive-descent parser for +, -, *, /, parentheses and decimals (comma or dot). No `eval`/`Function`. */
export function evaluateMathExpression(input: string): number {
  const normalized = input.trim().replace(/,/g, '.');
  if (!normalized) throw new Error('Expresión vacía');
  if (!/^[0-9+\-*/(). ]+$/.test(normalized)) throw new Error('Caracteres inválidos');

  let pos = 0;

  const peek = (): string | undefined => normalized[pos];
  const isDigit = (ch: string | undefined): boolean => !!ch && ch >= '0' && ch <= '9';
  const skipSpaces = (): void => {
    while (peek() === ' ') pos++;
  };

  function parseExpression(): number {
    let value = parseTerm();
    skipSpaces();
    while (peek() === '+' || peek() === '-') {
      const op = normalized[pos++];
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
      skipSpaces();
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    skipSpaces();
    while (peek() === '*' || peek() === '/') {
      const op = normalized[pos++];
      const rhs = parseFactor();
      if (op === '/') {
        if (rhs === 0) throw new Error('División por cero');
        value = value / rhs;
      } else {
        value = value * rhs;
      }
      skipSpaces();
    }
    return value;
  }

  function parseFactor(): number {
    skipSpaces();
    if (peek() === '+') {
      pos++;
      return parseFactor();
    }
    if (peek() === '-') {
      pos++;
      return -parseFactor();
    }
    if (peek() === '(') {
      pos++;
      const value = parseExpression();
      skipSpaces();
      if (peek() !== ')') throw new Error('Falta paréntesis de cierre');
      pos++;
      return value;
    }
    return parseNumber();
  }

  function parseNumber(): number {
    skipSpaces();
    const start = pos;
    if (!isDigit(peek()) && peek() !== '.') throw new Error('Número esperado');
    while (isDigit(peek())) pos++;
    if (peek() === '.') {
      pos++;
      while (isDigit(peek())) pos++;
    }
    return parseFloat(normalized.slice(start, pos));
  }

  const result = parseExpression();
  skipSpaces();
  if (pos !== normalized.length) throw new Error('Expresión inválida');
  if (!Number.isFinite(result)) throw new Error('Resultado inválido');
  return result;
}

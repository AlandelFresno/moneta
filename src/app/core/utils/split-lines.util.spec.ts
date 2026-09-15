import { splitLinesTotal, seedSplitLines, withoutSplitLine, validSplitLines } from './split-lines.util';

describe('splitLinesTotal', () => {
  it('sums the amounts, treating a null amount as 0', () => {
    expect(splitLinesTotal([{ categoryId: 'a', amount: 30 }, { categoryId: 'b', amount: null }])).toBe(30);
  });

  it('is 0 for an empty list', () => {
    expect(splitLinesTotal([])).toBe(0);
  });
});

describe('seedSplitLines', () => {
  it('returns the current category/amount as the first line and a blank second line', () => {
    expect(seedSplitLines('cat-1', 100)).toEqual([
      { categoryId: 'cat-1', amount: 100 },
      { categoryId: '', amount: null }
    ]);
  });
});

describe('withoutSplitLine', () => {
  it('removes the line at the given index when more than two remain', () => {
    const lines = [
      { categoryId: 'a', amount: 10 },
      { categoryId: 'b', amount: 20 },
      { categoryId: 'c', amount: 30 }
    ];
    expect(withoutSplitLine(lines, 1)).toEqual([
      { categoryId: 'a', amount: 10 },
      { categoryId: 'c', amount: 30 }
    ]);
  });

  it('refuses to go below two lines', () => {
    const lines = [
      { categoryId: 'a', amount: 10 },
      { categoryId: 'b', amount: 20 }
    ];
    expect(withoutSplitLine(lines, 0)).toBe(lines);
  });
});

describe('validSplitLines', () => {
  it('keeps only lines with a category and a positive amount', () => {
    const lines = [
      { categoryId: 'a', amount: 10 },
      { categoryId: '', amount: 20 },
      { categoryId: 'c', amount: null },
      { categoryId: 'd', amount: 0 },
      { categoryId: 'e', amount: -5 }
    ];
    expect(validSplitLines(lines)).toEqual([{ categoryId: 'a', amount: 10 }]);
  });
});

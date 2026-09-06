import { CATEGORY_ICON_OPTIONS } from './category-icons.util';

describe('CATEGORY_ICON_OPTIONS', () => {
  it('is a non-empty list of icon name strings', () => {
    expect(CATEGORY_ICON_OPTIONS.length).toBeGreaterThan(0);
    expect(CATEGORY_ICON_OPTIONS.every((name) => typeof name === 'string' && name.length > 0)).toBeTrue();
  });

  it('has no duplicate icon names', () => {
    const unique = new Set(CATEGORY_ICON_OPTIONS);
    expect(unique.size).toBe(CATEGORY_ICON_OPTIONS.length);
  });

  it('uses only lowercase kebab-case names, matching PrimeIcons/custom-icon naming', () => {
    const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    const offenders = CATEGORY_ICON_OPTIONS.filter((name) => !kebabCase.test(name));
    expect(offenders).toEqual([]);
  });
});

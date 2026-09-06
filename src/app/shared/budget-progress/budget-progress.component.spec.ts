import { BudgetProgressComponent } from './budget-progress.component';
import { Category } from '../../core/types/category.types';
import { Goal } from '../../core/types/goal.types';

const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Almacén', type: 'expense', color: '#f00', icon: 'tag', createdAt: new Date(), updatedAt: new Date() }
];

const GOALS: Goal[] = [
  { id: 'goal-1', name: 'Viaje', targetAmount: 1000, currentAmount: 0, color: '#0f0', icon: 'plane', createdAt: new Date(), updatedAt: new Date() }
];

describe('BudgetProgressComponent', () => {
  let component: BudgetProgressComponent;

  beforeEach(() => {
    component = new BudgetProgressComponent();
    component.categories = CATEGORIES;
    component.goals = GOALS;
  });

  describe('categoryFor / goalFor', () => {
    it('finds an existing category or goal by id', () => {
      expect(component.categoryFor('cat-1')?.name).toBe('Almacén');
      expect(component.goalFor('goal-1')?.name).toBe('Viaje');
    });

    it('returns undefined for an unknown id (e.g. deleted category/goal)', () => {
      expect(component.categoryFor('gone')).toBeUndefined();
      expect(component.goalFor('gone')).toBeUndefined();
    });
  });

  describe('barColor', () => {
    it('is the accent color when there is no percentage yet', () => {
      expect(component.barColor(null)).toBe('bg-accent');
    });

    it('is green under the warn threshold', () => {
      expect(component.barColor(50)).toBe('bg-income');
    });

    it('is a softer red at/over the warn threshold but under the over threshold', () => {
      expect(component.barColor(80)).toBe('bg-expense/70');
      expect(component.barColor(99)).toBe('bg-expense/70');
    });

    it('is full red once over the over threshold', () => {
      expect(component.barColor(101)).toBe('bg-expense');
    });
  });

  describe('widthPct', () => {
    it('is 0 when there is no percentage yet', () => {
      expect(component.widthPct(null)).toBe(0);
    });

    it('passes through values at or under 100', () => {
      expect(component.widthPct(45)).toBe(45);
      expect(component.widthPct(100)).toBe(100);
    });

    it('caps the bar width at 100 even when the budget is exceeded', () => {
      expect(component.widthPct(150)).toBe(100);
    });
  });
});

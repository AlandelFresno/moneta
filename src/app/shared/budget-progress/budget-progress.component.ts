import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BUDGET_OVER_THRESHOLD, BUDGET_WARN_THRESHOLD, Budget, BudgetProgress } from '../../core/types/budget.types';
import { Category } from '../../core/types/category.types';
import { Goal } from '../../core/types/goal.types';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-budget-progress',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './budget-progress.component.html',
  styleUrl: './budget-progress.component.scss'
})
export class BudgetProgressComponent {
  @Input() budget: Budget | null = null;
  @Input() progress: BudgetProgress | null = null;
  @Input() categories: Category[] = [];
  @Input() goals: Goal[] = [];
  @Input() variant: 'compact' | 'full' = 'compact';

  categoryFor(categoryId: string): Category | undefined {
    return this.categories.find((cat) => cat.id === categoryId);
  }

  goalFor(goalId: string): Goal | undefined {
    return this.goals.find((goal) => goal.id === goalId);
  }

  barColor(pct: number | null): string {
    if (pct === null) return 'bg-accent';
    if (pct > BUDGET_OVER_THRESHOLD) return 'bg-expense';
    if (pct >= BUDGET_WARN_THRESHOLD) return 'bg-expense/70';
    return 'bg-income';
  }

  widthPct(pct: number | null): number {
    if (pct === null) return 0;
    return Math.min(pct, 100);
  }
}

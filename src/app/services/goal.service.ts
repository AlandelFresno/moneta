import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Goal, GoalContribution } from '../core/types/goal.types';

export interface StoredGoal extends Omit<Goal, 'deadline' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface StoredGoalContribution extends Omit<GoalContribution, 'date' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  date: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toGoal(stored: StoredGoal): Goal {
  return {
    ...stored,
    deadline: stored.deadline ? new Date(stored.deadline) : undefined,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromGoal(goal: Goal): StoredGoal {
  return {
    ...goal,
    deadline: goal.deadline ? goal.deadline.toISOString() : undefined,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
    deletedAt: goal.deletedAt ? goal.deletedAt.toISOString() : undefined
  };
}

export function toGoalContribution(stored: StoredGoalContribution): GoalContribution {
  return {
    ...stored,
    date: new Date(stored.date),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromGoalContribution(contribution: GoalContribution): StoredGoalContribution {
  return {
    ...contribution,
    date: contribution.date.toISOString(),
    createdAt: contribution.createdAt.toISOString(),
    updatedAt: contribution.updatedAt.toISOString(),
    deletedAt: contribution.deletedAt ? contribution.deletedAt.toISOString() : undefined
  };
}

@Injectable({
  providedIn: 'root'
})
export class GoalService {
  private readonly goalsStorageKey = 'goals';
  private readonly contributionsStorageKey = 'goal_contributions';

  private readonly goalsSubject = new BehaviorSubject<Goal[]>(this.loadGoals());
  private readonly contributionsSubject = new BehaviorSubject<GoalContribution[]>(this.loadContributions());

  readonly goals$: Observable<Goal[]> = this.goalsSubject.pipe(map((goals) => goals.filter((goal) => !goal.deletedAt)));
  readonly contributions$: Observable<GoalContribution[]> = this.contributionsSubject.pipe(
    map((contributions) => contributions.filter((contribution) => !contribution.deletedAt))
  );

  private loadGoals(): Goal[] {
    const raw = localStorage.getItem(this.goalsStorageKey);
    if (!raw) return [];
    const stored: StoredGoal[] = JSON.parse(raw);
    return stored.map((goal) => toGoal(goal));
  }

  private loadContributions(): GoalContribution[] {
    const raw = localStorage.getItem(this.contributionsStorageKey);
    if (!raw) return [];
    const stored: StoredGoalContribution[] = JSON.parse(raw);
    return stored.map((contribution) => toGoalContribution(contribution));
  }

  private persistGoals(goals: Goal[]): void {
    localStorage.setItem(this.goalsStorageKey, JSON.stringify(goals.map((goal) => fromGoal(goal))));
  }

  private persistContributions(contributions: GoalContribution[]): void {
    localStorage.setItem(this.contributionsStorageKey, JSON.stringify(contributions.map((contribution) => fromGoalContribution(contribution))));
  }

  getAll(): Observable<Goal[]> {
    return this.goals$;
  }

  getAllIncludingDeleted(): Goal[] {
    return this.goalsSubject.value;
  }

  replaceAll(goals: Goal[]): void {
    this.persistGoals(goals);
    this.goalsSubject.next(goals);
  }

  getContributions(): Observable<GoalContribution[]> {
    return this.contributions$;
  }

  getAllContributionsIncludingDeleted(): GoalContribution[] {
    return this.contributionsSubject.value;
  }

  replaceAllContributions(contributions: GoalContribution[]): void {
    this.persistContributions(contributions);
    this.contributionsSubject.next(contributions);
  }

  create(goal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Observable<Goal> {
    const now = new Date();
    const newGoal: Goal = {
      ...goal,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    const goals = [...this.goalsSubject.value, newGoal];
    this.persistGoals(goals);
    this.goalsSubject.next(goals);

    return new Observable((subscriber) => {
      subscriber.next(newGoal);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Goal, 'id' | 'createdAt'>>): Observable<void> {
    const goals = this.goalsSubject.value.map((goal) => (goal.id === id ? { ...goal, ...updates, updatedAt: new Date() } : goal));
    this.persistGoals(goals);
    this.goalsSubject.next(goals);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const now = new Date();
    const goals = this.goalsSubject.value.map((goal) => (goal.id === id ? { ...goal, deletedAt: now, updatedAt: now } : goal));
    this.persistGoals(goals);
    this.goalsSubject.next(goals);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /** In-place amount adjustment, used by contribute()/deleteContribution() below. No-op if the goal doesn't exist (e.g. was deleted). */
  adjustAmount(goalId: string, delta: number): void {
    const goals = this.goalsSubject.value.map((goal) =>
      goal.id === goalId ? { ...goal, currentAmount: goal.currentAmount + delta, updatedAt: new Date() } : goal
    );
    this.persistGoals(goals);
    this.goalsSubject.next(goals);
  }

  contribute(goalId: string, amount: number, date: Date, description: string): Observable<GoalContribution> {
    const now = new Date();
    const newContribution: GoalContribution = {
      id: this.generateId(),
      goalId,
      amount,
      date,
      description,
      createdAt: now,
      updatedAt: now
    };

    const contributions = [...this.contributionsSubject.value, newContribution];
    this.persistContributions(contributions);
    this.contributionsSubject.next(contributions);

    this.adjustAmount(goalId, amount);

    return new Observable((subscriber) => {
      subscriber.next(newContribution);
      subscriber.complete();
    });
  }

  deleteContribution(id: string): Observable<void> {
    const existing = this.contributionsSubject.value.find((contribution) => contribution.id === id);
    if (!existing || existing.deletedAt) {
      return new Observable((subscriber) => {
        subscriber.next();
        subscriber.complete();
      });
    }

    const now = new Date();
    const contributions = this.contributionsSubject.value.map((contribution) =>
      contribution.id === id ? { ...contribution, deletedAt: now, updatedAt: now } : contribution
    );
    this.persistContributions(contributions);
    this.contributionsSubject.next(contributions);

    this.adjustAmount(existing.goalId, -existing.amount);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

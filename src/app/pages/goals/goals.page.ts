import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest, lastValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmationService, MessageService } from 'primeng/api';

import { Goal, GoalContribution } from '../../core/types/goal.types';
import { GoalService } from '../../services/goal.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { CATEGORY_ICON_OPTIONS } from '../../core/utils/category-icons.util';

interface GoalForm {
  id: string | null;
  name: string;
  targetAmount: number | null;
  currentAmount: number | null;
  deadline: Date | null;
  color: string;
  icon: string;
}

const EMPTY_FORM: GoalForm = {
  id: null,
  name: '',
  targetAmount: null,
  currentAmount: 0,
  deadline: null,
  color: '#3b82f6',
  icon: 'flag'
};

type ContributionKind = 'deposit' | 'withdraw';

interface ContributionForm {
  goalId: string;
  kind: ContributionKind;
  amount: number | null;
  date: Date;
  description: string;
}

const EMPTY_CONTRIBUTION_FORM: ContributionForm = {
  goalId: '',
  kind: 'deposit',
  amount: null,
  date: new Date(),
  description: ''
};

interface GoalDisplay extends Goal {
  pct: number;
}

interface ContributionDisplay extends GoalContribution {
  goalName: string;
}

@Component({
  selector: 'app-goals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    DatePickerModule,
    IconComponent
  ],
  templateUrl: './goals.page.html',
  styleUrl: './goals.page.scss'
})
export class GoalsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  goals: GoalDisplay[] = [];
  recentContributions: ContributionDisplay[] = [];
  readonly iconOptions = CATEGORY_ICON_OPTIONS;

  readonly kindOptions: { label: string; value: ContributionKind }[] = [
    { label: 'Depósito', value: 'deposit' },
    { label: 'Retiro', value: 'withdraw' }
  ];

  dialogVisible = false;
  form: GoalForm = { ...EMPTY_FORM };

  contributionDialogVisible = false;
  contributionForm: ContributionForm = { ...EMPTY_CONTRIBUTION_FORM };
  contributingGoalName = '';

  constructor(
    private readonly goalService: GoalService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService
  ) {}

  ngOnInit(): void {
    combineLatest([this.goalService.getAll(), this.goalService.getContributions()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([goals, contributions]) => {
        this.goals = [...goals]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((goal) => ({ ...goal, pct: goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0 }));

        this.recentContributions = [...contributions]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 10)
          .map((contribution) => ({ ...contribution, goalName: this.goalName(contribution.goalId, goals) }));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private goalName(id: string, goals: Goal[]): string {
    return goals.find((goal) => goal.id === id)?.name ?? 'Meta eliminada';
  }

  openCreateDialog(): void {
    this.form = { ...EMPTY_FORM };
    this.dialogVisible = true;
  }

  openEditDialog(goal: Goal): void {
    this.form = {
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      deadline: goal.deadline ?? null,
      color: goal.color,
      icon: goal.icon
    };
    this.dialogVisible = true;
  }

  async saveGoal(): Promise<void> {
    if (!this.form.name.trim() || this.form.targetAmount === null || this.form.targetAmount <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Completá nombre y un monto objetivo válido' });
      return;
    }

    if (this.form.id) {
      await lastValueFrom(
        this.goalService.update(this.form.id, {
          name: this.form.name.trim(),
          targetAmount: this.form.targetAmount,
          deadline: this.form.deadline ?? undefined,
          color: this.form.color,
          icon: this.form.icon
        })
      );
      this.messageService.add({ severity: 'success', summary: 'Meta actualizada' });
    } else {
      await lastValueFrom(
        this.goalService.create({
          name: this.form.name.trim(),
          targetAmount: this.form.targetAmount,
          currentAmount: this.form.currentAmount ?? 0,
          deadline: this.form.deadline ?? undefined,
          color: this.form.color,
          icon: this.form.icon
        })
      );
      this.messageService.add({ severity: 'success', summary: 'Meta creada' });
    }

    this.dialogVisible = false;
  }

  deleteGoal(goal: Goal): void {
    this.confirmationService.confirm({
      header: '¿Eliminar meta?',
      message: `Se eliminará "${goal.name}" y su historial de aportes.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: async () => {
        await lastValueFrom(this.goalService.delete(goal.id));
        this.messageService.add({ severity: 'success', summary: 'Meta eliminada' });
      }
    });
  }

  openContributionDialog(goal: Goal): void {
    this.contributionForm = { ...EMPTY_CONTRIBUTION_FORM, goalId: goal.id, date: new Date() };
    this.contributingGoalName = goal.name;
    this.contributionDialogVisible = true;
  }

  async saveContribution(): Promise<void> {
    const { goalId, kind, amount, date, description } = this.contributionForm;

    if (amount === null || amount <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Ingresá un monto válido' });
      return;
    }

    const signedAmount = kind === 'withdraw' ? -amount : amount;
    await lastValueFrom(this.goalService.contribute(goalId, signedAmount, date, description));
    this.messageService.add({ severity: 'success', summary: kind === 'withdraw' ? 'Retiro registrado' : 'Aporte registrado' });
    this.contributionDialogVisible = false;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
}

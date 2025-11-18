import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Budget, BudgetPeriod } from '../../models/budget.model';
import { Category } from '../../models/category.model';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { ToastService } from '../../services/toast.service';
import { CurrencyDisplayService } from '../../services/currency-display.service';

interface BudgetWithStats extends Budget {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'danger';
}

@Component({
  selector: 'app-budgets',
  templateUrl: './budgets.page.html',
  styleUrls: ['./budgets.page.scss'],
  standalone: false
})
export class BudgetsPage implements OnInit, OnDestroy {
  budgets: BudgetWithStats[] = [];
  categories: Category[] = [];
  currencies: any[] = [];

  showBudgetDialog = false;
  isEditing = false;
  editingBudget: Budget | null = null;

  budgetForm = {
    name: '',
    categoryId: '',
    limit: 0,
    currency: 'ARS',
    period: 'monthly' as BudgetPeriod,
    alertThreshold: 80
  };

  periods = [
    { label: 'Semanal', value: 'weekly' },
    { label: 'Mensual', value: 'monthly' },
    { label: 'Anual', value: 'yearly' }
  ];

  filterPeriod: BudgetPeriod | 'all' = 'all';
  filterCategory: string = 'all';

  summary = {
    total: 0,
    spent: 0,
    remaining: 0,
    overBudget: 0,
    nearLimit: 0
  };

  private subscriptions: Subscription[] = [];

  constructor(
    private budgetService: BudgetService,
    private categoryService: CategoryService,
    private toastService: ToastService,
    public currencyDisplayService: CurrencyDisplayService
  ) {}

  ngOnInit(): void {
    this.loadData();

    // Suscribirse a cambios en presupuestos
    const budgetSub = this.budgetService.budgets$.subscribe(() => {
      this.loadBudgets();
    });
    this.subscriptions.push(budgetSub);

    // Suscribirse a cambios en categorías
    const categorySub = this.categoryService.categories$.subscribe(categories => {
      this.categories = categories.filter(c => c.type === 'expense');
    });
    this.subscriptions.push(categorySub);

    // Cargar monedas disponibles
    this.currencies = this.currencyDisplayService.getSupportedCurrencies();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadData(): void {
    this.loadBudgets();
    this.categories = this.categoryService.getCategories().filter(c => c.type === 'expense');
    this.summary = this.budgetService.getBudgetSummary();
  }

  private loadBudgets(): void {
    const budgets = this.budgetService.getBudgets();

    this.budgets = budgets.map(budget => {
      const category = this.categoryService.getCategoryById(budget.categoryId);
      const spent = this.budgetService.calculateSpent(budget);
      const remaining = this.budgetService.getRemainingAmount(budget);
      const percentage = this.budgetService.getSpentPercentage(budget);

      let status: 'ok' | 'warning' | 'danger' = 'ok';
      if (this.budgetService.isOverLimit(budget)) {
        status = 'danger';
      } else if (this.budgetService.isNearLimit(budget)) {
        status = 'warning';
      }

      return {
        ...budget,
        categoryName: category?.name || 'Categoría eliminada',
        categoryColor: category?.color || '#6b7280',
        categoryIcon: category?.icon || 'pi-question',
        spent,
        remaining,
        percentage: Math.min(100, percentage),
        status
      };
    });

    // Aplicar filtros
    this.applyFilters();

    // Actualizar resumen
    this.summary = this.budgetService.getBudgetSummary();
  }

  applyFilters(): void {
    let filtered = [...this.budgets];

    if (this.filterPeriod !== 'all') {
      filtered = filtered.filter(b => b.period === this.filterPeriod);
    }

    if (this.filterCategory !== 'all') {
      filtered = filtered.filter(b => b.categoryId === this.filterCategory);
    }

    this.budgets = filtered;
  }

  openBudgetDialog(): void {
    this.isEditing = false;
    this.editingBudget = null;
    this.budgetForm = {
      name: '',
      categoryId: '',
      limit: 0,
      currency: this.currencyDisplayService.getPreferredCurrency(),
      period: 'monthly',
      alertThreshold: 80
    };
    this.showBudgetDialog = true;
  }

  openEditDialog(budget: BudgetWithStats): void {
    this.isEditing = true;
    this.editingBudget = budget;
    this.budgetForm = {
      name: budget.name,
      categoryId: budget.categoryId,
      limit: budget.limit,
      currency: budget.currency,
      period: budget.period,
      alertThreshold: budget.alertThreshold || 80
    };
    this.showBudgetDialog = true;
  }

  closeBudgetDialog(): void {
    this.showBudgetDialog = false;
    this.isEditing = false;
    this.editingBudget = null;
  }

  saveBudget(): void {
    // Validaciones
    if (!this.budgetForm.name.trim()) {
      this.toastService.warn('Nombre requerido', 'Por favor ingresa un nombre para el presupuesto');
      return;
    }

    if (!this.budgetForm.categoryId) {
      this.toastService.warn('Categoría requerida', 'Por favor selecciona una categoría');
      return;
    }

    if (this.budgetForm.limit <= 0) {
      this.toastService.warn('Límite inválido', 'El límite debe ser mayor a 0');
      return;
    }

    try {
      if (this.isEditing && this.editingBudget) {
        // Actualizar presupuesto existente
        this.budgetService.updateBudget(this.editingBudget.id, {
          name: this.budgetForm.name.trim(),
          categoryId: this.budgetForm.categoryId,
          limit: this.budgetForm.limit,
          currency: this.budgetForm.currency,
          period: this.budgetForm.period,
          alertThreshold: this.budgetForm.alertThreshold
        });
        this.toastService.success('Presupuesto actualizado', 'El presupuesto se actualizó correctamente');
      } else {
        // Crear nuevo presupuesto
        this.budgetService.addBudget({
          name: this.budgetForm.name.trim(),
          categoryId: this.budgetForm.categoryId,
          limit: this.budgetForm.limit,
          currency: this.budgetForm.currency,
          period: this.budgetForm.period,
          alertThreshold: this.budgetForm.alertThreshold
        });
        this.toastService.success('Presupuesto creado', 'El presupuesto se creó correctamente');
      }

      this.closeBudgetDialog();
      this.loadBudgets();
    } catch (error) {
      console.error('Error saving budget:', error);
      this.toastService.error('Error', 'Hubo un error al guardar el presupuesto');
    }
  }

  deleteBudget(budget: BudgetWithStats): void {
    if (confirm(`¿Estás seguro de eliminar el presupuesto "${budget.name}"?`)) {
      this.budgetService.deleteBudget(budget.id);
      this.toastService.success('Presupuesto eliminado', 'El presupuesto se eliminó correctamente');
      this.loadBudgets();
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'ok':
        return '#10b981'; // green
      case 'warning':
        return '#f59e0b'; // amber
      case 'danger':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ok':
        return 'En rango';
      case 'warning':
        return 'Cerca del límite';
      case 'danger':
        return 'Excedido';
      default:
        return 'Desconocido';
    }
  }

  getPeriodLabel(period: BudgetPeriod): string {
    const periodMap: Record<BudgetPeriod, string> = {
      weekly: 'Semanal',
      monthly: 'Mensual',
      yearly: 'Anual'
    };
    return periodMap[period] || period;
  }

  formatCurrency(amount: number, currency: string): string {
    return this.currencyDisplayService.formatCurrency(amount, currency);
  }
}

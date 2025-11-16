import { Component, OnInit } from '@angular/core';
import { BillingService } from '../../services/billing.service';
import { MonthlyBilling, MONOTRIBUTO_CATEGORIES, RECATEGORIZATION_PERIODS } from '../../models/billing.model';

@Component({
  selector: 'app-billing',
  templateUrl: './billing.page.html',
  styleUrls: ['./billing.page.scss'],
  standalone: false
})
export class BillingPage implements OnInit {
  billings: MonthlyBilling[] = [];
  monotributoCategories = MONOTRIBUTO_CATEGORIES;
  recategorizationPeriods = RECATEGORIZATION_PERIODS;

  currentCategory: string = 'A';
  suggestedCategory: string = 'A';
  last12MonthsTotal: number = 0;
  canRecategorize: boolean = false;
  nextRecategorizationPeriod: string = '';

  showBillingDialog: boolean = false;
  isEditing: boolean = false;
  editingId: string | null = null;

  billingForm = {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    amount: 0,
    description: ''
  };

  months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  years: number[] = [];

  constructor(private billingService: BillingService) {
    // Generar últimos 5 años y próximos 2
    const currentYear = new Date().getFullYear();
    for (let i = -5; i <= 2; i++) {
      this.years.push(currentYear + i);
    }
  }

  ngOnInit(): void {
    this.loadData();
    this.billingService.billings$.subscribe(() => {
      this.loadData();
    });
  }

  loadData(): void {
    this.billings = this.billingService.getBillings().sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    this.currentCategory = this.billingService.getCurrentCategory();
    this.suggestedCategory = this.billingService.getSuggestedCategory();
    this.last12MonthsTotal = this.billingService.getLast12MonthsTotal();

    const recatPeriod = this.billingService.isRecategorizationPeriod();
    this.canRecategorize = recatPeriod.canRecategorize;
    this.nextRecategorizationPeriod = recatPeriod.nextPeriod;
  }

  openBillingDialog(): void {
    this.isEditing = false;
    this.editingId = null;
    this.billingForm = {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      amount: 0,
      description: ''
    };
    this.showBillingDialog = true;
  }

  openEditDialog(billing: MonthlyBilling): void {
    this.isEditing = true;
    this.editingId = billing.id;
    this.billingForm = {
      month: billing.month,
      year: billing.year,
      amount: billing.amount,
      description: billing.description || ''
    };
    this.showBillingDialog = true;
  }

  saveBilling(): void {
    if (this.billingForm.amount <= 0) {
      alert('El monto debe ser mayor a 0');
      return;
    }

    if (this.isEditing && this.editingId) {
      this.billingService.updateBilling(this.editingId, {
        month: this.billingForm.month,
        year: this.billingForm.year,
        amount: this.billingForm.amount,
        description: this.billingForm.description
      });
    } else {
      this.billingService.createBilling({
        month: this.billingForm.month,
        year: this.billingForm.year,
        amount: this.billingForm.amount,
        description: this.billingForm.description
      });
    }

    this.showBillingDialog = false;
  }

  deleteBilling(id: string): void {
    if (confirm('¿Estás seguro de eliminar esta facturación?')) {
      this.billingService.deleteBilling(id);
    }
  }

  updateCurrentCategory(category: string): void {
    this.billingService.setCurrentCategory(category);
    this.currentCategory = category;
  }

  getMonthName(month: number): string {
    return this.months.find(m => m.value === month)?.label || '';
  }

  getCategoryInfo(category: string) {
    return this.monotributoCategories.find(c => c.category === category);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  getCategoryColor(category: string): string {
    const index = this.monotributoCategories.findIndex(c => c.category === category);
    const colors = ['#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'];
    return colors[index] || '#6b7280';
  }

  needsRecategorization(): boolean {
    return this.currentCategory !== this.suggestedCategory;
  }

  getRecategorizationMessage(): string {
    if (!this.needsRecategorization()) {
      return 'Tu categoría actual es correcta para tu facturación';
    }

    if (this.suggestedCategory === 'EXCEDE') {
      return 'Tu facturación excede el límite del Monotributo. Deberías considerar pasar a Responsable Inscripto';
    }

    const currentCat = this.getCategoryInfo(this.currentCategory);
    const suggestedCat = this.getCategoryInfo(this.suggestedCategory);

    if (!currentCat || !suggestedCat) return '';

    const currentIndex = this.monotributoCategories.findIndex(c => c.category === this.currentCategory);
    const suggestedIndex = this.monotributoCategories.findIndex(c => c.category === this.suggestedCategory);

    if (suggestedIndex > currentIndex) {
      return `Deberías aumentar a categoría ${this.suggestedCategory}. ${this.canRecategorize ? 'Podés hacerlo ahora.' : 'Próximo período: ' + this.nextRecategorizationPeriod}`;
    } else {
      return `Podrías bajar a categoría ${this.suggestedCategory} y ahorrar ${this.formatCurrency(currentCat.monthlyFee - suggestedCat.monthlyFee)}/mes. ${this.canRecategorize ? 'Podés hacerlo ahora.' : 'Próximo período: ' + this.nextRecategorizationPeriod}`;
    }
  }
}

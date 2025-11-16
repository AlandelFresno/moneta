import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MonthlyBilling, MONOTRIBUTO_CATEGORIES } from '../models/billing.model';

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private readonly STORAGE_KEY = 'budget_monthly_billing';
  private readonly CURRENT_CATEGORY_KEY = 'budget_current_monotributo_category';

  private billingsSubject = new BehaviorSubject<MonthlyBilling[]>([]);
  public billings$ = this.billingsSubject.asObservable();

  private currentCategorySubject = new BehaviorSubject<string>('A');
  public currentCategory$ = this.currentCategorySubject.asObservable();

  constructor() {
    this.loadBillings();
    this.loadCurrentCategory();
  }

  private loadBillings(): void {
    console.log('🔄 [BillingService] Cargando facturaciones...');
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const billings = JSON.parse(stored, (key, value) => {
          if (key === 'createdAt' || key === 'updatedAt') {
            return new Date(value);
          }
          return value;
        });
        console.log('✅ [BillingService] Facturaciones cargadas:', billings.length);
        this.billingsSubject.next(billings);
      } catch (error) {
        console.error('❌ [BillingService] Error loading billings:', error);
        this.billingsSubject.next([]);
      }
    } else {
      console.log('⚠️ [BillingService] No hay facturaciones guardadas');
    }
  }

  private saveBillings(billings: MonthlyBilling[]): void {
    console.log('💾 [BillingService] Guardando facturaciones:', billings.length);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(billings));
    this.billingsSubject.next(billings);
  }

  private loadCurrentCategory(): void {
    const stored = localStorage.getItem(this.CURRENT_CATEGORY_KEY);
    if (stored) {
      this.currentCategorySubject.next(stored);
    }
  }

  private saveCurrentCategory(category: string): void {
    localStorage.setItem(this.CURRENT_CATEGORY_KEY, category);
    this.currentCategorySubject.next(category);
  }

  getBillings(): MonthlyBilling[] {
    return this.billingsSubject.value;
  }

  getBillingById(id: string): MonthlyBilling | undefined {
    return this.billingsSubject.value.find(b => b.id === id);
  }

  getCurrentCategory(): string {
    return this.currentCategorySubject.value;
  }

  setCurrentCategory(category: string): void {
    this.saveCurrentCategory(category);
  }

  createBilling(billingData: Omit<MonthlyBilling, 'id' | 'createdAt' | 'updatedAt'>): MonthlyBilling {
    console.log('➕ [BillingService] Creando facturación:', billingData);

    const newBilling: MonthlyBilling = {
      ...billingData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const billings = this.billingsSubject.value;
    this.saveBillings([...billings, newBilling]);

    console.log('✅ [BillingService] Facturación creada:', newBilling.id);
    return newBilling;
  }

  updateBilling(id: string, updates: Partial<MonthlyBilling>): void {
    console.log('📝 [BillingService] Actualizando facturación:', id);

    const billings = this.billingsSubject.value;
    const index = billings.findIndex(b => b.id === id);

    if (index !== -1) {
      billings[index] = {
        ...billings[index],
        ...updates,
        updatedAt: new Date()
      };
      this.saveBillings([...billings]);
      console.log('✅ [BillingService] Facturación actualizada');
    } else {
      console.warn('⚠️ [BillingService] Facturación no encontrada:', id);
    }
  }

  deleteBilling(id: string): void {
    console.log('🗑️ [BillingService] Eliminando facturación:', id);

    const billings = this.billingsSubject.value.filter(b => b.id !== id);
    this.saveBillings(billings);

    console.log('✅ [BillingService] Facturación eliminada');
  }

  /**
   * Calcula el total facturado en los últimos 12 meses
   */
  getLast12MonthsTotal(): number {
    const billings = this.billingsSubject.value;
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

    const recentBillings = billings.filter(billing => {
      const billingDate = new Date(billing.year, billing.month - 1, 1);
      return billingDate >= twelveMonthsAgo && billingDate <= now;
    });

    return recentBillings.reduce((sum, billing) => sum + billing.amount, 0);
  }

  /**
   * Obtiene la categoría de Monotributo sugerida basada en la facturación
   */
  getSuggestedCategory(): string {
    const total = this.getLast12MonthsTotal();

    for (const category of MONOTRIBUTO_CATEGORIES) {
      if (total <= category.maxAnnualBilling) {
        return category.category;
      }
    }

    // Si excede todas las categorías, excede el monotributo
    return 'EXCEDE';
  }

  /**
   * Verifica si estamos en un período de recategorización
   */
  isRecategorizationPeriod(): { canRecategorize: boolean; nextPeriod: string } {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12

    if (currentMonth === 1) {
      return { canRecategorize: true, nextPeriod: 'Enero (ahora) - Recategorización anual' };
    } else if (currentMonth === 7) {
      return { canRecategorize: true, nextPeriod: 'Julio (ahora) - Recategorización semestral' };
    } else if (currentMonth < 7) {
      return { canRecategorize: false, nextPeriod: 'Julio - Recategorización semestral' };
    } else {
      return { canRecategorize: false, nextPeriod: 'Enero próximo año - Recategorización anual' };
    }
  }

  /**
   * Obtiene facturaciones por año
   */
  getBillingsByYear(year: number): MonthlyBilling[] {
    return this.billingsSubject.value
      .filter(billing => billing.year === year)
      .sort((a, b) => a.month - b.month);
  }

  /**
   * Calcula el total del año
   */
  getYearTotal(year: number): number {
    return this.getBillingsByYear(year).reduce((sum, billing) => sum + billing.amount, 0);
  }

  private generateId(): string {
    return `billing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

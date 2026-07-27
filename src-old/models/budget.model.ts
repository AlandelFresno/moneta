export interface Budget {
  id: string;
  name: string;
  categoryId: string; // ID de la categoría a la que aplica este presupuesto
  limit: number; // Límite del presupuesto
  currency: string; // Moneda del presupuesto
  period: 'monthly' | 'weekly' | 'yearly'; // Período del presupuesto
  startDate?: Date; // Fecha de inicio (para períodos personalizados)
  endDate?: Date; // Fecha de fin (para períodos personalizados)
  alertThreshold?: number; // Porcentaje para alertar (ej: 80 = alerta al 80%)
  createdAt: Date;
  updatedAt: Date;
}

export type BudgetPeriod = Budget['period'];

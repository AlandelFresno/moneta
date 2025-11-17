export interface MonthlyBilling {
  id: string;
  month: number;        // 1-12
  year: number;
  amount: number;       // Monto facturado en el mes
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonotributoCategory {
  category: string;     // A, B, C, D, E, F, G, H, I, J, K
  maxAnnualBilling: number;  // Límite de facturación anual
  maxMonthlyBilling: number; // Límite promedio mensual (anual / 12)
  monthlyFee: number;   // Cuota mensual aproximada (componente impositivo + obra social + jubilación)
  description: string;
}

export const MONOTRIBUTO_CATEGORIES: MonotributoCategory[] = [
  { category: 'A', maxAnnualBilling: 8992597.87, maxMonthlyBilling: 749383.16, monthlyFee: 32221, description: 'Hasta $8.992.597,87/año' },
  { category: 'B', maxAnnualBilling: 13238896.81, maxMonthlyBilling: 1103241.40, monthlyFee: 36679, description: 'Hasta $13.238.896,81/año' },
  { category: 'C', maxAnnualBilling: 18485195.75, maxMonthlyBilling: 1540432.98, monthlyFee: 42467, description: 'Hasta $18.485.195,75/año' },
  { category: 'D', maxAnnualBilling: 22981494.68, maxMonthlyBilling: 1915124.56, monthlyFee: 54381, description: 'Hasta $22.981.494,68/año' },
  { category: 'E', maxAnnualBilling: 27027793.62, maxMonthlyBilling: 2252316.13, monthlyFee: 74192, description: 'Hasta $27.027.793,62/año' },
  { category: 'F', maxAnnualBilling: 33874092.56, maxMonthlyBilling: 2822841.05, monthlyFee: 91314, description: 'Hasta $33.874.092,56/año' },
  { category: 'G', maxAnnualBilling: 40420391.49, maxMonthlyBilling: 3368365.96, monthlyFee: 126579, description: 'Hasta $40.420.391,49/año' },
  { category: 'H', maxAnnualBilling: 61262783.87, maxMonthlyBilling: 5105231.99, monthlyFee: 273439, description: 'Hasta $61.262.783,87/año' },
  { category: 'I', maxAnnualBilling: 68209082.81, maxMonthlyBilling: 5684090.23, monthlyFee: 468007, description: 'Hasta $68.209.082,81/año' },
  { category: 'J', maxAnnualBilling: 74855381.74, maxMonthlyBilling: 6237948.48, monthlyFee: 568636, description: 'Hasta $74.855.381,74/año' },
  { category: 'K', maxAnnualBilling: 94805682.90, maxMonthlyBilling: 7900473.58, monthlyFee: 746049, description: 'Hasta $94.805.682,90/año' }
];

export interface RecategorizationPeriod {
  month: number;
  description: string;
}

export const RECATEGORIZATION_PERIODS: RecategorizationPeriod[] = [
  { month: 1, description: 'Enero - Recategorización anual obligatoria' },
  { month: 7, description: 'Julio - Recategorización semestral opcional' }
];

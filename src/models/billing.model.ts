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
  monthlyFee: number;   // Cuota mensual aproximada (componente impositivo + obra social)
  description: string;
}

export const MONOTRIBUTO_CATEGORIES: MonotributoCategory[] = [
  { category: 'A', maxAnnualBilling: 6450000, monthlyFee: 21000, description: 'Hasta $6.450.000/año' },
  { category: 'B', maxAnnualBilling: 9450000, monthlyFee: 23500, description: 'Hasta $9.450.000/año' },
  { category: 'C', maxAnnualBilling: 13250000, monthlyFee: 26500, description: 'Hasta $13.250.000/año' },
  { category: 'D', maxAnnualBilling: 16450000, monthlyFee: 30000, description: 'Hasta $16.450.000/año' },
  { category: 'E', maxAnnualBilling: 19350000, monthlyFee: 33500, description: 'Hasta $19.350.000/año' },
  { category: 'F', maxAnnualBilling: 24250000, monthlyFee: 37500, description: 'Hasta $24.250.000/año' },
  { category: 'G', maxAnnualBilling: 29000000, monthlyFee: 42500, description: 'Hasta $29.000.000/año' },
  { category: 'H', maxAnnualBilling: 44000000, monthlyFee: 54000, description: 'Hasta $44.000.000/año' },
  { category: 'I', maxAnnualBilling: 49000000, monthlyFee: 61000, description: 'Hasta $49.000.000/año' },
  { category: 'J', maxAnnualBilling: 54000000, monthlyFee: 68500, description: 'Hasta $54.000.000/año' },
  { category: 'K', maxAnnualBilling: 68000000, monthlyFee: 83000, description: 'Hasta $68.000.000/año' }
];

export interface RecategorizationPeriod {
  month: number;
  description: string;
}

export const RECATEGORIZATION_PERIODS: RecategorizationPeriod[] = [
  { month: 1, description: 'Enero - Recategorización anual obligatoria' },
  { month: 7, description: 'Julio - Recategorización semestral opcional' }
];

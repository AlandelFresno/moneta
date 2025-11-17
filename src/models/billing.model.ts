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
  monthlyFeeServices: number;   // Cuota mensual para servicios (impuesto + SIPA + obra social)
  monthlyFeeGoods: number;      // Cuota mensual para venta de bienes (impuesto + SIPA + obra social)
  description: string;
}

export const MONOTRIBUTO_CATEGORIES: MonotributoCategory[] = [
  { category: 'A', maxAnnualBilling: 8992597.87, maxMonthlyBilling: 749383.16, monthlyFeeServices: 37085.74, monthlyFeeGoods: 37085.74, description: 'Hasta $8.992.597,87/año' },
  { category: 'B', maxAnnualBilling: 13175201.52, maxMonthlyBilling: 1097933.46, monthlyFeeServices: 42216.41, monthlyFeeGoods: 42216.41, description: 'Hasta $13.175.201,52/año' },
  { category: 'C', maxAnnualBilling: 18473166.15, maxMonthlyBilling: 1539430.51, monthlyFeeServices: 49435.58, monthlyFeeGoods: 48320.22, description: 'Hasta $18.473.166,15/año' },
  { category: 'D', maxAnnualBilling: 22934610.05, maxMonthlyBilling: 1911217.50, monthlyFeeServices: 63357.80, monthlyFeeGoods: 61824.18, description: 'Hasta $22.934.610,05/año' },
  { category: 'E', maxAnnualBilling: 26977793.60, maxMonthlyBilling: 2248149.47, monthlyFeeServices: 89714.31, monthlyFeeGoods: 81070.26, description: 'Hasta $26.977.793,60/año' },
  { category: 'F', maxAnnualBilling: 33809379.57, maxMonthlyBilling: 2817448.30, monthlyFeeServices: 112906.59, monthlyFeeGoods: 97291.54, description: 'Hasta $33.809.379,57/año' },
  { category: 'G', maxAnnualBilling: 40431835.35, maxMonthlyBilling: 3369319.61, monthlyFeeServices: 172457.38, monthlyFeeGoods: 118920.05, description: 'Hasta $40.431.835,35/año' },
  { category: 'H', maxAnnualBilling: 61344853.64, maxMonthlyBilling: 5112071.14, monthlyFeeServices: 391400.62, monthlyFeeGoods: 238038.48, description: 'Hasta $61.344.853,64/año' },
  { category: 'I', maxAnnualBilling: 68664410.05, maxMonthlyBilling: 5722034.17, monthlyFeeServices: 721650.46, monthlyFeeGoods: 355672.64, description: 'Hasta $68.664.410,05/año' },
  { category: 'J', maxAnnualBilling: 78632948.76, maxMonthlyBilling: 6552745.73, monthlyFeeServices: 874069.29, monthlyFeeGoods: 434895.92, description: 'Hasta $78.632.948,76/año' },
  { category: 'K', maxAnnualBilling: 94805682.90, maxMonthlyBilling: 7900473.58, monthlyFeeServices: 1208890.60, monthlyFeeGoods: 525732.01, description: 'Hasta $94.805.682,90/año' }
];

export interface RecategorizationPeriod {
  month: number;
  description: string;
}

export const RECATEGORIZATION_PERIODS: RecategorizationPeriod[] = [
  { month: 1, description: 'Enero - Recategorización anual obligatoria' },
  { month: 7, description: 'Julio - Recategorización semestral opcional' }
];

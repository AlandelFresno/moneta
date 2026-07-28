export interface FuelLog {
  id: string;
  vehicleId: string;         // ID del vehículo
  date: Date;                // Fecha de la carga

  // Datos de la carga
  liters: number;            // Cantidad de combustible cargado (litros)
  pricePerLiter: number;     // Precio por litro
  totalPrice: number;        // Precio total de la carga
  currency: string;          // Moneda de la transacción (USD, ARS, EUR, etc.)

  // Datos de kilometraje
  kmTraveled: number;        // Km recorridos desde la última carga
  totalKm: number;           // Kilometraje total del vehículo

  // Datos calculados
  efficiency: number;        // Rendimiento: km/litro
  costPerKm: number;         // Costo por kilómetro

  // Otros datos
  fullTank: boolean;         // Si llenó el tanque completo
  gasStation?: string;       // Nombre de la estación de servicio
  notes?: string;            // Notas adicionales

  createdAt: Date;
  updatedAt: Date;
}

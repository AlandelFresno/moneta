export interface Vehicle {
  id: string;
  name: string;              // Nombre/apodo del vehículo (ej: "Mi Auto", "Moto")
  brand: string;             // Marca (ej: "Toyota", "Honda")
  model: string;             // Modelo (ej: "Corolla", "Civic")
  year: number;              // Año
  plateNumber?: string;      // Patente/Placa (opcional)
  currentKm: number;         // Kilometraje actual
  tankCapacity?: number;     // Capacidad del tanque en litros (opcional)
  fuelType: 'gasoline' | 'diesel' | 'premium' | 'electric'; // Tipo de combustible
  color?: string;            // Color para identificación visual
  notes?: string;            // Notas adicionales
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

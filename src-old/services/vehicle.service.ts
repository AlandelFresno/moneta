import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Vehicle } from '../models/vehicle.model';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private readonly STORAGE_KEY = 'budget_vehicles';
  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  public vehicles$ = this.vehiclesSubject.asObservable();

  constructor() {
    this.loadVehicles();
  }

  private loadVehicles(): void {
    console.log('🔄 [VehicleService] Cargando vehículos...');
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const vehicles = JSON.parse(stored, (key, value) => {
          if (key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt') {
            return value ? new Date(value) : undefined;
          }
          return value;
        }).filter((v: any) => !v.deletedAt);
        console.log('✅ [VehicleService] Vehículos cargados:', vehicles.length);
        this.vehiclesSubject.next(vehicles);
      } catch (error) {
        console.error('❌ [VehicleService] Error loading vehicles:', error);
        this.vehiclesSubject.next([]);
      }
    } else {
      console.log('⚠️ [VehicleService] No hay vehículos guardados');
    }
  }

  private saveVehicles(vehicles: Vehicle[]): void {
    console.log('💾 [VehicleService] Guardando vehículos:', vehicles.length);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vehicles));
    this.vehiclesSubject.next(vehicles);
  }

  getVehicles(): Vehicle[] {
    return this.vehiclesSubject.value;
  }

  getVehicleById(id: string): Vehicle | undefined {
    return this.vehiclesSubject.value.find(v => v.id === id);
  }

  createVehicle(vehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Vehicle {
    console.log('➕ [VehicleService] Creando vehículo:', vehicleData.name);

    const newVehicle: Vehicle = {
      ...vehicleData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const vehicles = this.vehiclesSubject.value;
    this.saveVehicles([...vehicles, newVehicle]);

    console.log('✅ [VehicleService] Vehículo creado:', newVehicle.id);
    return newVehicle;
  }

  updateVehicle(id: string, updates: Partial<Vehicle>): void {
    console.log('📝 [VehicleService] Actualizando vehículo:', id);

    const vehicles = this.vehiclesSubject.value;
    const index = vehicles.findIndex(v => v.id === id);

    if (index !== -1) {
      vehicles[index] = {
        ...vehicles[index],
        ...updates,
        updatedAt: new Date()
      };
      this.saveVehicles([...vehicles]);
      console.log('✅ [VehicleService] Vehículo actualizado');
    } else {
      console.warn('⚠️ [VehicleService] Vehículo no encontrado:', id);
    }
  }

  deleteVehicle(id: string): void {
    console.log('🗑️ [VehicleService] Eliminando vehículo:', id);

    const stored = localStorage.getItem(this.STORAGE_KEY);
    const all = stored ? JSON.parse(stored) : [];
    const updated = all.map((v: any) =>
      v.id === id ? { ...v, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : v
    );
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    this.vehiclesSubject.next(this.vehiclesSubject.value.filter(v => v.id !== id));

    console.log('✅ [VehicleService] Vehículo eliminado');
  }

  private generateId(): string {
    return `vehicle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

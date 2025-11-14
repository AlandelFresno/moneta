import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { FuelLog } from '../models/fuel-log.model';
import { VehicleService } from './vehicle.service';

@Injectable({
  providedIn: 'root'
})
export class FuelLogService {
  private readonly STORAGE_KEY = 'budget_fuel_logs';
  private logsSubject = new BehaviorSubject<FuelLog[]>([]);
  public logs$ = this.logsSubject.asObservable();

  constructor(private vehicleService: VehicleService) {
    this.loadLogs();
  }

  private loadLogs(): void {
    console.log('🔄 [FuelLogService] Cargando registros de combustible...');
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const logs = JSON.parse(stored, (key, value) => {
          if (key === 'date' || key === 'createdAt' || key === 'updatedAt') {
            return new Date(value);
          }
          return value;
        });
        console.log('✅ [FuelLogService] Registros cargados:', logs.length);
        this.logsSubject.next(logs);
      } catch (error) {
        console.error('❌ [FuelLogService] Error loading logs:', error);
        this.logsSubject.next([]);
      }
    } else {
      console.log('⚠️ [FuelLogService] No hay registros guardados');
    }
  }

  private saveLogs(logs: FuelLog[]): void {
    console.log('💾 [FuelLogService] Guardando registros:', logs.length);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    this.logsSubject.next(logs);
  }

  getLogs(): FuelLog[] {
    return this.logsSubject.value;
  }

  getLogsByVehicle(vehicleId: string): FuelLog[] {
    return this.logsSubject.value
      .filter(log => log.vehicleId === vehicleId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  getLastLog(vehicleId: string): FuelLog | undefined {
    const logs = this.getLogsByVehicle(vehicleId);
    return logs.length > 0 ? logs[0] : undefined;
  }

  createLog(logData: Omit<FuelLog, 'id' | 'createdAt' | 'updatedAt'>): FuelLog {
    console.log('➕ [FuelLogService] Creando registro de combustible:', {
      vehicleId: logData.vehicleId,
      liters: logData.liters,
      currentKm: logData.currentKm
    });

    const newLog: FuelLog = {
      ...logData,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const logs = this.logsSubject.value;
    this.saveLogs([...logs, newLog]);

    // Actualizar el kilometraje del vehículo
    this.vehicleService.updateVehicle(logData.vehicleId, {
      currentKm: logData.currentKm
    });

    console.log('✅ [FuelLogService] Registro creado:', {
      id: newLog.id,
      efficiency: `${newLog.efficiency.toFixed(2)} km/L`,
      costPerKm: `$${newLog.costPerKm.toFixed(2)}/km`
    });

    return newLog;
  }

  updateLog(id: string, updates: Partial<FuelLog>): void {
    console.log('📝 [FuelLogService] Actualizando registro:', id);

    const logs = this.logsSubject.value;
    const index = logs.findIndex(l => l.id === id);

    if (index !== -1) {
      logs[index] = {
        ...logs[index],
        ...updates,
        updatedAt: new Date()
      };
      this.saveLogs([...logs]);
      console.log('✅ [FuelLogService] Registro actualizado');
    } else {
      console.warn('⚠️ [FuelLogService] Registro no encontrado:', id);
    }
  }

  deleteLog(id: string): void {
    console.log('🗑️ [FuelLogService] Eliminando registro:', id);

    const logs = this.logsSubject.value.filter(l => l.id !== id);
    this.saveLogs(logs);

    console.log('✅ [FuelLogService] Registro eliminado');
  }

  deleteLogsByVehicle(vehicleId: string): void {
    console.log('🗑️ [FuelLogService] Eliminando todos los registros del vehículo:', vehicleId);

    const logs = this.logsSubject.value.filter(l => l.vehicleId !== vehicleId);
    this.saveLogs(logs);

    console.log('✅ [FuelLogService] Registros eliminados');
  }

  // Cálculos y estadísticas
  calculateAverageEfficiency(vehicleId: string): number {
    const logs = this.getLogsByVehicle(vehicleId);
    if (logs.length === 0) return 0;

    const totalEfficiency = logs.reduce((sum, log) => sum + log.efficiency, 0);
    return totalEfficiency / logs.length;
  }

  calculateAverageCostPerKm(vehicleId: string): number {
    const logs = this.getLogsByVehicle(vehicleId);
    if (logs.length === 0) return 0;

    const totalCost = logs.reduce((sum, log) => sum + log.costPerKm, 0);
    return totalCost / logs.length;
  }

  getTotalSpent(vehicleId: string): number {
    const logs = this.getLogsByVehicle(vehicleId);
    return logs.reduce((sum, log) => sum + log.totalPrice, 0);
  }

  getTotalLiters(vehicleId: string): number {
    const logs = this.getLogsByVehicle(vehicleId);
    return logs.reduce((sum, log) => sum + log.liters, 0);
  }

  getTotalKm(vehicleId: string): number {
    const logs = this.getLogsByVehicle(vehicleId);
    return logs.reduce((sum, log) => sum + log.kmSinceLastFill, 0);
  }

  private generateId(): string {
    return `fuellog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

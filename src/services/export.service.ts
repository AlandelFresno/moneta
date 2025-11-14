import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { FuelLog } from '../models/fuel-log.model';
import { Vehicle } from '../models/vehicle.model';
import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() {}

  /**
   * Exportar registros de combustible a Excel
   */
  exportFuelLogsToExcel(logs: FuelLog[], vehicles: Vehicle[], fileName: string = 'combustible'): void {
    console.log('📤 [ExportService] Exportando registros de combustible a Excel...');

    // Preparar datos para exportación
    const data = logs.map(log => {
      const vehicle = vehicles.find(v => v.id === log.vehicleId);
      return {
        'Fecha': this.formatDate(log.date),
        'Vehículo': vehicle ? `${vehicle.name} (${vehicle.brand} ${vehicle.model})` : 'N/A',
        'Litros': log.liters,
        'Precio por Litro': log.pricePerLiter,
        'Precio Total': log.totalPrice,
        'Moneda': log.currency,
        'Km Recorridos': log.kmTraveled,
        'Km Total': log.totalKm,
        'Rendimiento (km/L)': log.efficiency.toFixed(2),
        'Costo por km': log.costPerKm > 0 && isFinite(log.costPerKm) ? log.costPerKm.toFixed(2) : 'N/A',
        'Tanque Lleno': log.fullTank ? 'Sí' : 'No',
        'Estación': log.gasStation || '',
        'Notas': log.notes || ''
      };
    });

    // Crear libro de trabajo
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');

    // Guardar archivo
    XLSX.writeFile(workbook, `${fileName}_${this.getTimestamp()}.xlsx`);
    console.log('✅ [ExportService] Archivo Excel creado exitosamente');
  }

  /**
   * Exportar vehículos a Excel
   */
  exportVehiclesToExcel(vehicles: Vehicle[], fileName: string = 'vehiculos'): void {
    console.log('📤 [ExportService] Exportando vehículos a Excel...');

    const data = vehicles.map(vehicle => ({
      'Nombre': vehicle.name,
      'Marca': vehicle.brand,
      'Modelo': vehicle.model,
      'Año': vehicle.year,
      'Patente': vehicle.plateNumber || '',
      'Km Actual': vehicle.currentKm,
      'Capacidad Tanque (L)': vehicle.tankCapacity || '',
      'Tipo Combustible': vehicle.fuelType,
      'Color': vehicle.color || '',
      'Notas': vehicle.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vehículos');

    XLSX.writeFile(workbook, `${fileName}_${this.getTimestamp()}.xlsx`);
    console.log('✅ [ExportService] Archivo Excel creado exitosamente');
  }

  /**
   * Exportar transacciones a Excel
   */
  exportTransactionsToExcel(transactions: Transaction[], fileName: string = 'transacciones'): void {
    console.log('📤 [ExportService] Exportando transacciones a Excel...');

    const data = transactions.map(transaction => ({
      'Fecha': this.formatDate(transaction.date),
      'Descripción': transaction.description,
      'Monto': transaction.amount,
      'Moneda': transaction.currency,
      'Tipo': transaction.type === 'income' ? 'Ingreso' : 'Gasto',
      'Categoría ID': transaction.categoryId,
      'Cuenta ID': transaction.accountId
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones');

    XLSX.writeFile(workbook, `${fileName}_${this.getTimestamp()}.xlsx`);
    console.log('✅ [ExportService] Archivo Excel creado exitosamente');
  }

  /**
   * Importar registros de combustible desde Excel
   */
  async importFuelLogsFromExcel(file: File): Promise<Partial<FuelLog>[]> {
    console.log('📥 [ExportService] Importando registros de combustible desde Excel...');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);

          const logs: Partial<FuelLog>[] = jsonData.map((row: any) => ({
            date: this.parseDate(row['Fecha']),
            liters: parseFloat(row['Litros']) || 0,
            pricePerLiter: parseFloat(row['Precio por Litro']) || 0,
            totalPrice: parseFloat(row['Precio Total']) || 0,
            currency: row['Moneda'] || 'USD',
            kmTraveled: parseFloat(row['Km Recorridos']) || 0,
            totalKm: parseFloat(row['Km Total']) || 0,
            efficiency: parseFloat(row['Rendimiento (km/L)']) || 0,
            costPerKm: this.parseCostPerKm(row['Costo por km']),
            fullTank: row['Tanque Lleno'] === 'Sí',
            gasStation: row['Estación'] || '',
            notes: row['Notas'] || ''
          }));

          console.log('✅ [ExportService] Datos importados:', logs.length, 'registros');
          resolve(logs);
        } catch (error) {
          console.error('❌ [ExportService] Error al importar:', error);
          reject(error);
        }
      };

      reader.onerror = (error) => {
        console.error('❌ [ExportService] Error al leer archivo:', error);
        reject(error);
      };

      reader.readAsBinaryString(file);
    });
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private parseDate(dateStr: string): Date {
    // Formato esperado: DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date();
  }

  private parseCostPerKm(value: any): number {
    if (value === 'N/A' || value === '' || value === null || value === undefined) {
      return 0;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}_${hour}${minute}`;
  }
}

import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { FuelLog } from '../models/fuel-log.model';
import { Vehicle } from '../models/vehicle.model';
import { Transaction } from '../models/transaction.model';
import { Category } from '../models/category.model';
import { Account } from '../models/account.model';
import { MonthlyBilling } from '../models/billing.model';
import { UserPreferences } from './preferences.service';
import { GoogleDriveService } from './google-drive.service';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor(private googleDriveService: GoogleDriveService) {}

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

  /**
   * Exportar todos los datos de la aplicación a Excel
   */
  exportAllData(
    transactions: Transaction[],
    vehicles: Vehicle[],
    fuelLogs: FuelLog[],
    categories: Category[],
    accounts: Account[],
    preferences: UserPreferences,
    billings: MonthlyBilling[]
  ): { success: boolean; message: string; hasData: boolean } {
    console.log('📤 [ExportService] Exportando todos los datos de la aplicación...');
    console.log('📊 [ExportService] Datos recibidos:', {
      transactions: transactions.length,
      vehicles: vehicles.length,
      fuelLogs: fuelLogs.length,
      categories: categories.length,
      accounts: accounts.length,
      billings: billings.length,
      preferences: preferences
    });

    // Verificar si hay datos para exportar (siempre exportamos categorías, cuentas y preferencias)
    const hasData = transactions.length > 0 || vehicles.length > 0 || fuelLogs.length > 0 ||
                    categories.length > 0 || accounts.length > 0 || billings.length > 0;

    if (!hasData) {
      console.warn('⚠️ [ExportService] No hay datos para exportar');
      return {
        success: false,
        message: 'No hay datos para exportar. Agrega transacciones, vehículos, categorías o cuentas primero.',
        hasData: false
      };
    }

    try {
      const workbook = XLSX.utils.book_new();
      let sheetsAdded = 0;

      // Hoja 1: Transacciones
      if (transactions.length > 0) {
        const transactionsData = transactions.map(transaction => {
          const category = categories.find(c => c.id === transaction.categoryId);
          const account = accounts.find(a => a.id === transaction.accountId);

          return {
            'ID': transaction.id,
            'Fecha': this.formatDate(transaction.date),
            'Descripción': transaction.description,
            'Monto': transaction.amount,
            'Moneda': transaction.currency,
            'Tipo': transaction.type === 'income' ? 'Ingreso' : 'Gasto',
            'Categoría': category ? category.name : 'N/A',
            'Categoría ID': transaction.categoryId,
            'Cuenta': account ? account.name : 'N/A',
            'Cuenta ID': transaction.accountId,
            // Tasas de cambio guardadas
            'Tasa a ARS': transaction.exchangeRates?.ARS || '',
            'Tasa a USD': transaction.exchangeRates?.USD || '',
            'Tasa a EUR': transaction.exchangeRates?.EUR || '',
            'Tasa a BRL': transaction.exchangeRates?.BRL || '',
            // Campos antiguos (para compatibilidad)
            'Monto Convertido': transaction.convertedAmount || '',
            'Tasa de Cambio (legacy)': transaction.conversionRate || '',
            'Fuente de Conversión': transaction.conversionSource || '',
            'Fecha de Conversión': transaction.conversionDate ? this.formatDate(transaction.conversionDate) : '',
            'Conversión Manual': transaction.manualConversion ? 'Sí' : 'No'
          };
        });
        const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transacciones');
        sheetsAdded++;
        console.log('✅ [ExportService] Hoja de transacciones agregada');
      }

      // Hoja 2: Vehículos
      if (vehicles.length > 0) {
        const vehiclesData = vehicles.map(vehicle => ({
          'ID': vehicle.id,
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
        const vehiclesSheet = XLSX.utils.json_to_sheet(vehiclesData);
        XLSX.utils.book_append_sheet(workbook, vehiclesSheet, 'Vehículos');
        sheetsAdded++;
        console.log('✅ [ExportService] Hoja de vehículos agregada');
      }

      // Hoja 3: Registros de Combustible
      if (fuelLogs.length > 0) {
        const fuelLogsData = fuelLogs.map(log => {
          const vehicle = vehicles.find(v => v.id === log.vehicleId);
          return {
            'ID': log.id,
            'Fecha': this.formatDate(log.date),
            'Vehículo': vehicle ? `${vehicle.name} (${vehicle.brand} ${vehicle.model})` : 'N/A',
            'Vehículo ID': log.vehicleId,
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
        const fuelLogsSheet = XLSX.utils.json_to_sheet(fuelLogsData);
        XLSX.utils.book_append_sheet(workbook, fuelLogsSheet, 'Combustible');
        sheetsAdded++;
        console.log('✅ [ExportService] Hoja de combustible agregada');
      }

      // Hoja 4: Categorías
      if (categories.length > 0) {
        const categoriesData = categories.map(category => ({
          'ID': category.id,
          'Nombre': category.name,
          'Tipo': category.type === 'income' ? 'Ingreso' : 'Gasto',
          'Color': category.color,
          'Icono': category.icon
        }));
        const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
        XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categorías');
        sheetsAdded++;
        console.log('✅ [ExportService] Hoja de categorías agregada');
      }

      // Hoja 5: Cuentas
      if (accounts.length > 0) {
        const accountsData = accounts.map(account => ({
          'ID': account.id,
          'Nombre': account.name,
          'Tipo': account.type,
          'Balance': account.balance,
          'Moneda': account.currency,
          'Color': account.color,
          'Icono': account.icon
        }));
        const accountsSheet = XLSX.utils.json_to_sheet(accountsData);
        XLSX.utils.book_append_sheet(workbook, accountsSheet, 'Cuentas');
        sheetsAdded++;
        console.log('✅ [ExportService] Hoja de cuentas agregada');
      }

      // Hoja 6: Facturación Mensual
      if (billings.length > 0) {
        const billingsData = billings.map(billing => ({
          'ID': billing.id,
          'Mes': this.getMonthName(billing.month),
          'Año': billing.year,
          'Monto': billing.amount,
          'Descripción': billing.description || ''
        })).sort((a, b) => {
          if (a['Año'] !== b['Año']) return b['Año'] - a['Año'];
          return this.getMonthNumber(b['Mes']) - this.getMonthNumber(a['Mes']);
        });
        const billingsSheet = XLSX.utils.json_to_sheet(billingsData);
        XLSX.utils.book_append_sheet(workbook, billingsSheet, 'Facturación');
        sheetsAdded++;
        console.log('✅ [ExportService] Hoja de facturación agregada');
      }

      // Hoja 7: Preferencias
      const preferencesData = [{
        'Moneda Preferida': preferences.preferredCurrency,
        'Locale': preferences.locale,
        'Tema': preferences.theme || 'light'
      }];
      const preferencesSheet = XLSX.utils.json_to_sheet(preferencesData);
      XLSX.utils.book_append_sheet(workbook, preferencesSheet, 'Preferencias');
      sheetsAdded++;
      console.log('✅ [ExportService] Hoja de preferencias agregada');

      // Guardar archivo
      const fileName = `budget_tracker_completo_${this.getTimestamp()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      console.log(`✅ [ExportService] Exportación completa exitosa: ${sheetsAdded} hojas exportadas`);

      return {
        success: true,
        message: `Datos exportados exitosamente. ${sheetsAdded} hoja(s) incluida(s).`,
        hasData: true
      };
    } catch (error) {
      console.error('❌ [ExportService] Error al exportar:', error);
      return {
        success: false,
        message: `Error al exportar los datos: ${error}`,
        hasData: true
      };
    }
  }

  private getMonthName(month: number): string {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months[month - 1] || '';
  }

  private getMonthNumber(monthName: string): number {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return months.indexOf(monthName) + 1;
  }

  /**
   * Exportar todos los datos a Google Drive
   */
  async exportAllDataToGoogleDrive(
    transactions: Transaction[],
    vehicles: Vehicle[],
    fuelLogs: FuelLog[],
    categories: Category[],
    accounts: Account[],
    preferences: UserPreferences,
    billings: MonthlyBilling[]
  ): Promise<{ success: boolean; message: string; fileId?: string; webViewLink?: string }> {
    console.log('📤 [ExportService] Exportando a Google Drive...');

    try {
      // Verificar autenticación
      if (!this.googleDriveService.isSignedIn()) {
        await this.googleDriveService.signIn();
      }

      // Generar workbook (igual que exportAllData pero sin guardar localmente)
      const workbook = XLSX.utils.book_new();
      let sheetsAdded = 0;

      // Agregar todas las hojas (mismo código que exportAllData)
      // Hoja 1: Transacciones
      if (transactions.length > 0) {
        const transactionsData = transactions.map(transaction => {
          const category = categories.find(c => c.id === transaction.categoryId);
          const account = accounts.find(a => a.id === transaction.accountId);
          return {
            'ID': transaction.id,
            'Fecha': this.formatDate(transaction.date),
            'Descripción': transaction.description,
            'Monto': transaction.amount,
            'Moneda': transaction.currency,
            'Tipo': transaction.type === 'income' ? 'Ingreso' : 'Gasto',
            'Categoría': category ? category.name : 'N/A',
            'Categoría ID': transaction.categoryId,
            'Cuenta': account ? account.name : 'N/A',
            'Cuenta ID': transaction.accountId,
            // Tasas de cambio guardadas
            'Tasa a ARS': transaction.exchangeRates?.ARS || '',
            'Tasa a USD': transaction.exchangeRates?.USD || '',
            'Tasa a EUR': transaction.exchangeRates?.EUR || '',
            'Tasa a BRL': transaction.exchangeRates?.BRL || '',
            // Campos antiguos (para compatibilidad)
            'Monto Convertido': transaction.convertedAmount || '',
            'Tasa de Cambio (legacy)': transaction.conversionRate || '',
            'Fuente de Conversión': transaction.conversionSource || '',
            'Fecha de Conversión': transaction.conversionDate ? this.formatDate(transaction.conversionDate) : '',
            'Conversión Manual': transaction.manualConversion ? 'Sí' : 'No'
          };
        });
        const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
        XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transacciones');
        sheetsAdded++;
      }

      // Hoja 2: Vehículos
      if (vehicles.length > 0) {
        const vehiclesData = vehicles.map(vehicle => ({
          'ID': vehicle.id,
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
        const vehiclesSheet = XLSX.utils.json_to_sheet(vehiclesData);
        XLSX.utils.book_append_sheet(workbook, vehiclesSheet, 'Vehículos');
        sheetsAdded++;
      }

      // Hoja 3: Combustible
      if (fuelLogs.length > 0) {
        const fuelLogsData = fuelLogs.map(log => {
          const vehicle = vehicles.find(v => v.id === log.vehicleId);
          return {
            'ID': log.id,
            'Fecha': this.formatDate(log.date),
            'Vehículo': vehicle ? `${vehicle.name} (${vehicle.brand} ${vehicle.model})` : 'N/A',
            'Vehículo ID': log.vehicleId,
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
        const fuelLogsSheet = XLSX.utils.json_to_sheet(fuelLogsData);
        XLSX.utils.book_append_sheet(workbook, fuelLogsSheet, 'Combustible');
        sheetsAdded++;
      }

      // Hoja 4: Categorías
      if (categories.length > 0) {
        const categoriesData = categories.map(category => ({
          'ID': category.id,
          'Nombre': category.name,
          'Tipo': category.type === 'income' ? 'Ingreso' : 'Gasto',
          'Color': category.color,
          'Icono': category.icon
        }));
        const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
        XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categorías');
        sheetsAdded++;
      }

      // Hoja 5: Cuentas
      if (accounts.length > 0) {
        const accountsData = accounts.map(account => ({
          'ID': account.id,
          'Nombre': account.name,
          'Tipo': account.type,
          'Balance': account.balance,
          'Moneda': account.currency,
          'Color': account.color,
          'Icono': account.icon
        }));
        const accountsSheet = XLSX.utils.json_to_sheet(accountsData);
        XLSX.utils.book_append_sheet(workbook, accountsSheet, 'Cuentas');
        sheetsAdded++;
      }

      // Hoja 6: Facturación
      if (billings.length > 0) {
        const billingsData = billings.map(billing => ({
          'ID': billing.id,
          'Mes': this.getMonthName(billing.month),
          'Año': billing.year,
          'Monto': billing.amount,
          'Descripción': billing.description || ''
        })).sort((a, b) => {
          if (a['Año'] !== b['Año']) return b['Año'] - a['Año'];
          return this.getMonthNumber(b['Mes']) - this.getMonthNumber(a['Mes']);
        });
        const billingsSheet = XLSX.utils.json_to_sheet(billingsData);
        XLSX.utils.book_append_sheet(workbook, billingsSheet, 'Facturación');
        sheetsAdded++;
      }

      // Hoja 7: Preferencias
      const preferencesData = [{
        'Moneda Preferida': preferences.preferredCurrency,
        'Locale': preferences.locale,
        'Tema': preferences.theme || 'light'
      }];
      const preferencesSheet = XLSX.utils.json_to_sheet(preferencesData);
      XLSX.utils.book_append_sheet(workbook, preferencesSheet, 'Preferencias');
      sheetsAdded++;

      // Convertir workbook a blob
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Subir o actualizar en Google Drive (nombre fijo, en root)
      const fileName = 'Budget_Tracker_Export.xlsx';
      const result = await this.googleDriveService.uploadOrUpdateFile(fileName, blob, blob.type);

      console.log(`✅ [ExportService] Archivo guardado en Google Drive: ${result.id}`);

      return {
        success: true,
        message: `Archivo "${fileName}" guardado exitosamente en Google Drive. ${sheetsAdded} hoja(s) incluida(s).`,
        fileId: result.id,
        webViewLink: result.webViewLink
      };
    } catch (error: any) {
      console.error('❌ [ExportService] Error al exportar a Google Drive:', error);

      let errorMessage = 'Error desconocido';

      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.result && error.result.error) {
        errorMessage = error.result.error.message || JSON.stringify(error.result.error);
      }

      return {
        success: false,
        message: `Error al guardar en Google Drive: ${errorMessage}`
      };
    }
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

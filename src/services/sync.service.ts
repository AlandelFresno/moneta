import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { GoogleDriveService } from './google-drive.service';
import { TransactionService } from './transaction.service';
import { VehicleService } from './vehicle.service';
import { FuelLogService } from './fuel-log.service';
import { CategoryService } from './category.service';
import { AccountService } from './account.service';
import { PreferencesService, UserPreferences } from './preferences.service';
import { BillingService } from './billing.service';
import { BudgetService } from './budget.service';
import { Transaction, Category, Account, MonthlyBilling } from '../models';
import { Vehicle } from '../models/vehicle.model';
import { FuelLog } from '../models/fuel-log.model';
import { Budget } from '../models/budget.model';

interface SyncMetadata {
  lastSyncTimestamp: number;
  lastSyncDate: Date;
  deviceId: string;
  dataVersion: number;
}

interface SyncData {
  metadata: SyncMetadata;
  transactions: Transaction[];
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  categories: Category[];
  accounts: Account[];
  preferences: UserPreferences;
  billings: MonthlyBilling[];
  budgets: Budget[];
}

interface SyncResult {
  success: boolean;
  message: string;
  conflicts?: string[];
  stats: {
    transactionsAdded: number;
    transactionsUpdated: number;
    vehiclesAdded: number;
    vehiclesUpdated: number;
    fuelLogsAdded: number;
    fuelLogsUpdated: number;
    categoriesAdded: number;
    categoriesUpdated: number;
    accountsAdded: number;
    accountsUpdated: number;
    billingsAdded: number;
    billingsUpdated: number;
    budgetsAdded: number;
    budgetsUpdated: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private readonly SYNC_FILE_NAME = 'budget_tracker_sync_data.xlsx';
  private readonly SYNC_METADATA_KEY = 'budget_sync_metadata';
  private readonly DEVICE_ID_KEY = 'budget_device_id';

  constructor(
    private googleDriveService: GoogleDriveService,
    private transactionService: TransactionService,
    private vehicleService: VehicleService,
    private fuelLogService: FuelLogService,
    private categoryService: CategoryService,
    private accountService: AccountService,
    private preferencesService: PreferencesService,
    private billingService: BillingService,
    private budgetService: BudgetService
  ) {}

  /**
   * Obtener o crear ID único del dispositivo
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  /**
   * Obtener metadata de última sincronización
   */
  private getSyncMetadata(): SyncMetadata | null {
    const stored = localStorage.getItem(this.SYNC_METADATA_KEY);
    if (stored) {
      try {
        const metadata = JSON.parse(stored);
        metadata.lastSyncDate = new Date(metadata.lastSyncDate);
        return metadata;
      } catch (error) {
        console.error('❌ [SyncService] Error loading sync metadata:', error);
      }
    }
    return null;
  }

  /**
   * Guardar metadata de sincronización
   */
  private saveSyncMetadata(metadata: SyncMetadata): void {
    localStorage.setItem(this.SYNC_METADATA_KEY, JSON.stringify(metadata));
  }

  /**
   * Obtener todos los datos locales
   */
  private getLocalData(): SyncData {
    const metadata = this.getSyncMetadata() || {
      lastSyncTimestamp: 0,
      lastSyncDate: new Date(0),
      deviceId: this.getDeviceId(),
      dataVersion: 1
    };

    return {
      metadata,
      transactions: this.transactionService.getTransactions(),
      vehicles: this.vehicleService.getVehicles(),
      fuelLogs: this.fuelLogService.getLogs(),
      categories: this.categoryService.getCategories(),
      accounts: this.accountService.getAccounts(),
      preferences: this.preferencesService.getPreferences(),
      billings: this.billingService.getBillings(),
      budgets: this.budgetService.getBudgets()
    };
  }

  /**
   * Descargar datos desde Google Drive
   */
  private async downloadFromDrive(): Promise<SyncData | null> {
    console.log('📥 [SyncService] Descargando datos desde Drive...');

    try {
      // Buscar el archivo de sincronización
      const fileId = await this.googleDriveService.findFileByName(this.SYNC_FILE_NAME);

      console.log('🔍 [SyncService] fileId obtenido de findFileByName:', fileId);

      if (!fileId) {
        console.log('ℹ️ [SyncService] No hay datos previos en Drive');
        return null;
      }

      // VALIDACIÓN CRÍTICA: Verificar que el fileId sea válido
      if (fileId.trim() === '' || fileId === '.' || fileId === 'null' || fileId === 'undefined') {
        console.error('❌ [SyncService] fileId inválido recibido:', fileId);
        throw new Error(`fileId inválido: "${fileId}". No se puede descargar el archivo. Por favor elimina el archivo corrupto de Google Drive y sincroniza nuevamente.`);
      }

      console.log(`📥 [SyncService] Descargando archivo con ID: ${fileId}`);

      // Descargar el contenido del archivo
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${(this.googleDriveService as any).accessToken}`
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [SyncService] Error al descargar:', errorText);
        throw new Error(`Error al descargar archivo: ${response.statusText} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Leer metadata
      const metadataSheet = workbook.Sheets['Metadata'];
      const metadataArray = XLSX.utils.sheet_to_json(metadataSheet);
      const metadataRow: any = metadataArray[0] || {};

      const metadata: SyncMetadata = {
        lastSyncTimestamp: metadataRow['Last Sync Timestamp'] || 0,
        lastSyncDate: new Date(metadataRow['Last Sync Date'] || 0),
        deviceId: metadataRow['Device ID'] || '',
        dataVersion: metadataRow['Data Version'] || 1
      };

      // Leer transacciones
      const transactionsSheet = workbook.Sheets['Transacciones'];
      const transactions: Transaction[] = transactionsSheet ? XLSX.utils.sheet_to_json(transactionsSheet).map((row: any) => ({
        id: row['ID'],
        date: new Date(row['Fecha']),
        description: row['Descripción'],
        amount: row['Monto'],
        currency: row['Moneda'],
        type: (row['Tipo'] === 'Ingreso' ? 'income' : 'expense') as 'income' | 'expense',
        categoryId: row['Categoría ID'],
        accountId: row['Cuenta ID'],
        exchangeRates: {
          ARS: row['Tasa a ARS'] || undefined,
          USD: row['Tasa a USD'] || undefined,
          EUR: row['Tasa a EUR'] || undefined,
          BRL: row['Tasa a BRL'] || undefined
        },
        createdAt: new Date(row['Creado'] || row['Fecha']),
        updatedAt: new Date(row['Actualizado'] || row['Fecha'])
      })) : [];

      // Leer vehículos
      const vehiclesSheet = workbook.Sheets['Vehículos'];
      const vehicles: Vehicle[] = vehiclesSheet ? XLSX.utils.sheet_to_json(vehiclesSheet).map((row: any) => ({
        id: row['ID'],
        name: row['Nombre'] || '',
        brand: row['Marca'],
        model: row['Modelo'],
        year: row['Año'],
        plateNumber: row['Patente'],
        currentKm: row['Km Actual'] || 0,
        fuelType: (row['Tipo Combustible'] || 'gasoline') as 'gasoline' | 'diesel' | 'premium' | 'electric',
        createdAt: new Date(row['Creado'] || Date.now()),
        updatedAt: new Date(row['Actualizado'] || Date.now())
      })) : [];

      // Leer combustible
      const fuelLogsSheet = workbook.Sheets['Combustible'];
      const fuelLogs: FuelLog[] = fuelLogsSheet ? XLSX.utils.sheet_to_json(fuelLogsSheet).map((row: any) => ({
        id: row['ID'],
        vehicleId: row['Vehículo ID'],
        date: new Date(row['Fecha']),
        liters: row['Litros'],
        pricePerLiter: row['Precio por Litro'],
        totalPrice: row['Total'],
        currency: row['Moneda'] || 'ARS',
        kmTraveled: row['Km Recorridos'] || 0,
        totalKm: row['Km Totales'] || 0,
        efficiency: row['Rendimiento'] || 0,
        costPerKm: row['Costo por Km'] || 0,
        fullTank: row['Tanque Lleno'] === 'Sí' || false,
        notes: row['Notas'] || '',
        createdAt: new Date(row['Creado'] || row['Fecha']),
        updatedAt: new Date(row['Actualizado'] || row['Fecha'])
      })) : [];

      // Leer categorías
      const categoriesSheet = workbook.Sheets['Categorías'];
      const categories: Category[] = categoriesSheet ? XLSX.utils.sheet_to_json(categoriesSheet).map((row: any) => ({
        id: row['ID'],
        name: row['Nombre'],
        type: (row['Tipo'] === 'Ingreso' ? 'income' : 'expense') as 'income' | 'expense',
        color: row['Color'],
        icon: row['Icono'],
        createdAt: new Date(row['Creado'] || Date.now()),
        updatedAt: new Date(row['Actualizado'] || Date.now())
      })) : [];

      // Leer cuentas
      const accountsSheet = workbook.Sheets['Cuentas'];
      const accounts: Account[] = accountsSheet ? XLSX.utils.sheet_to_json(accountsSheet).map((row: any) => ({
        id: row['ID'],
        name: row['Nombre'],
        type: row['Tipo'],
        balance: row['Balance'],
        currency: row['Moneda'],
        color: row['Color'],
        icon: row['Icono'],
        createdAt: new Date(row['Creado'] || Date.now()),
        updatedAt: new Date(row['Actualizado'] || Date.now())
      })) : [];

      // Leer preferencias
      const preferencesSheet = workbook.Sheets['Preferencias'];
      const preferencesArray = preferencesSheet ? XLSX.utils.sheet_to_json(preferencesSheet) : [];
      const preferencesRow: any = preferencesArray[0] || {};
      const preferences: UserPreferences = {
        preferredCurrency: preferencesRow['Moneda Preferida'] || 'ARS',
        locale: preferencesRow['Locale'] || 'es-AR',
        theme: preferencesRow['Tema'] || 'light'
      };

      // Leer facturaciones
      const billingsSheet = workbook.Sheets['Facturaciones'];
      const billings: MonthlyBilling[] = billingsSheet ? XLSX.utils.sheet_to_json(billingsSheet).map((row: any) => ({
        id: row['ID'],
        month: row['Mes'],
        year: row['Año'],
        amount: row['Monto'],
        description: row['Descripción'] || '',
        createdAt: new Date(row['Creado'] || Date.now()),
        updatedAt: new Date(row['Actualizado'] || Date.now())
      })) : [];

      // Leer presupuestos
      const budgetsSheet = workbook.Sheets['Presupuestos'];
      const budgets: Budget[] = budgetsSheet ? XLSX.utils.sheet_to_json(budgetsSheet).map((row: any) => ({
        id: row['ID'],
        name: row['Nombre'],
        categoryId: row['Categoría ID'],
        limit: row['Límite'],
        currency: row['Moneda'],
        period: row['Período'] as 'monthly' | 'weekly' | 'yearly',
        alertThreshold: row['Umbral Alerta'] || 80,
        createdAt: new Date(row['Creado'] || Date.now()),
        updatedAt: new Date(row['Actualizado'] || Date.now())
      })) : [];

      console.log('✅ [SyncService] Datos descargados desde Drive (XLSX)');
      return {
        metadata,
        transactions,
        vehicles,
        fuelLogs,
        categories,
        accounts,
        preferences,
        billings,
        budgets
      };
    } catch (error) {
      console.error('❌ [SyncService] Error descargando desde Drive:', error);
      throw error;
    }
  }

  /**
   * Subir datos a Google Drive
   */
  private async uploadToDrive(data: SyncData): Promise<void> {
    console.log('📤 [SyncService] Subiendo datos a Drive (XLSX)...');

    try {
      const workbook = XLSX.utils.book_new();

      // Metadata
      const metadataData = [{
        'Last Sync Timestamp': data.metadata.lastSyncTimestamp,
        'Last Sync Date': data.metadata.lastSyncDate.toISOString(),
        'Device ID': data.metadata.deviceId,
        'Data Version': data.metadata.dataVersion
      }];
      const metadataSheet = XLSX.utils.json_to_sheet(metadataData);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

      // Transacciones
      const transactionsData = data.transactions.map(t => ({
        'ID': t.id,
        'Fecha': t.date.toISOString(),
        'Descripción': t.description,
        'Monto': t.amount,
        'Moneda': t.currency,
        'Tipo': t.type === 'income' ? 'Ingreso' : 'Gasto',
        'Categoría ID': t.categoryId,
        'Cuenta ID': t.accountId,
        'Tasa a ARS': t.exchangeRates?.ARS || '',
        'Tasa a USD': t.exchangeRates?.USD || '',
        'Tasa a EUR': t.exchangeRates?.EUR || '',
        'Tasa a BRL': t.exchangeRates?.BRL || '',
        'Creado': t.createdAt.toISOString(),
        'Actualizado': t.updatedAt.toISOString()
      }));
      const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transacciones');

      // Vehículos
      const vehiclesData = data.vehicles.map(v => ({
        'ID': v.id,
        'Nombre': v.name,
        'Marca': v.brand,
        'Modelo': v.model,
        'Año': v.year,
        'Patente': v.plateNumber || '',
        'Km Actual': v.currentKm,
        'Tipo Combustible': v.fuelType,
        'Creado': v.createdAt.toISOString(),
        'Actualizado': v.updatedAt.toISOString()
      }));
      const vehiclesSheet = XLSX.utils.json_to_sheet(vehiclesData);
      XLSX.utils.book_append_sheet(workbook, vehiclesSheet, 'Vehículos');

      // Combustible
      const fuelLogsData = data.fuelLogs.map(f => ({
        'ID': f.id,
        'Vehículo ID': f.vehicleId,
        'Fecha': f.date.toISOString(),
        'Litros': f.liters,
        'Precio por Litro': f.pricePerLiter,
        'Total': f.totalPrice,
        'Moneda': f.currency,
        'Km Recorridos': f.kmTraveled,
        'Km Totales': f.totalKm,
        'Rendimiento': f.efficiency,
        'Costo por Km': f.costPerKm,
        'Tanque Lleno': f.fullTank ? 'Sí' : 'No',
        'Notas': f.notes || '',
        'Creado': f.createdAt.toISOString(),
        'Actualizado': f.updatedAt.toISOString()
      }));
      const fuelLogsSheet = XLSX.utils.json_to_sheet(fuelLogsData);
      XLSX.utils.book_append_sheet(workbook, fuelLogsSheet, 'Combustible');

      // Categorías
      const categoriesData = data.categories.map(c => ({
        'ID': c.id,
        'Nombre': c.name,
        'Tipo': c.type === 'income' ? 'Ingreso' : 'Gasto',
        'Color': c.color,
        'Icono': c.icon,
        'Creado': c.createdAt.toISOString(),
        'Actualizado': c.updatedAt.toISOString()
      }));
      const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
      XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categorías');

      // Cuentas
      const accountsData = data.accounts.map(a => ({
        'ID': a.id,
        'Nombre': a.name,
        'Tipo': a.type,
        'Balance': a.balance,
        'Moneda': a.currency,
        'Color': a.color,
        'Icono': a.icon,
        'Creado': a.createdAt.toISOString(),
        'Actualizado': a.updatedAt.toISOString()
      }));
      const accountsSheet = XLSX.utils.json_to_sheet(accountsData);
      XLSX.utils.book_append_sheet(workbook, accountsSheet, 'Cuentas');

      // Preferencias
      const preferencesData = [{
        'Moneda Preferida': data.preferences.preferredCurrency,
        'Locale': data.preferences.locale,
        'Tema': data.preferences.theme
      }];
      const preferencesSheet = XLSX.utils.json_to_sheet(preferencesData);
      XLSX.utils.book_append_sheet(workbook, preferencesSheet, 'Preferencias');

      // Facturaciones
      const billingsData = data.billings.map(b => ({
        'ID': b.id,
        'Mes': b.month,
        'Año': b.year,
        'Monto': b.amount,
        'Descripción': b.description || '',
        'Creado': b.createdAt.toISOString(),
        'Actualizado': b.updatedAt.toISOString()
      }));
      const billingsSheet = XLSX.utils.json_to_sheet(billingsData);
      XLSX.utils.book_append_sheet(workbook, billingsSheet, 'Facturaciones');

      // Presupuestos
      const budgetsData = data.budgets.map(b => ({
        'ID': b.id,
        'Nombre': b.name,
        'Categoría ID': b.categoryId,
        'Límite': b.limit,
        'Moneda': b.currency,
        'Período': b.period,
        'Umbral Alerta': b.alertThreshold || '',
        'Creado': b.createdAt.toISOString(),
        'Actualizado': b.updatedAt.toISOString()
      }));
      const budgetsSheet = XLSX.utils.json_to_sheet(budgetsData);
      XLSX.utils.book_append_sheet(workbook, budgetsSheet, 'Presupuestos');

      // Convertir a blob
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      await this.googleDriveService.uploadOrUpdateFile(
        this.SYNC_FILE_NAME,
        blob,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      console.log('✅ [SyncService] Datos subidos a Drive (XLSX)');
    } catch (error) {
      console.error('❌ [SyncService] Error subiendo a Drive:', error);
      throw error;
    }
  }

  /**
   * Merge de arrays por ID - ESTRATEGIA: El más reciente gana
   */
  private mergeArrays<T extends { id: string; updatedAt: Date }>(
    local: T[],
    remote: T[],
    itemName: string
  ): { merged: T[]; added: number; updated: number } {
    const merged: T[] = [];
    const remoteMap = new Map(remote.map(item => [item.id, item]));
    const processedIds = new Set<string>();

    let added = 0;
    let updated = 0;

    // Procesar items locales
    for (const localItem of local) {
      const remoteItem = remoteMap.get(localItem.id);

      if (!remoteItem) {
        // Solo existe localmente - agregar
        merged.push(localItem);
        console.log(`➕ [SyncService] ${itemName} solo local:`, localItem.id);
      } else {
        // Existe en ambos - comparar timestamps
        const localTime = new Date(localItem.updatedAt).getTime();
        const remoteTime = new Date(remoteItem.updatedAt).getTime();

        if (localTime > remoteTime) {
          // Local más reciente
          merged.push(localItem);
          updated++;
          console.log(`🔄 [SyncService] ${itemName} local más reciente:`, localItem.id);
        } else if (remoteTime > localTime) {
          // Remote más reciente
          merged.push(remoteItem);
          updated++;
          console.log(`🔄 [SyncService] ${itemName} remoto más reciente:`, localItem.id);
        } else {
          // Misma fecha - usar local
          merged.push(localItem);
        }
      }

      processedIds.add(localItem.id);
    }

    // Agregar items que solo existen en remoto
    for (const remoteItem of remote) {
      if (!processedIds.has(remoteItem.id)) {
        merged.push(remoteItem);
        added++;
        console.log(`➕ [SyncService] ${itemName} solo remoto:`, remoteItem.id);
      }
    }

    // CRÍTICO: Deduplicar por ID para evitar duplicados
    const deduped = this.deduplicateById(merged, itemName);

    return { merged: deduped, added, updated };
  }

  /**
   * Elimina duplicados de un array basándose en el ID, manteniendo el más reciente
   */
  private deduplicateById<T extends { id: string; updatedAt: Date }>(
    items: T[],
    itemName: string
  ): T[] {
    const seen = new Map<string, T>();

    for (const item of items) {
      const existing = seen.get(item.id);

      if (!existing) {
        seen.set(item.id, item);
      } else {
        // Si ya existe, mantener el más reciente
        const existingTime = new Date(existing.updatedAt).getTime();
        const itemTime = new Date(item.updatedAt).getTime();

        if (itemTime > existingTime) {
          seen.set(item.id, item);
          console.log(`🔧 [SyncService] ${itemName} duplicado removido (manteniendo más reciente):`, item.id);
        }
      }
    }

    const dedupedArray = Array.from(seen.values());
    const duplicatesRemoved = items.length - dedupedArray.length;

    if (duplicatesRemoved > 0) {
      console.warn(`⚠️ [SyncService] ${duplicatesRemoved} ${itemName}(s) duplicado(s) removido(s)`);
    }

    return dedupedArray;
  }

  /**
   * Realizar sincronización completa
   */
  async sync(): Promise<SyncResult> {
    console.log('🔄 [SyncService] Iniciando sincronización...');

    const stats = {
      transactionsAdded: 0,
      transactionsUpdated: 0,
      vehiclesAdded: 0,
      vehiclesUpdated: 0,
      fuelLogsAdded: 0,
      fuelLogsUpdated: 0,
      categoriesAdded: 0,
      categoriesUpdated: 0,
      accountsAdded: 0,
      accountsUpdated: 0,
      billingsAdded: 0,
      billingsUpdated: 0,
      budgetsAdded: 0,
      budgetsUpdated: 0
    };

    try {
      // 1. Verificar autenticación
      if (!this.googleDriveService.isSignedIn()) {
        await this.googleDriveService.signIn();
      }

      // 2. Obtener datos locales
      const localData = this.getLocalData();
      console.log('📊 [SyncService] Datos locales:', {
        transactions: localData.transactions.length,
        vehicles: localData.vehicles.length,
        fuelLogs: localData.fuelLogs.length,
        categories: localData.categories.length,
        accounts: localData.accounts.length,
        billings: localData.billings.length,
        budgets: localData.budgets.length
      });

      // 3. Descargar datos de Drive
      const driveData = await this.downloadFromDrive();

      if (!driveData) {
        // No hay datos en Drive - primera sincronización
        console.log('📤 [SyncService] Primera sincronización - subiendo datos locales');

        const newMetadata: SyncMetadata = {
          lastSyncTimestamp: Date.now(),
          lastSyncDate: new Date(),
          deviceId: this.getDeviceId(),
          dataVersion: 1
        };

        await this.uploadToDrive({
          ...localData,
          metadata: newMetadata
        });

        this.saveSyncMetadata(newMetadata);

        return {
          success: true,
          message: 'Primera sincronización completada. Datos subidos a Drive.',
          stats
        };
      }

      console.log('📊 [SyncService] Datos de Drive:', {
        transactions: driveData.transactions.length,
        vehicles: driveData.vehicles.length,
        fuelLogs: driveData.fuelLogs.length,
        categories: driveData.categories.length,
        accounts: driveData.accounts.length,
        billings: driveData.billings.length,
        budgets: driveData.budgets.length,
        lastSync: driveData.metadata.lastSyncDate
      });

      // 4. Merge de datos
      console.log('🔀 [SyncService] Mergeando datos...');

      const transactionsResult = this.mergeArrays(
        localData.transactions,
        driveData.transactions,
        'Transaction'
      );
      stats.transactionsAdded = transactionsResult.added;
      stats.transactionsUpdated = transactionsResult.updated;

      const vehiclesResult = this.mergeArrays(
        localData.vehicles,
        driveData.vehicles,
        'Vehicle'
      );
      stats.vehiclesAdded = vehiclesResult.added;
      stats.vehiclesUpdated = vehiclesResult.updated;

      const fuelLogsResult = this.mergeArrays(
        localData.fuelLogs,
        driveData.fuelLogs,
        'FuelLog'
      );
      stats.fuelLogsAdded = fuelLogsResult.added;
      stats.fuelLogsUpdated = fuelLogsResult.updated;

      const categoriesResult = this.mergeArrays(
        localData.categories,
        driveData.categories,
        'Category'
      );
      stats.categoriesAdded = categoriesResult.added;
      stats.categoriesUpdated = categoriesResult.updated;

      const accountsResult = this.mergeArrays(
        localData.accounts,
        driveData.accounts,
        'Account'
      );
      stats.accountsAdded = accountsResult.added;
      stats.accountsUpdated = accountsResult.updated;

      const billingsResult = this.mergeArrays(
        localData.billings,
        driveData.billings,
        'Billing'
      );
      stats.billingsAdded = billingsResult.added;
      stats.billingsUpdated = billingsResult.updated;

      const budgetsResult = this.mergeArrays(
        localData.budgets,
        driveData.budgets,
        'Budget'
      );
      stats.budgetsAdded = budgetsResult.added;
      stats.budgetsUpdated = budgetsResult.updated;

      // 5. Aplicar datos mergeados localmente
      console.log('💾 [SyncService] Aplicando datos mergeados localmente...');

      // Guardar en localStorage directamente para evitar problemas con los servicios
      localStorage.setItem('budget_transactions', JSON.stringify(transactionsResult.merged));
      localStorage.setItem('budget_vehicles', JSON.stringify(vehiclesResult.merged));
      localStorage.setItem('budget_fuel_logs', JSON.stringify(fuelLogsResult.merged));
      localStorage.setItem('budget_categories', JSON.stringify(categoriesResult.merged));
      localStorage.setItem('budget_accounts', JSON.stringify(accountsResult.merged));
      localStorage.setItem('budget_monthly_billing', JSON.stringify(billingsResult.merged));
      localStorage.setItem('budgets', JSON.stringify(budgetsResult.merged));

      // 6. Subir datos mergeados a Drive
      const newMetadata: SyncMetadata = {
        lastSyncTimestamp: Date.now(),
        lastSyncDate: new Date(),
        deviceId: this.getDeviceId(),
        dataVersion: (driveData.metadata.dataVersion || 0) + 1
      };

      const mergedData: SyncData = {
        metadata: newMetadata,
        transactions: transactionsResult.merged,
        vehicles: vehiclesResult.merged,
        fuelLogs: fuelLogsResult.merged,
        categories: categoriesResult.merged,
        accounts: accountsResult.merged,
        preferences: localData.preferences, // Siempre usar preferencias locales
        billings: billingsResult.merged,
        budgets: budgetsResult.merged
      };

      await this.uploadToDrive(mergedData);

      // 7. Guardar metadata de sincronización
      this.saveSyncMetadata(newMetadata);

      console.log('✅ [SyncService] Sincronización completada exitosamente');

      const totalChanges =
        stats.transactionsAdded + stats.transactionsUpdated +
        stats.vehiclesAdded + stats.vehiclesUpdated +
        stats.fuelLogsAdded + stats.fuelLogsUpdated +
        stats.categoriesAdded + stats.categoriesUpdated +
        stats.accountsAdded + stats.accountsUpdated +
        stats.billingsAdded + stats.billingsUpdated;

      return {
        success: true,
        message: `Sincronización completada. ${totalChanges} cambios aplicados.`,
        stats
      };

    } catch (error: any) {
      console.error('❌ [SyncService] Error en sincronización:', error);
      return {
        success: false,
        message: `Error en sincronización: ${error.message}`,
        stats
      };
    }
  }

  /**
   * Obtener información de la última sincronización
   */
  getLastSyncInfo(): { lastSync: Date | null; deviceId: string } | null {
    const metadata = this.getSyncMetadata();
    if (!metadata) {
      return null;
    }

    return {
      lastSync: metadata.lastSyncDate,
      deviceId: metadata.deviceId
    };
  }
}

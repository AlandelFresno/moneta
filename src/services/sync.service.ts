import { Injectable } from '@angular/core';
import { GoogleDriveService } from './google-drive.service';
import { TransactionService } from './transaction.service';
import { VehicleService } from './vehicle.service';
import { FuelLogService } from './fuel-log.service';
import { CategoryService } from './category.service';
import { AccountService } from './account.service';
import { PreferencesService } from './preferences.service';
import { BillingService } from './billing.service';
import { Transaction, Vehicle, FuelLog, Category, Account, MonthlyBilling, UserPreferences } from '../models';

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
  };
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private readonly SYNC_FILE_NAME = 'budget_tracker_sync_data.json';
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
    private billingService: BillingService
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
      billings: this.billingService.getBillings()
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

      if (!fileId) {
        console.log('ℹ️ [SyncService] No hay datos previos en Drive');
        return null;
      }

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
        throw new Error(`Error al descargar archivo: ${response.statusText}`);
      }

      const driveData = await response.json();

      // Convertir fechas de strings a Date
      driveData.metadata.lastSyncDate = new Date(driveData.metadata.lastSyncDate);
      driveData.transactions = driveData.transactions.map((t: any) => ({
        ...t,
        date: new Date(t.date),
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt)
      }));
      driveData.vehicles = driveData.vehicles.map((v: any) => ({
        ...v,
        createdAt: new Date(v.createdAt),
        updatedAt: new Date(v.updatedAt)
      }));
      driveData.fuelLogs = driveData.fuelLogs.map((f: any) => ({
        ...f,
        date: new Date(f.date),
        createdAt: new Date(f.createdAt),
        updatedAt: new Date(f.updatedAt)
      }));
      driveData.billings = driveData.billings.map((b: any) => ({
        ...b,
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt)
      }));

      console.log('✅ [SyncService] Datos descargados desde Drive');
      return driveData;
    } catch (error) {
      console.error('❌ [SyncService] Error descargando desde Drive:', error);
      throw error;
    }
  }

  /**
   * Subir datos a Google Drive
   */
  private async uploadToDrive(data: SyncData): Promise<void> {
    console.log('📤 [SyncService] Subiendo datos a Drive...');

    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });

      await this.googleDriveService.uploadOrUpdateFile(
        this.SYNC_FILE_NAME,
        blob,
        'application/json'
      );

      console.log('✅ [SyncService] Datos subidos a Drive');
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

    return { merged, added, updated };
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
      billingsUpdated: 0
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
        billings: localData.billings.length
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

      // 5. Aplicar datos mergeados localmente
      console.log('💾 [SyncService] Aplicando datos mergeados localmente...');

      // Guardar en localStorage directamente para evitar problemas con los servicios
      localStorage.setItem('budget_transactions', JSON.stringify(transactionsResult.merged));
      localStorage.setItem('budget_vehicles', JSON.stringify(vehiclesResult.merged));
      localStorage.setItem('budget_fuel_logs', JSON.stringify(fuelLogsResult.merged));
      localStorage.setItem('budget_categories', JSON.stringify(categoriesResult.merged));
      localStorage.setItem('budget_accounts', JSON.stringify(accountsResult.merged));
      localStorage.setItem('budget_monthly_billing', JSON.stringify(billingsResult.merged));

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
        billings: billingsResult.merged
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

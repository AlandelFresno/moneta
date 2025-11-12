import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DataMigrationService {
  private readonly MIGRATION_VERSION_KEY = 'budget_migration_version';
  private readonly CURRENT_VERSION = 1;

  constructor() {}

  /**
   * Ejecuta todas las migraciones necesarias
   */
  async runMigrations(): Promise<void> {
    const currentVersion = this.getMigrationVersion();

    console.log(`Versión de migración actual: ${currentVersion}`);

    if (currentVersion < 1) {
      console.log('Ejecutando migración v1: Agregar campo currency');
      await this.migrationV1AddCurrencyField();
      this.setMigrationVersion(1);
    }

    console.log('Todas las migraciones completadas');
  }

  /**
   * Migración v1: Agregar campo currency a datos antiguos
   */
  private async migrationV1AddCurrencyField(): Promise<void> {
    try {
      // Migrar cuentas
      const accountsData = localStorage.getItem('budget_accounts');
      if (accountsData) {
        const accounts = JSON.parse(accountsData);
        let accountsUpdated = false;

        accounts.forEach((account: any) => {
          if (!account.currency) {
            account.currency = 'ARS'; // Moneda por defecto
            accountsUpdated = true;
            console.log(`✓ Cuenta "${account.name}" actualizada con currency: ARS`);
          }
        });

        if (accountsUpdated) {
          localStorage.setItem('budget_accounts', JSON.stringify(accounts));
          console.log('✓ Cuentas actualizadas');
        }
      }

      // Migrar transacciones
      const transactionsData = localStorage.getItem('budget_transactions');
      if (transactionsData) {
        const transactions = JSON.parse(transactionsData);
        let transactionsUpdated = false;

        transactions.forEach((transaction: any) => {
          if (!transaction.currency) {
            transaction.currency = 'ARS'; // Moneda por defecto
            transactionsUpdated = true;
          }
        });

        if (transactionsUpdated) {
          localStorage.setItem('budget_transactions', JSON.stringify(transactions));
          console.log(`✓ ${transactions.length} transacciones actualizadas`);
        }
      }

      console.log('✓ Migración v1 completada exitosamente');
    } catch (error) {
      console.error('Error en migración v1:', error);
      throw error;
    }
  }

  /**
   * Obtiene la versión actual de migración
   */
  private getMigrationVersion(): number {
    const version = localStorage.getItem(this.MIGRATION_VERSION_KEY);
    return version ? parseInt(version, 10) : 0;
  }

  /**
   * Establece la versión de migración
   */
  private setMigrationVersion(version: number): void {
    localStorage.setItem(this.MIGRATION_VERSION_KEY, version.toString());
    console.log(`✓ Versión de migración actualizada a: ${version}`);
  }

  /**
   * Resetea la versión de migración (útil para testing)
   */
  resetMigrationVersion(): void {
    localStorage.removeItem(this.MIGRATION_VERSION_KEY);
    console.log('✓ Versión de migración reseteada');
  }
}

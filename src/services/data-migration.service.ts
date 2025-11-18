import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DataMigrationService {
  private readonly MIGRATION_VERSION_KEY = 'budget_migration_version';
  private readonly CURRENT_VERSION = 3;

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

    if (currentVersion < 2) {
      console.log('Ejecutando migración v2: Agregar prefijo pi- a iconos de categorías');
      await this.migrationV2FixCategoryIcons();
      this.setMigrationVersion(2);
    }

    if (currentVersion < 3) {
      console.log('Ejecutando migración v3: Remover prefijo pi- de iconos de categorías');
      await this.migrationV3RemoveCategoryIconPrefix();
      this.setMigrationVersion(3);
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
   * Migración v2: Agregar prefijo pi- a iconos de categorías
   */
  private async migrationV2FixCategoryIcons(): Promise<void> {
    try {
      const categoriesData = localStorage.getItem('budget_categories');
      if (categoriesData) {
        const categories = JSON.parse(categoriesData);
        let categoriesUpdated = false;

        categories.forEach((category: any) => {
          // Si el icono no tiene el prefijo 'pi-', agregarlo
          if (category.icon && !category.icon.startsWith('pi-')) {
            category.icon = 'pi-' + category.icon;
            categoriesUpdated = true;
            console.log(`✓ Categoría "${category.name}" icono actualizado a: ${category.icon}`);
          }
        });

        if (categoriesUpdated) {
          localStorage.setItem('budget_categories', JSON.stringify(categories));
          console.log('✓ Categorías actualizadas con prefijo pi-');
        }
      }

      console.log('✓ Migración v2 completada exitosamente');
    } catch (error) {
      console.error('Error en migración v2:', error);
      throw error;
    }
  }

  /**
   * Migración v3: Remover prefijo pi- de iconos de categorías
   * (Revertir cambio de v2 porque el template ya incluye el prefijo)
   */
  private async migrationV3RemoveCategoryIconPrefix(): Promise<void> {
    try {
      const categoriesData = localStorage.getItem('budget_categories');
      if (categoriesData) {
        const categories = JSON.parse(categoriesData);
        let categoriesUpdated = false;

        categories.forEach((category: any) => {
          // Si el icono tiene el prefijo 'pi-', removerlo
          if (category.icon && category.icon.startsWith('pi-')) {
            category.icon = category.icon.substring(3); // Remover 'pi-'
            categoriesUpdated = true;
            console.log(`✓ Categoría "${category.name}" icono actualizado a: ${category.icon}`);
          }
        });

        if (categoriesUpdated) {
          localStorage.setItem('budget_categories', JSON.stringify(categories));
          console.log('✓ Categorías actualizadas sin prefijo pi-');
        }
      }

      console.log('✓ Migración v3 completada exitosamente');
    } catch (error) {
      console.error('Error en migración v3:', error);
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

import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Vehicle } from '../../models/vehicle.model';
import { FuelLog } from '../../models/fuel-log.model';
import { VehicleService } from '../../services/vehicle.service';
import { FuelLogService } from '../../services/fuel-log.service';
import { ExportService } from '../../services/export.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-fuel',
  templateUrl: './fuel.page.html',
  styleUrls: ['./fuel.page.scss'],
  standalone: false,
  encapsulation: ViewEncapsulation.None
})
export class FuelPage implements OnInit {
  vehicles: Vehicle[] = [];
  selectedVehicle: Vehicle | null = null;
  fuelLogs: FuelLog[] = [];

  // Dialogs
  showVehicleDialog = false;
  showFuelLogDialog = false;
  showImportDialog = false;
  editingVehicle: Vehicle | null = null;
  editingLog: FuelLog | null = null;

  // Vehicle Form
  vehicleForm = {
    name: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plateNumber: '',
    currentKm: 0,
    tankCapacity: 0,
    fuelType: 'gasoline' as 'gasoline' | 'diesel' | 'premium' | 'electric',
    color: '#3b82f6',
    notes: ''
  };

  // Fuel Log Form
  fuelLogForm = {
    date: new Date().toISOString().split('T')[0],
    liters: 0,
    pricePerLiter: 0,
    totalPrice: 0,
    currency: 'ARS',
    totalKm: 0,
    kmTraveled: 0,
    fullTank: true,
    gasStation: '',
    notes: ''
  };

  currencies = [
    { code: 'USD', name: 'Dólar estadounidense', symbol: '$' },
    { code: 'ARS', name: 'Peso argentino', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'Libra esterlina', symbol: '£' },
    { code: 'BRL', name: 'Real brasileño', symbol: 'R$' }
  ];

  fuelTypes = [
    { label: 'Gasolina', value: 'gasoline' },
    { label: 'Diesel', value: 'diesel' },
    { label: 'Premium', value: 'premium' },
    { label: 'Eléctrico', value: 'electric' }
  ];

  constructor(
    public vehicleService: VehicleService,
    public fuelLogService: FuelLogService,
    private exportService: ExportService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.vehicles = this.vehicleService.getVehicles();
    if (this.vehicles.length > 0 && !this.selectedVehicle) {
      this.selectVehicle(this.vehicles[0]);
    }
  }

  selectVehicle(vehicle: Vehicle): void {
    console.log('🚗 [Fuel] Seleccionando vehículo:', vehicle.name);
    this.selectedVehicle = vehicle;
    this.fuelLogs = this.fuelLogService.getLogsByVehicle(vehicle.id);
  }

  // Vehicle Management
  openVehicleDialog(): void {
    this.editingVehicle = null;
    this.resetVehicleForm();
    this.showVehicleDialog = true;
  }

  editVehicle(vehicle: Vehicle): void {
    this.editingVehicle = vehicle;
    this.vehicleForm = {
      name: vehicle.name,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      plateNumber: vehicle.plateNumber || '',
      currentKm: vehicle.currentKm,
      tankCapacity: vehicle.tankCapacity || 0,
      fuelType: vehicle.fuelType,
      color: vehicle.color || '#3b82f6',
      notes: vehicle.notes || ''
    };
    this.showVehicleDialog = true;
  }

  saveVehicle(): void {
    if (!this.vehicleForm.name || !this.vehicleForm.brand || !this.vehicleForm.model) {
      this.toastService.warn('Campos obligatorios', 'Por favor completa todos los campos requeridos');
      return;
    }

    if (this.editingVehicle) {
      this.vehicleService.updateVehicle(this.editingVehicle.id, this.vehicleForm);
    } else {
      const newVehicle = this.vehicleService.createVehicle(this.vehicleForm);
      this.selectVehicle(newVehicle);
    }

    this.loadData();
    this.showVehicleDialog = false;
  }

  async deleteVehicle(vehicle: Vehicle): Promise<void> {
    const shouldDelete = await this.toastService.confirm(
      `¿Eliminar el vehículo "${vehicle.name}"? Esto también eliminará todos sus registros de combustible.`,
      'Confirmar eliminación'
    );

    if (shouldDelete) {
      this.fuelLogService.deleteLogsByVehicle(vehicle.id);
      this.vehicleService.deleteVehicle(vehicle.id);
      this.toastService.success('Vehículo eliminado', `El vehículo "${vehicle.name}" ha sido eliminado`);
      this.loadData();
      if (this.selectedVehicle?.id === vehicle.id) {
        this.selectedVehicle = this.vehicles.length > 0 ? this.vehicles[0] : null;
        if (this.selectedVehicle) {
          this.fuelLogs = this.fuelLogService.getLogsByVehicle(this.selectedVehicle.id);
        }
      }
    }
  }

  resetVehicleForm(): void {
    this.vehicleForm = {
      name: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      plateNumber: '',
      currentKm: 0,
      tankCapacity: 0,
      fuelType: 'gasoline',
      color: '#3b82f6',
      notes: ''
    };
  }

  // Fuel Log Management
  openFuelLogDialog(): void {
    if (!this.selectedVehicle) {
      this.toastService.warn('Vehículo requerido', 'Por favor selecciona un vehículo primero');
      return;
    }

    this.editingLog = null;
    this.resetFuelLogForm();

    // Obtener el último kilometraje registrado
    const lastLog = this.fuelLogService.getLastLog(this.selectedVehicle.id);
    if (lastLog) {
      // El km total inicial es el último registrado
      this.fuelLogForm.totalKm = lastLog.totalKm;
    } else {
      // Si no hay registros previos, usar el km actual del vehículo
      this.fuelLogForm.totalKm = this.selectedVehicle.currentKm;
    }

    // El usuario ingresará los km recorridos manualmente
    this.fuelLogForm.kmTraveled = 0;

    this.showFuelLogDialog = true;
  }

  saveFuelLog(): void {
    if (!this.selectedVehicle) return;

    if (this.fuelLogForm.liters <= 0) {
      this.toastService.warn('Litros requeridos', 'Por favor ingresa la cantidad de litros cargados');
      return;
    }

    if (this.fuelLogForm.kmTraveled <= 0) {
      this.toastService.warn('Kilómetros requeridos', 'Por favor ingresa los kilómetros recorridos con este tanque');
      return;
    }

    // Calcular precio total si se ingresó precio por litro
    if (this.fuelLogForm.pricePerLiter > 0 && this.fuelLogForm.totalPrice === 0) {
      this.fuelLogForm.totalPrice = this.fuelLogForm.liters * this.fuelLogForm.pricePerLiter;
    }

    // Calcular precio por litro si se ingresó precio total
    if (this.fuelLogForm.totalPrice > 0 && this.fuelLogForm.pricePerLiter === 0) {
      this.fuelLogForm.pricePerLiter = this.fuelLogForm.totalPrice / this.fuelLogForm.liters;
    }

    // Calcular eficiencia y costo por km solo si hay km recorridos
    let efficiency = 0;
    let costPerKm = 0;

    if (this.fuelLogForm.kmTraveled > 0) {
      // Calcular eficiencia (km/litro)
      efficiency = this.fuelLogForm.kmTraveled / this.fuelLogForm.liters;

      // Calcular costo por km
      if (this.fuelLogForm.totalPrice > 0) {
        costPerKm = this.fuelLogForm.totalPrice / this.fuelLogForm.kmTraveled;
      }
    }

    const logData = {
      vehicleId: this.selectedVehicle.id,
      date: new Date(this.fuelLogForm.date),
      liters: this.fuelLogForm.liters,
      pricePerLiter: this.fuelLogForm.pricePerLiter,
      totalPrice: this.fuelLogForm.totalPrice,
      currency: this.fuelLogForm.currency,
      totalKm: this.fuelLogForm.totalKm,
      kmTraveled: this.fuelLogForm.kmTraveled,
      efficiency: efficiency,
      costPerKm: costPerKm,
      fullTank: this.fuelLogForm.fullTank,
      gasStation: this.fuelLogForm.gasStation,
      notes: this.fuelLogForm.notes
    };

    this.fuelLogService.createLog(logData);

    // Actualizar el kilometraje del vehículo con el nuevo total
    this.vehicleService.updateVehicle(this.selectedVehicle.id, {
      currentKm: this.fuelLogForm.totalKm
    });

    this.loadData();
    this.selectVehicle(this.selectedVehicle);
    this.showFuelLogDialog = false;
  }

  async deleteFuelLog(log: FuelLog): Promise<void> {
    const shouldDelete = await this.toastService.confirm(
      'Esta acción no se puede deshacer',
      '¿Eliminar registro de combustible?'
    );

    if (shouldDelete) {
      this.fuelLogService.deleteLog(log.id);
      this.toastService.success('Registro eliminado', 'El registro de combustible ha sido eliminado');
      if (this.selectedVehicle) {
        this.fuelLogs = this.fuelLogService.getLogsByVehicle(this.selectedVehicle.id);
      }
    }
  }

  resetFuelLogForm(): void {
    this.fuelLogForm = {
      date: new Date().toISOString().split('T')[0],
      liters: 0,
      pricePerLiter: 0,
      totalPrice: 0,
      currency: 'ARS',
      totalKm: 0,
      kmTraveled: 0,
      fullTank: true,
      gasStation: '',
      notes: ''
    };
  }

  // Calculations
  onKmTraveledChange(): void {
    if (!this.selectedVehicle) return;

    // Obtener el último kilometraje registrado
    const lastLog = this.fuelLogService.getLastLog(this.selectedVehicle.id);
    const lastKm = lastLog ? lastLog.totalKm : this.selectedVehicle.currentKm;

    // Calcular el nuevo km total sumando los km recorridos
    if (this.fuelLogForm.kmTraveled > 0) {
      this.fuelLogForm.totalKm = lastKm + this.fuelLogForm.kmTraveled;
    } else {
      this.fuelLogForm.totalKm = lastKm;
    }
  }

  onLitersOrPriceChange(): void {
    if (this.fuelLogForm.liters > 0 && this.fuelLogForm.pricePerLiter > 0) {
      this.fuelLogForm.totalPrice = this.fuelLogForm.liters * this.fuelLogForm.pricePerLiter;
    }
  }

  onTotalPriceChange(): void {
    if (this.fuelLogForm.totalPrice > 0 && this.fuelLogForm.liters > 0) {
      this.fuelLogForm.pricePerLiter = this.fuelLogForm.totalPrice / this.fuelLogForm.liters;
    }
  }

  // Stats
  getAverageEfficiency(): string {
    if (!this.selectedVehicle) return '0.00';
    const avg = this.fuelLogService.calculateAverageEfficiency(this.selectedVehicle.id);
    return avg.toFixed(2);
  }

  getAverageCostPerKm(): string {
    if (!this.selectedVehicle) return '0.00';
    const avg = this.fuelLogService.calculateAverageCostPerKm(this.selectedVehicle.id);
    return avg.toFixed(2);
  }

  getTotalSpent(): string {
    if (!this.selectedVehicle) return '0.00';
    const total = this.fuelLogService.getTotalSpent(this.selectedVehicle.id);
    return total.toFixed(2);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getFuelTypeLabel(type: string): string {
    const fuelType = this.fuelTypes.find(t => t.value === type);
    return fuelType ? fuelType.label : type;
  }

  isFinite(value: number): boolean {
    return isFinite(value);
  }

  // Exportar/Importar
  exportAllData(): void {
    console.log('📤 [Fuel] Exportando todos los datos...');
    const allLogs = this.fuelLogService.getLogs();
    this.exportService.exportFuelLogsToExcel(allLogs, this.vehicles, 'combustible_completo');
  }

  exportVehicleData(): void {
    if (!this.selectedVehicle) {
      this.toastService.warn('Vehículo requerido', 'Por favor selecciona un vehículo primero');
      return;
    }
    console.log('📤 [Fuel] Exportando datos del vehículo:', this.selectedVehicle.name);
    this.exportService.exportFuelLogsToExcel(
      this.fuelLogs,
      this.vehicles,
      `combustible_${this.selectedVehicle.name.replace(/\s+/g, '_')}`
    );
  }

  exportVehicles(): void {
    console.log('📤 [Fuel] Exportando vehículos...');
    this.exportService.exportVehiclesToExcel(this.vehicles);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      console.log('📥 [Fuel] Archivo seleccionado:', file.name);
      this.importFromExcel(file);
    }
  }

  async importFromExcel(file: File): Promise<void> {
    try {
      const importedLogs = await this.exportService.importFuelLogsFromExcel(file);

      if (!this.selectedVehicle) {
        this.toastService.warn('Vehículo requerido', 'Por favor selecciona un vehículo primero para importar los registros');
        return;
      }

      // Crear los registros importados para el vehículo seleccionado
      let importedCount = 0;
      for (const logData of importedLogs) {
        const fullLogData = {
          ...logData,
          vehicleId: this.selectedVehicle.id,
          date: logData.date || new Date(),
          liters: logData.liters || 0,
          pricePerLiter: logData.pricePerLiter || 0,
          totalPrice: logData.totalPrice || 0,
          currency: logData.currency || 'ARS',
          kmTraveled: logData.kmTraveled || 0,
          totalKm: logData.totalKm || 0,
          efficiency: logData.efficiency || 0,
          costPerKm: logData.costPerKm || 0,
          fullTank: logData.fullTank || false,
          gasStation: logData.gasStation || '',
          notes: logData.notes || ''
        };

        this.fuelLogService.createLog(fullLogData as Omit<FuelLog, 'id' | 'createdAt' | 'updatedAt'>);
        importedCount++;
      }

      this.toastService.success('Importación exitosa', `Se importaron ${importedCount} registros correctamente`);
      this.loadData();
      this.selectVehicle(this.selectedVehicle);
    } catch (error) {
      console.error('❌ [Fuel] Error al importar:', error);
      this.toastService.error('Error al importar', 'Error al importar el archivo. Por favor verifica que el formato sea correcto.');
    }
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }
}

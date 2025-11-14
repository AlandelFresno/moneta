import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Vehicle } from '../../models/vehicle.model';
import { FuelLog } from '../../models/fuel-log.model';
import { VehicleService } from '../../services/vehicle.service';
import { FuelLogService } from '../../services/fuel-log.service';

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
    currentKm: 0,
    kmSinceLastFill: 0,
    fullTank: true,
    gasStation: '',
    notes: ''
  };

  fuelTypes = [
    { label: 'Gasolina', value: 'gasoline' },
    { label: 'Diesel', value: 'diesel' },
    { label: 'Premium', value: 'premium' },
    { label: 'Eléctrico', value: 'electric' }
  ];

  constructor(
    public vehicleService: VehicleService,
    public fuelLogService: FuelLogService
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
      alert('Por favor completa los campos obligatorios');
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

  deleteVehicle(vehicle: Vehicle): void {
    if (confirm(`¿Eliminar el vehículo "${vehicle.name}"? Esto también eliminará todos sus registros de combustible.`)) {
      this.fuelLogService.deleteLogsByVehicle(vehicle.id);
      this.vehicleService.deleteVehicle(vehicle.id);
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
      alert('Por favor selecciona un vehículo primero');
      return;
    }

    this.editingLog = null;
    this.resetFuelLogForm();

    // Pre-llenar con datos del vehículo
    this.fuelLogForm.currentKm = this.selectedVehicle.currentKm;

    // Calcular km desde la última carga
    const lastLog = this.fuelLogService.getLastLog(this.selectedVehicle.id);
    if (lastLog) {
      this.fuelLogForm.kmSinceLastFill = this.fuelLogForm.currentKm - lastLog.currentKm;
    }

    this.showFuelLogDialog = true;
  }

  saveFuelLog(): void {
    if (!this.selectedVehicle) return;

    if (this.fuelLogForm.liters <= 0 || this.fuelLogForm.currentKm <= 0) {
      alert('Por favor completa los campos obligatorios con valores válidos');
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

    // Calcular eficiencia (km/litro)
    const efficiency = this.fuelLogForm.kmSinceLastFill / this.fuelLogForm.liters;

    // Calcular costo por km
    const costPerKm = this.fuelLogForm.totalPrice / this.fuelLogForm.kmSinceLastFill;

    const logData = {
      vehicleId: this.selectedVehicle.id,
      date: new Date(this.fuelLogForm.date),
      liters: this.fuelLogForm.liters,
      pricePerLiter: this.fuelLogForm.pricePerLiter,
      totalPrice: this.fuelLogForm.totalPrice,
      currentKm: this.fuelLogForm.currentKm,
      kmSinceLastFill: this.fuelLogForm.kmSinceLastFill,
      efficiency: efficiency,
      costPerKm: costPerKm,
      fullTank: this.fuelLogForm.fullTank,
      gasStation: this.fuelLogForm.gasStation,
      notes: this.fuelLogForm.notes
    };

    this.fuelLogService.createLog(logData);
    this.loadData();
    this.selectVehicle(this.selectedVehicle);
    this.showFuelLogDialog = false;
  }

  deleteFuelLog(log: FuelLog): void {
    if (confirm('¿Eliminar este registro de combustible?')) {
      this.fuelLogService.deleteLog(log.id);
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
      currentKm: 0,
      kmSinceLastFill: 0,
      fullTank: true,
      gasStation: '',
      notes: ''
    };
  }

  // Calculations
  onCurrentKmChange(): void {
    if (!this.selectedVehicle) return;

    const lastLog = this.fuelLogService.getLastLog(this.selectedVehicle.id);
    if (lastLog && this.fuelLogForm.currentKm > lastLog.currentKm) {
      this.fuelLogForm.kmSinceLastFill = this.fuelLogForm.currentKm - lastLog.currentKm;
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
}

import { Injectable, ComponentRef, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ConfirmationDialogComponent } from '../components/confirmation-dialog/confirmation-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private confirmationDialogRef: ConfirmationDialogComponent | null = null;

  constructor(
    private messageService: MessageService,
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {
    // Buscar el componente de confirmación en el DOM
    setTimeout(() => {
      const app = this.appRef.components[0];
      if (app && app.instance) {
        // El componente ya está en el template, solo necesitamos acceder a él
      }
    });
  }

  setConfirmationDialog(dialog: ConfirmationDialogComponent): void {
    this.confirmationDialogRef = dialog;
  }

  /**
   * Mostrar mensaje de éxito
   */
  success(summary: string, detail?: string, life: number = 3000): void {
    this.messageService.add({
      severity: 'success',
      summary: summary,
      detail: detail,
      life: life
    });
  }

  /**
   * Mostrar mensaje de error
   */
  error(summary: string, detail?: string, life: number = 5000): void {
    this.messageService.add({
      severity: 'error',
      summary: summary,
      detail: detail,
      life: life
    });
  }

  /**
   * Mostrar mensaje de advertencia
   */
  warn(summary: string, detail?: string, life: number = 4000): void {
    this.messageService.add({
      severity: 'warn',
      summary: summary,
      detail: detail,
      life: life
    });
  }

  /**
   * Mostrar mensaje informativo
   */
  info(summary: string, detail?: string, life: number = 3000): void {
    this.messageService.add({
      severity: 'info',
      summary: summary,
      detail: detail,
      life: life
    });
  }

  /**
   * Mostrar mensaje de confirmación con acciones
   * Retorna una promesa que se resuelve con true/false según la acción del usuario
   */
  confirm(message: string, header: string = '¿Confirmar?'): Promise<boolean> {
    if (!this.confirmationDialogRef) {
      console.error('ConfirmationDialog no está disponible');
      return Promise.resolve(false);
    }

    return this.confirmationDialogRef.show({
      message: message,
      header: header,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No'
    });
  }

  /**
   * Limpiar todos los mensajes
   */
  clear(): void {
    this.messageService.clear();
  }
}

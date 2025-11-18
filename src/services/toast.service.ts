import { Injectable } from '@angular/core';
import { MessageService, ConfirmationService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

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
    return new Promise((resolve) => {
      this.confirmationService.confirm({
        message: message,
        header: header,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí',
        rejectLabel: 'No',
        accept: () => resolve(true),
        reject: () => resolve(false)
      });
    });
  }

  /**
   * Limpiar todos los mensajes
   */
  clear(): void {
    this.messageService.clear();
  }
}

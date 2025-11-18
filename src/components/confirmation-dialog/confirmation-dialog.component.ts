import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { ToastService } from '../../services/toast.service';

export interface ConfirmationData {
  message: string;
  header: string;
  icon?: string;
  acceptLabel?: string;
  rejectLabel?: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss'],
  standalone: false
})
export class ConfirmationDialogComponent implements OnInit {
  visible = false;
  message = '';
  header = '¿Confirmar?';
  icon = 'pi pi-exclamation-triangle';
  acceptLabel = 'Sí';
  rejectLabel = 'No';

  private resultSubject = new Subject<boolean>();

  constructor(private toastService: ToastService) {}

  ngOnInit(): void {
    // Registrarse en el servicio
    this.toastService.setConfirmationDialog(this);
  }

  show(data: ConfirmationData): Promise<boolean> {
    this.message = data.message;
    this.header = data.header;
    this.icon = data.icon || 'pi pi-exclamation-triangle';
    this.acceptLabel = data.acceptLabel || 'Sí';
    this.rejectLabel = data.rejectLabel || 'No';
    this.visible = true;

    return new Promise((resolve) => {
      const subscription = this.resultSubject.subscribe((result) => {
        resolve(result);
        subscription.unsubscribe();
      });
    });
  }

  accept(): void {
    this.visible = false;
    this.resultSubject.next(true);
  }

  reject(): void {
    this.visible = false;
    this.resultSubject.next(false);
  }

  onHide(): void {
    if (this.visible) {
      this.reject();
    }
  }
}

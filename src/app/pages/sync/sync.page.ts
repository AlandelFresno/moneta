import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';

import { GoogleAuthService, GoogleAuthError } from '../../services/google-auth.service';
import { DriveSyncService, SyncResult } from '../../services/drive-sync.service';

@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './sync.page.html',
  styleUrl: './sync.page.scss'
})
export class SyncPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  signedIn = false;
  syncing = false;
  lastSyncedAt: Date | null = null;
  lastError: string | null = null;
  requiresReauth = false;
  lastResult: SyncResult | null = null;

  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly driveSync: DriveSyncService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.googleAuth.isSignedIn$.pipe(takeUntil(this.destroy$)).subscribe((signedIn) => {
      this.signedIn = signedIn;
      this.cdr.markForCheck();
    });

    void this.refreshLastSyncedAt();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async refreshLastSyncedAt(): Promise<void> {
    this.lastSyncedAt = await this.driveSync.getLastSyncedAt();
    this.cdr.markForCheck();
  }

  async connect(): Promise<void> {
    try {
      await this.googleAuth.signIn(this.requiresReauth);
      this.lastError = null;
      this.requiresReauth = false;
      this.messageService.add({ severity: 'success', summary: 'Conectado a Google Drive' });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo conectar',
        detail: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
    this.cdr.markForCheck();
  }

  disconnect(): void {
    this.confirmationService.confirm({
      header: '¿Desconectar Google Drive?',
      message: 'Dejarás de sincronizar tus datos entre dispositivos hasta que vuelvas a conectar tu cuenta.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: async () => {
        await this.googleAuth.signOut();
        this.lastResult = null;
        this.messageService.add({ severity: 'success', summary: 'Desconectado de Google Drive' });
        this.cdr.markForCheck();
      }
    });
  }

  async syncNow(): Promise<void> {
    this.syncing = true;
    this.lastError = null;
    this.requiresReauth = false;
    this.cdr.markForCheck();

    try {
      const result = await this.driveSync.sync();
      this.lastResult = result;
      this.lastSyncedAt = result.syncedAt;
      this.messageService.add({
        severity: 'success',
        summary: 'Sincronización completada',
        detail: this.formatSummary(result)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al sincronizar';
      this.lastError = message;
      this.requiresReauth = error instanceof GoogleAuthError && error.requiresReauth;
      this.messageService.add({ severity: 'error', summary: 'Error al sincronizar', detail: message });
    }

    this.syncing = false;
    this.cdr.markForCheck();
  }

  private formatSummary(result: SyncResult): string {
    return [
      `Transacciones: +${result.transactions.added}/±${result.transactions.updated}`,
      `Categorías: +${result.categories.added}/±${result.categories.updated}`,
      `Servicios: +${result.bills.added}/±${result.bills.updated}`
    ].join(' · ');
  }
}

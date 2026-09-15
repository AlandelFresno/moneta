import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';

import { GoogleAuthService, GoogleAuthError } from '../../services/google-auth.service';
import { DriveSyncService, SyncResult } from '../../services/drive-sync.service';
import { downloadTextFile, readFileAsText } from '../../core/utils/file-download.util';

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
  pulling = false;
  pushing = false;
  lastSyncedAt: Date | null = null;
  lastError: string | null = null;
  requiresReauth = false;
  lastResult: SyncResult | null = null;
  lastAction: 'pull' | 'push' | 'import' | null = null;
  exporting = false;
  importing = false;

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

  async pull(): Promise<void> {
    await this.runSync('pull', () => this.driveSync.pull());
  }

  async push(): Promise<void> {
    await this.runSync('push', () => this.driveSync.push());
  }

  async exportJson(): Promise<void> {
    this.exporting = true;
    this.cdr.markForCheck();

    try {
      const json = await this.driveSync.exportToJson();
      downloadTextFile(`moneta-backup-${this.formatDateForFilename(new Date())}.json`, json, 'application/json');
      this.messageService.add({ severity: 'success', summary: 'Datos exportados' });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'No se pudo exportar',
        detail: error instanceof Error ? error.message : 'Error desconocido'
      });
    }

    this.exporting = false;
    this.cdr.markForCheck();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;

    this.confirmationService.confirm({
      header: '¿Importar datos?',
      message: 'El contenido del archivo se combinará con tus datos locales. Los cambios más recientes prevalecen.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: () => void this.importJson(file)
    });
  }

  private async importJson(file: File): Promise<void> {
    this.importing = true;
    this.lastError = null;
    this.cdr.markForCheck();

    try {
      const json = await readFileAsText(file);
      const result = await this.driveSync.importFromJson(json);
      this.lastResult = result;
      this.lastAction = 'import';
      this.messageService.add({ severity: 'success', summary: 'Datos importados', detail: this.formatSummary(result) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al importar';
      this.lastError = message;
      this.messageService.add({ severity: 'error', summary: 'Error al importar', detail: message });
    }

    this.importing = false;
    this.cdr.markForCheck();
  }

  private formatDateForFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async runSync(action: 'pull' | 'push', run: () => Promise<SyncResult>): Promise<void> {
    if (action === 'pull') this.pulling = true;
    else this.pushing = true;
    this.lastError = null;
    this.requiresReauth = false;
    this.cdr.markForCheck();

    try {
      const result = await run();
      this.lastResult = result;
      this.lastAction = action;
      this.lastSyncedAt = result.syncedAt;
      this.messageService.add({
        severity: 'success',
        summary: action === 'pull' ? 'Datos traídos' : 'Datos subidos',
        detail: this.formatSummary(result)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al sincronizar';
      this.lastError = message;
      this.requiresReauth = error instanceof GoogleAuthError && error.requiresReauth;
      this.messageService.add({ severity: 'error', summary: 'Error al sincronizar', detail: message });
    }

    this.pulling = false;
    this.pushing = false;
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

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ThemeService } from './services/theme.service';
import { GoogleAuthService } from './services/google-auth.service';
import { DriveSyncService } from './services/drive-sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly themeService = inject(ThemeService);
  private readonly googleAuth = inject(GoogleAuthService);
  private readonly driveSync = inject(DriveSyncService);

  constructor() {
    void this.autoSyncOnStartup();
  }

  private async autoSyncOnStartup(): Promise<void> {
    await this.googleAuth.init();
    if (!this.googleAuth.isSignedIn()) return;

    try {
      await this.driveSync.pull();
    } catch (error) {
      console.error('La sincronización automática con Google Drive falló:', error);
    }
  }
}

import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Subject, takeUntil, filter } from 'rxjs';
import { ThemeService } from '../../services/theme.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { DriveSyncService } from '../../services/drive-sync.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

type SyncStatusColor = 'grey' | 'amber' | 'green';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ButtonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() open = false;
  @Output() closeRequested = new EventEmitter<void>();

  private readonly destroy$ = new Subject<void>();

  signedIn = false;
  lastSyncedAt: Date | null = null;

  readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'home', route: '/dashboard' },
    { label: 'Cuentas', icon: 'credit-card', route: '/accounts' },
    { label: 'Transacciones', icon: 'list', route: '/transactions' },
    { label: 'Categorías', icon: 'tags', route: '/categories' },
    { label: 'Servicios', icon: 'calendar-clock', route: '/bills' },
    { label: 'Presupuesto', icon: 'wallet', route: '/budgets' },
    { label: 'Metas', icon: 'flag', route: '/goals' },
    { label: 'Sincronización', icon: 'cloud', route: '/sync' }
  ];

  constructor(
    readonly themeService: ThemeService,
    private readonly googleAuth: GoogleAuthService,
    private readonly driveSync: DriveSyncService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.googleAuth.isSignedIn$.pipe(takeUntil(this.destroy$)).subscribe((signedIn) => {
      this.signedIn = signedIn;
      this.cdr.markForCheck();
    });

    void this.refreshLastSyncedAt();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => void this.refreshLastSyncedAt());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async refreshLastSyncedAt(): Promise<void> {
    this.lastSyncedAt = await this.driveSync.getLastSyncedAt();
    this.cdr.markForCheck();
  }

  get syncStatusColor(): SyncStatusColor {
    if (!this.signedIn) return 'grey';
    if (!this.lastSyncedAt) return 'amber';
    const hoursSinceSync = (Date.now() - this.lastSyncedAt.getTime()) / 3_600_000;
    return hoursSinceSync < 24 ? 'green' : 'amber';
  }

  get syncStatusLabel(): string {
    if (!this.signedIn) return 'Sin conectar';
    if (!this.lastSyncedAt) return 'Nunca sincronizado';
    return this.relativeTime(this.lastSyncedAt);
  }

  private relativeTime(date: Date): string {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutes < 1) return 'Sincronizado ahora';
    if (minutes < 60) return `Sincronizado hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Sincronizado hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Sincronizado hace ${days} d`;
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }
}

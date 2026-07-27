import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { MessageService, ConfirmationService } from 'primeng/api';

import { routes } from './app.routes';
import { palette } from './theme.tokens';

const BudgetTrackerPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: palette.light.accent,
      600: palette.light.accentStrong,
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554'
    },
    colorScheme: {
      light: {
        formField: {
          background: palette.light.surfaceInput,
          borderColor: palette.light.borderStrong,
          color: palette.light.textPrimary,
          placeholderColor: palette.light.textSecondary
        },
        content: {
          background: palette.light.surfaceCard,
          borderColor: palette.light.borderSubtle
        },
        overlay: {
          select: {
            background: palette.light.surfaceCard,
            borderColor: palette.light.borderSubtle,
            color: palette.light.textPrimary
          },
          popover: {
            background: palette.light.surfaceCard,
            borderColor: palette.light.borderSubtle,
            color: palette.light.textPrimary
          },
          modal: {
            background: palette.light.surfaceCard,
            borderColor: palette.light.borderSubtle,
            color: palette.light.textPrimary
          }
        }
      },
      dark: {
        formField: {
          background: palette.dark.surfaceInput,
          borderColor: palette.dark.borderStrong,
          color: palette.dark.textPrimary,
          placeholderColor: palette.dark.textSecondary
        },
        content: {
          background: palette.dark.surfaceCard,
          borderColor: palette.dark.borderSubtle
        },
        overlay: {
          select: {
            background: palette.dark.surfaceCard,
            borderColor: palette.dark.borderSubtle,
            color: palette.dark.textPrimary
          },
          popover: {
            background: palette.dark.surfaceCard,
            borderColor: palette.dark.borderSubtle,
            color: palette.dark.textPrimary
          },
          modal: {
            background: palette.dark.surfaceCard,
            borderColor: palette.dark.borderSubtle,
            color: palette.dark.textPrimary
          }
        }
      }
    }
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    providePrimeNG({
      theme: {
        preset: BudgetTrackerPreset,
        options: {
          darkModeSelector: '.dark'
        }
      }
    }),
    MessageService,
    ConfirmationService
  ]
};

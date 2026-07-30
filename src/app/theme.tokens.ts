export interface ThemeColors {
  surfacePage: string;
  surfaceCard: string;
  surfaceInput: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentStrong: string;
  income: string;
  expense: string;
}

export const palette: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    surfacePage: '#f4f5f7',
    surfaceCard: '#ffffff',
    surfaceInput: '#f4f5f7',
    borderSubtle: '#e2e4e9',
    borderStrong: '#d1d5db',
    textPrimary: '#12141c',
    textSecondary: '#6b7280',
    accent: '#3b82f6',
    accentStrong: '#2563eb',
    income: '#10b981',
    expense: '#ef4444'
  },
  dark: {
    surfacePage: '#0f1420',
    surfaceCard: '#1a2133',
    surfaceInput: '#242c42',
    borderSubtle: '#2d3548',
    borderStrong: '#3c465e',
    textPrimary: '#f1f2f6',
    textSecondary: '#949cb8',
    accent: '#5b9bf7',
    accentStrong: '#3b82f6',
    income: '#34d399',
    expense: '#f87171'
  }
};

# Moneta

App de finanzas personales. Angular + Capacitor, corre en web, Android e iOS.

## Stack

- Angular 20 (standalone components, sin NgModules), control flow `@if`/`@for`
- PrimeNG + TailwindCSS
- RxJS, zoneless (`ChangeDetectorRef.markForCheck()` donde hace falta)
- Capacitor (Android/iOS), datos locales vía `@capacitor/preferences`
- Sync opcional con Google Drive (OAuth + Drive API)

## Estructura

```
src/app/
  core/         # guards, tipos, enums, utils — sin componentes
  pages/        # rutas (accounts, bills, budgets, categories, dashboard, goals, sync, transactions, welcome)
  shared/       # componentes/UI reutilizable
  services/     # servicios de dominio, providedIn: 'root'
```

Cada componente: `.ts` + `.html` + `.scss` en su propia carpeta.

## Funcionalidad

- Transacciones, categorías, cuentas y transferencias
- Bills recurrentes (con fecha de fin / cuotas)
- Budgets con alertas y detección de gastos recurrentes
- Goals de ahorro (con rollover de budgets)
- Dashboard/analytics
- Sync manual con Google Drive (merge por `id` + `updatedAt`, soft-delete)

## Desarrollo

Requisitos: Node 18+, npm 9+.

```bash
npm install
npm start          # http://localhost:4200
npm run build
```

### Google Drive sync (opcional)

`npm run build`/`npm start` corren `scripts/generate-env.mjs`, que genera `src/environments/environment.ts` a partir de env vars:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_API_KEY=...
GOOGLE_MOBILE_CLIENT_ID=...
GOOGLE_MOBILE_CLIENT_SECRET=...
```

Sin esas vars, el sync queda deshabilitado pero el resto de la app funciona igual.

## Mobile

```bash
npm run build:mobile   # build + cap sync
npm run cap:android    # abre Android Studio
npm run cap:ios        # abre Xcode
npm run cap:sync       # sync tras cambios web
```

Build APK debug:

```bash
npm run build
npx cap sync android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew assembleDebug
```

## Licencia

MIT

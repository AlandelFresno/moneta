# Moneta

Una aplicación moderna de seguimiento de presupuestos construida con Angular, TailwindCSS, PrimeNG y Capacitor.

## Stack Tecnológico

- **Frontend Framework**: Angular 20 (standalone components)
- **UI Library**: PrimeNG
- **Styling**: TailwindCSS v3 + SCSS
- **Mobile**: Capacitor (Android & iOS)
- **State Management**: Angular Signals

## Estructura del Proyecto

```
src/
├── app/
│   ├── core/
│   │   ├── models/          # Modelos de datos (Transaction, Budget, Category)
│   │   └── services/        # Servicios (BudgetService)
│   ├── app.ts               # Componente raíz
│   ├── app.html             # Template raíz
│   ├── app.scss             # Estilos raíz
│   ├── app.routes.ts        # Configuración de rutas
│   └── version.ts           # Información de versión
├── pages/
│   └── dashboard/           # Página de dashboard
│       ├── dashboard.page.ts
│       ├── dashboard.page.html
│       └── dashboard.page.scss
├── components/              # Componentes reutilizables
└── styles.scss              # Estilos globales
```

## Convenciones de Código

- **Páginas**: Cada página debe tener 3 archivos separados (.ts, .html, .scss)
- **Componentes**: Igual que páginas, siempre archivos separados
- **No usar templates inline**: Siempre usar `templateUrl` y `styleUrls`
- **SCSS**: Todos los estilos en SCSS, no CSS

## Desarrollo Local

### Requisitos Previos
- Node.js 18+
- npm 9+

### Instalación

```bash
npm install
```

### Servidor de Desarrollo

```bash
npm start
```

Navega a `http://localhost:4200/`

### Build de Producción

```bash
npm run build
```

## Desarrollo Móvil

### Build para Móvil

```bash
npm run build:mobile
```

Este comando construye la aplicación Angular y sincroniza los archivos con Capacitor.

### Abrir en Android Studio

```bash
npm run cap:android
```

### Abrir en Xcode

```bash
npm run cap:ios
```

### Sincronizar Cambios

Después de hacer cambios en el código web:

```bash
npm run cap:sync
```

### Build APK

npm run build
npx cap sync android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd android && ./gradlew assembleDebug


## Características

- ✅ Dashboard con resumen financiero
- ✅ Gestión de transacciones (ingresos y gastos)
- ✅ Seguimiento de presupuestos por categoría
- ✅ Responsive design (móvil y escritorio)
- ✅ Build nativo para Android e iOS

## Próximos Pasos

1. Agregar persistencia de datos (LocalStorage o IndexedDB)
2. Implementar gráficos y visualizaciones
3. Agregar categorías personalizadas
4. Implementar filtros y búsqueda de transacciones
5. Exportar reportes

## Licencia

MIT

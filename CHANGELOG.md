# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING**: Downgraded TailwindCSS from v4 to v3 for better stability
- **BREAKING**: Restructured project to use pages/ and components/ directories
- **BREAKING**: All components now require separated files (.ts, .html, .scss)
- Moved from CSS to SCSS for all styling
- Dashboard moved from features/dashboard to pages/dashboard
- All inline templates converted to separate HTML files
- Added tailwind.config.js configuration
- Updated angular.json to support SCSS by default

### Fixed
- TailwindCSS styles now loading correctly
- PrimeNG components displaying properly
- Build process optimized with better style handling

## [0.1.0] - 2025-11-05

### Added
- Initial project setup with Angular 20, TailwindCSS v4, PrimeNG, and Capacitor
- Core data models (Transaction, Budget, Category)
- BudgetService with Angular Signals for state management
- Modern dashboard with:
  - Gradient stat cards for Income, Expenses, Balance, and Savings Goal
  - Budget overview with progress bars
  - Recent activity section
  - Quick actions panel
  - Responsive navigation header
- Mobile build support for Android and iOS via Capacitor
- Project structure with core, features, and shared directories
- npm scripts for mobile development workflow

### Features
- 📊 Dashboard with financial summary cards
- 💳 Budget tracking with visual progress indicators
- 📱 Mobile-ready responsive design
- 🎨 Modern UI with gradient cards and smooth animations
- 🔔 Notification badge in header
- 👤 User avatar component

### Technical
- Angular 20 with standalone components
- TailwindCSS v3 + SCSS for styling
- PrimeNG component library integration
- Capacitor for native mobile builds
- TypeScript strict mode
- Signal-based state management
- Separated file structure (no inline templates)
- Version tracking system

### Planned Features
- Transaction management (add, edit, delete)
- Budget creation and management
- Data persistence (LocalStorage/IndexedDB)
- Charts and data visualization
- Categories customization
- Export reports (CSV/PDF)
- Search and filter transactions
- Multi-currency support

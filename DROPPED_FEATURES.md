# Dropped Features

Everything cut from the original app during the rewrite. Kept here so any of these can be re-added later on purpose, not by accident. Old code for all of this still lives in `src-old/` (git history if that's deleted too).

Current rewrite scope: **Transactions + Categories only, ARS only.**

## Accounts

Bank/cash/credit/savings/investment accounts. Each account had: name, type, running `balance`, `currency`, color/icon. Transactions were linked to an account via `accountId`, and transfers moved money between two accounts.

Old files: `src-old/models/account.model.ts`, `src-old/services/account.service.ts`.

## Budgets

Per-category spending limits. Fields: name, `categoryId`, `limit`, `currency`, `period` (monthly/weekly/yearly), optional custom `startDate`/`endDate`, `alertThreshold` (% to trigger a warning, e.g. 80).

Old files: `src-old/models/budget.model.ts`, `src-old/pages/budgets/`, `src-old/services/budget.service.ts` (+ a dead duplicate at `src-old/app/core/services/budget.service.ts`, never wired up).

## Multi-currency / exchange rates

Transactions and budgets could be in ARS/USD/EUR/BRL. Three conversion modes:
- **live** — balance stays in native currency, converts at today's rate on display
- **frozen** — conversion happened at entry time, rate locked forever
- **transfer** — internal account-to-account move, excluded from income/expense stats

Supporting fields on Transaction: `currency`, `convertedAmount`, `conversionSource` (api/cache/manual), `usdRate`, `exchangeRates` snapshot (ARS/USD/EUR/BRL at save time), `transferGroupId` (linked both legs of a transfer).

Old files: `src-old/services/exchange-rate.service.ts`, `src-old/services/currency-display.service.ts`, `src-old/constants/currencies.ts`.

USD display ("nice to have in sight") was requested for the new app too, then explicitly deferred — not built.

## Google Drive sync

Backup/restore of app data to/from the user's Google Drive. Config held `clientId`, `apiKey`, `discoveryDocs`, `scopes`; synced files tracked by `id`/`name`/`mimeType`/`webViewLink`.

Old files: `src-old/models/google-drive.model.ts`, `src-old/services/google-drive.service.ts`, `src-old/services/sync.service.ts`.

## Fuel log + Vehicles

Per-vehicle fuel tracking: liters, price/liter, total price, currency, km traveled, total km, computed efficiency (km/liter) and cost/km, full-tank flag, gas station, notes. Vehicles had brand/model/year/plate/tank capacity/fuel type.

Old files: `src-old/models/fuel-log.model.ts`, `src-old/models/vehicle.model.ts`, `src-old/pages/fuel/`, `src-old/services/fuel-log.service.ts`, `src-old/services/vehicle.service.ts`.

## Billing / Monotributo (AR tax)

Argentina monotributo tax tracking: monthly billing entries (amount, month/year), a hardcoded table of 11 tax categories (A–K) with annual/monthly billing limits and monthly fees (services vs goods), and recategorization period reminders (January/July).

Old files: `src-old/models/billing.model.ts`, `src-old/pages/billing/`, `src-old/services/billing.service.ts`.

## Dashboard / Analytics views

Summary dashboard and analytics/charts page (used `chart.js`), built on top of accounts/budgets/multi-currency data. Out of scope until core Transaction+Category flow is rebuilt — may come back in a simpler form once there's data to show.

Old files: `src-old/pages/dashboard/`, `src-old/pages/analytics/`.

## Import/Export

CSV import and xlsx export of transaction data.

Old files: `src-old/services/csv.service.ts`, `src-old/services/export.service.ts`.

## Data migration framework

Runtime migration runner that ran on app boot to backfill/fix old data shapes (e.g. missing `rateMode` on old transactions). Replaced by the "no legacy shims" rule — if old data ever needs importing again, write a one-off explicit migration, not a permanent runtime layer.

Old files: `src-old/services/data-migration.service.ts`.

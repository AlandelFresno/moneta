# Rewrite Plan

Full rewrite of app on same repo/history. Reason: tech debt (duplicate models/services, flat non-standard folder layout, NgModule-based pages, legacy field shims). Scope cut hard during rewrite, see below — final scope is **Transactions + Categories only**.

Status markers: `[ ]` todo, `[~]` in progress, `[x]` done.

## Steps

- [x] **1. Branch** — create `rewrite/v1` off `dev`.
- [x] **2. Scaffold layout** — old app moved to `src-old/` (reference only, not built). Fresh `src/` created: standalone `App` root via `bootstrapApplication`, zoneless, empty `app.routes.ts`, `src/app/{core/{guards,interfaces,types,enums,utils},pages,shared,services}` scaffolded. `angular.json` polyfills updated (dropped zone.js). Build verified clean.
- [x] **3. Drop out-of-scope domains** — n/a now: fresh `src/` starts empty, so fuel/vehicle/billing are simply never ported from `src-old/`.
- [x] **4. Redesign + write models** — scope simplified hard during rewrite (see Scope change below). Written to `src/app/core/types/`: `category.types.ts`, `transaction.types.ts`. Dead code found: `src-old/app/core/models/*` and `src-old/app/core/services/budget.service.ts` were unused duplicates (confirmed via import grep) — not ported.
- [ ] **5. Convert pages to standalone** — Transactions page (+ Categories, if it gets its own page rather than inline management) rebuilt as standalone components with `@if`/`@for`, no `*.module.ts`.
- [ ] **6. Rebuild services** — Category + Transaction services in `services/`, `providedIn: 'root'`, typed `Observable<T>`, no `any`.
- [ ] **7. Port order** (each tested live in browser before moving to next):
  - [ ] Category
  - [ ] Transaction (plain ARS amount, no rate modes/transfers/conversion)

### Scope change (decided during step 4)

Cut hard from original 8-domain plan down to **Transactions + Categories only**:
- **No Accounts domain.** No account balances, no `accountId` on transactions.
- **No Budgets domain.** Dropped entirely — not just deferred.
- **No Google Drive sync.** Dropped for now — local data only. Can revisit later.
- **No multi-currency.** Everything is ARS only. Dropped `currency` field, rate modes (`live`/`frozen`/`transfer`), `transferGroupId`, `convertedAmount`, `conversionSource`, `usdRate`, `exchangeRates` snapshot, and the `resolveRateMode()` legacy resolver entirely.
- USD "nice to have in sight" was requested then explicitly deferred — not building conversion display for now.
- Transaction now: `id, categoryId, type, name, description, amount, date, createdAt, updatedAt, deletedAt?`.
- Dashboard/Analytics views also out of scope until core Transaction+Category flow works.
- [ ] **8. Cleanup** — delete old flat `src/{components,models,pages,services}` dirs once ported, remove dead code, confirm `npm run build` + `npm run test` clean.

## Notes

- Keep old code reachable via git history — no need to preserve it in-tree once ported.
- Test each domain slice in the running app before starting the next.

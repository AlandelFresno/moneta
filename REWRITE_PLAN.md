# Rewrite Plan

Full rewrite of app on same repo/history. Reason: tech debt (duplicate models/services, flat non-standard folder layout, NgModule-based pages, legacy field shims). Trimmed scope — Fuel/Vehicle/Billing domains dropped.

Status markers: `[ ]` todo, `[~]` in progress, `[x]` done.

## Steps

- [ ] **1. Branch** — create `rewrite/v1` off `dev`.
- [ ] **2. Scaffold layout** — create `src/app/{core,pages,shared,services}` per CLAUDE.md structure rules.
- [ ] **3. Drop out-of-scope domains** — remove fuel, vehicle, billing pages/models/services/routes.
- [ ] **4. Consolidate models** — one model per entity (Account, Transaction, Category, Budget) in `core/types/`. Resolve current duplicates between `app/core/models/` and `models/`. Drop deprecated fields (e.g. `conversionRate`); keep rate-mode resolution as a util, not an inline model fallback.
- [ ] **5. Convert pages to standalone** — all 5 in-scope pages (Dashboard, Transactions, Budgets, Categories, Settings) rebuilt as standalone components with `@if`/`@for`, no `*.module.ts`.
- [ ] **6. Rebuild services** — one service per domain in `services/`, `providedIn: 'root'`, typed `Observable<T>`, `HttpParams` for query params, no `any`.
- [ ] **7. Port order** (each tested live in browser before moving to next):
  - [ ] Category
  - [ ] Account
  - [ ] Transaction (incl. multi-currency + rate modes + transfers)
  - [ ] Budget
  - [ ] Exchange-rate service
  - [ ] Google Drive sync
  - [ ] Dashboard / Analytics views
- [ ] **8. Cleanup** — delete old flat `src/{components,models,pages,services}` dirs once ported, remove dead code, confirm `npm run build` + `npm run test` clean.

## Notes

- Keep old code reachable via git history — no need to preserve it in-tree once ported.
- Test each domain slice in the running app before starting the next.

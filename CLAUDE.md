# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project

Moneta — Angular + Capacitor personal finance app (accounts, transactions, categories, budgets, multi-currency, Google Drive sync). Mobile via Capacitor (Android/iOS).

## Stack

- Angular 20+, standalone components only — **no NgModules**
- Control flow: `@if` / `@for` / `@switch` — never `*ngIf` / `*ngFor`
- PrimeNG + Tailwind CSS
- RxJS, Capacitor (android/ios)
- Zoneless — use `ChangeDetectorRef.markForCheck()` / `detectChanges()` when needed

## Folder structure

```
src/app/
  core/         # guards, interfaces, types, enums, utils — no components
  pages/        # routed, standalone feature components (one per folder)
  shared/       # reusable UI components, directives, pipes
  services/     # domain API/data services, providedIn: 'root'
```

One component per folder: `.ts` + `.html` + `.scss`. No component logic outside `app/` (i.e. no top-level `src/pages`, `src/services`, `src/models`, `src/components` — everything lives under `src/app/`).

## Rules

- **Never use `any`.** All types explicit — interfaces, DTOs, service signatures, return types.
- **No duplication.** Before writing a method/model/component, search for an existing one. One model per domain entity, one service per domain, one place for shared UI logic (`shared/`) and utilities (`core/utils/`).
- **Services**: every method returns `Observable<T>` with explicit generic — never `Observable<any>`, never bare `.subscribe()` for one-shot calls (use `lastValueFrom` in `async` methods instead).
- **Query params**: build with `HttpParams`, never manual string concat.
- **Models/types**: co-located per domain in `core/types/<domain>.types.ts` or the service file — never inline in components.
- **State/lifecycle**: `takeUntil(this.destroy$)` pattern (Subject + `ngOnDestroy`) for subscriptions. Debounce inputs with `debounceTime` + `distinctUntilChanged`, not `setTimeout`.
- **No legacy shims**: don't add deprecated/optional fields for backward compatibility with old data shapes. If a data migration is needed, write an explicit one-time migration, not a runtime fallback (`resolveXxx()` style resolvers) sprinkled through the domain model.
- **Comments**: only when the *why* isn't obvious (hidden constraint, workaround, subtle invariant). Never explain *what* the code does.

## Domain scope (post-rewrite)

In scope: **Transactions, Categories, Bills (recurring), Dashboard/Analytics, Google Drive sync**. Transactions are plain ARS amounts — no multi-currency, no rate conversion.

Google Drive sync (`GoogleAuthService` + `DriveSyncService`) is a manual "Sync now" action plus one automatic pull-merge on app startup — not continuous background sync. It merges by `id` + `updatedAt` (newest wins, ties go to local) across Transactions/Categories/Bills, treating soft-deletes (`deletedAt`) as just another mutation so deletions propagate across devices instead of resurrecting. Every domain service exposes `getAllIncludingDeleted()` (sync reads this) and `replaceAll()` (sync writes through this) alongside the normal filtered `getAll()`.

Out of scope — do not resurrect without explicit request: Accounts, Budgets, Exchange rates/multi-currency, Fuel log, Vehicle, Billing/Monotributo (AR tax bracket).

See `REWRITE_PLAN.md` for the active rewrite steps and status.

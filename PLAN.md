# PLAN — Hearth (household finance for Alex & Nancy)

Working name: **Hearth**. One app, two users, both countries' money in one correct view.

## Stack (per PROMPT.md §3: boring and mainstream)

- **Next.js 16** (App Router, server actions) + TypeScript + Tailwind v4
- **SQLite** via better-sqlite3 + **Drizzle ORM** (drizzle-kit migrations)
- **iron-session** cookie sessions, bcryptjs password hashing
- **Papaparse** for CSV import; hand-rolled SVG charts (no chart lib)
- **Anthropic API** (when `ANTHROPIC_API_KEY` is set) for transaction categorization and advisor memos; every AI feature degrades gracefully to a visible "not configured / uncategorized" state — never a fabricated value (house rule 1)
- Deploy target: any $5–10/mo Node host or free tier (single process + one SQLite file + `DATA_DIR` volume)

## Data model (all money = integer cents; house rule 2)

- `users`, `households` (invite code, display currency), `household_members`
- `accounts` — householdId, owner, name, institution, country (US/CA), type (checking, savings, credit, brokerage, retirement), currency (USD/CAD), connectionSource (`manual` | `csv` | `mock` | `plaid` | `snaptrade` | `questrade`)
- `balance_snapshots` — per-account dated balances (manual accounts are first-class; net-worth history derives from these)
- `transactions` — amountCents signed, dedupe `hash` (account + date + amount + normalized description), importId, categoryId
- `categories` (household-scoped, seeded defaults), `budgets` (category × month)
- `holdings` — brokerage positions (symbol, qty, price, asOf, currency)
- `fx_rates` — daily USD/CAD from frankfurter.app (ECB), fallback open.er-api.com; last known rate used **with a visible "stale as of" marker** when fetch fails
- `imports` + `import_mappings` — remembered per-institution CSV column mappings (keyed on header signature)
- `recommendations` — append-only advisor log (kind: allocation | pick; body memo; status open/accepted/declined; outcome notes). Immutable body, status transitions only (house rule 4)
- `investment_settings` — ETF targets (symbol/weight/account), 10% pick cap (hard), cashback account
- `cashback_entries` — Gold Card spend per month; earnings computed at **3% brokerage-redemption** (or 2.1% statement-credit) per verified card rules
- `sync_connections` — provider health for the connections UI

## Sync adapter contract (PROMPT.md §3)

`src/lib/sync/types.ts`: every source implements `SyncAdapter { probe(); fetchAccounts(); fetchBalances(); fetchTransactions(); fetchHoldings(); }` returning normalized records. Implementations: `manual`, `csv` (import pipeline), `mock` (deterministic fixtures — also powers the chaos test with fail/partial/stale modes), and configured-but-keyless `plaid` / `snaptrade` / `questrade` stubs that report "not configured" in connection health until real keys are added. App core reads only the contract.

## Milestones (PROMPT.md §6)

- **M1 Ledger:** auth + household invite; accounts CRUD; manual balances; CSV import with column mapping + dedupe; multi-currency net worth dashboard with FX conversion and stale markers.
- **M2 Budget:** categories, budgets vs. actuals by month, LLM categorization (batch button), spending analytics.
- **M3 Sync:** adapter interface + mock adapter + connection-health UI; Plaid/SnapTrade/Questrade stubs behind env config.
- **M4 Invest:** deterministic 90/10 engine (instructions output), cashback tracker (3% math), advisor memos with immutable track record.
- **M5 Polish:** responsive 390px, dark mode, empty/loading/error/stale states everywhere, export (JSON + CSV), verification passes.

## Verification (PROMPT.md §5/§6)

- Vitest unit tests: money/FX math, dedupe, 90/10 engine, cashback math (reconciliation test ground truth).
- Seed script builds the fixture household.
- Fresh-context sub-agent drives the **running app** via Playwright/Chromium (screenshots at desktop + 390px, light/dark), attempts the Nancy test and reconciliation test, and reports failures before anything is called done.

## Assumptions made without asking (flag here per §6; change any of these later cheaply)

1. Password login + household invite code (magic links need an email provider — deferred; swap-in point isolated in `lib/auth.ts`).
2. Display currency defaults to USD, toggleable to CAD per user preference.
3. FX source frankfurter.app (free, no key). Holdings prices are entered/imported, not live-quoted (PROMPT.md anti-scope: no real-time quotes).
4. Advisor uses `claude-sonnet-5` for memos, `claude-haiku-4-5` for categorization when a key is present.
5. App name "Hearth" — trivially renamable in one config.

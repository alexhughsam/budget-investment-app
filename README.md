# Hearth — household budget & investment tracker

One home for a couple's money on both sides of the US–Canada border: every account in one correct
multi-currency net-worth view, monthly budgeting, and a disciplined 90/10 investment workflow with an
AI research advisor that never trades.

![Dashboard](docs/screenshots/08-dashboard.png)

## Features

- **Two-login household** — one partner signs up, the other joins with an invite code; both see everything.
- **US + Canada, USD + CAD done right** — every account keeps its native currency; net worth converts at a
  daily ECB rate, and every converted figure shows its rate, source, and date. Stale data is always marked,
  never silently presented as fresh.
- **Manual-first accounts** — balances by hand or CSV statement import with a column-mapping UI that
  remembers each institution's format and dedupes on re-import. Works for the accounts no aggregator
  handles (looking at you, unknown-provider 401(k)s).
- **Budgeting** — categories, budgets vs. actuals, month navigation, AI transaction categorization
  (Claude, structured output) with an honest off-state when no API key is configured.
- **The 90/10 engine** — deterministic code splits investable cash: ~90% to your ETF plan (largest-remainder
  allocation, sums to the cent), a hard-capped ≤10% pick sleeve funded by Robinhood Gold Card cashback at the
  real 3% brokerage-redemption rate.
- **Advisor memos** — Claude + web search writes cited research memos against your actual numbers, keeps an
  immutable accept/decline/outcome log, and learns from its own track record. It advises; a human trades.
- **Sync adapters** — a provider-agnostic contract with a chaos-testable mock today and credential-gated
  stubs for Plaid (TD US/Canada), SnapTrade (Robinhood/Wealthsimple/Questrade/Fidelity), and Questrade's
  personal API.
- **Your data is yours** — one-click JSON and CSV export. All money is integer cents; floats never touch a
  currency amount.

## Run it

```bash
npm install
npm run dev          # or: npm run build && npm start
```

Optional environment:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables AI categorization + advisor memos |
| `SESSION_SECRET` | Session cookie secret — set this in production |
| `DATA_DIR` | SQLite location (default `./data`) |
| `HEARTH_AI_MODEL` | Claude model override (default `claude-opus-4-8`) |
| `HEARTH_ENABLE_MOCK` / `HEARTH_MOCK_MODE` | Demo sync connection; `ok\|fail\|partial\|stale` for chaos testing |

Tests: `npx vitest run` (money math, 90/10 engine, cashback, CSV mapping/dedupe).

## Project docs

- **[PROMPT.md](PROMPT.md)** — the original build prompt, written as a retiring lead engineer's handoff.
- **[BUILD-VS-BUY.md](BUILD-VS-BUY.md)** — why this exists instead of a Monarch subscription (short version:
  Monarch adds C$10,000 + US$10,000 and calls it $20,000).
- **[PLAN.md](PLAN.md)** — architecture and milestone plan.
- **[PROGRESS.md](PROGRESS.md)** — current status, verification evidence, what's next.

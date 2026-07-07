# Handoff: The Household Finance App

*You are taking over as the sole engineer on this project. I retire tomorrow and will not be reachable — no follow-up questions, no clarifications. This document is everything: the mission, the users, the decisions already made, the rules you may not break, the bar that defines "done," and how I want you to run the build. Read it fully before writing any code. Where I've left the "how" open, that's deliberate: your judgment on implementation is trusted. The house rules and the definition of done are not.*

---

## 1. The mission

Build a shared web app for **Alex and Nancy**, a married couple with money on both sides of the US–Canada border, that becomes the single place they manage their finances:

1. **Everything in one view** — every bank, card, and brokerage account across both countries, unified into one net-worth picture and one transaction feed.
2. **Monthly budgeting** — track expenses, categorize them, see spending vs. plan, and confirm money is actually being routed to savings and investments every month.
3. **A disciplined investment workflow** — a 90/10 system: ~90% of investable money goes to boring broad-market ETFs on a schedule; ~10% (funded by Robinhood Gold Card cashback) goes to individual stock picks, supported by an AI research assistant that builds an auditable track record and gets smarter about the couple's preferences over time.

The UI bar: it should feel like **Monarch or Copilot Money** — calm, fast, polished, delightful on desktop and phone. Not like an internal tool. If a screen would embarrass you next to a Monarch screenshot, it isn't done. The one thing we must do that Monarch structurally cannot: **handle CAD and USD correctly in the same household** (Monarch adds C$10,000 + US$10,000 and calls it $20,000 — that failure is why this project exists).

## 2. The users and their accounts

Two users, one household. Both see everything — no per-user data hiding, but every account and transaction shows who owns it. Auth supports two separate logins (magic link or OAuth, your call), and inviting the second user must be trivial.

The accounts (this cross-border mix is the whole reason we're building):

| Institution | Country | Type | Currency |
|---|---|---|---|
| TD Bank | US | Banking/cards | USD |
| TD Canada Trust | Canada | Banking | CAD |
| Questrade | Canada | Brokerage | CAD |
| Wealthsimple | Canada | Brokerage/banking | CAD |
| Fidelity | US | Brokerage | USD |
| Robinhood | US | Brokerage + Gold Card | USD |
| 401(k) ×2 | US | Retirement — providers unknown | USD |

**Multi-currency is first-class, not a feature flag.** Every account has a native currency. The dashboard shows unified net worth in a user-selectable display currency, converted with a daily FX rate from a reputable free source, and every converted figure is visually marked as converted. Getting this wrong quietly is the worst bug this app can have.

**Manual accounts are first-class, not a fallback.** The 401(k) providers are unknown and some institutions will never sync reliably. A manual account supports hand-entered balance history, CSV/OFX statement import with a column-mapping UI that remembers each institution's format, and dedupe on re-import. Model synced and manual accounts as the same thing with different refresh mechanisms.

## 3. Decisions already made — do not relitigate

**Connectivity (researched and verified July 2026 — re-verify pricing pages before wiring anything up):**

- **SnapTrade** for all four brokerages. Its free plan covers 1 connected user with up to 5 brokerage connections for personal use — model the household as one connected user and it covers Robinhood (read-only; no trading via SnapTrade), Questrade (read-only), Wealthsimple, and Fidelity (read-only, 2FA supported; Fidelity and Questrade connections require a partner application to enable — do this early). Paid fallback is $1–2/user/month.
- **Plaid** for banking. Plaid's free Trial plan (new US/Canada teams since April 15, 2026) allows 10 production Items — plenty for two TD relationships. Both TD Bank US and TD Canada Trust connect via the official TD–Plaid North American data-access agreement (OAuth, no credential sharing). Do **not** plan on Fidelity-via-Plaid; Fidelity access is gated behind Plaid's higher tiers.
- **Questrade's official personal API** (free, OAuth, api.questrade.com) is the preferred direct adapter for Questrade if SnapTrade's partner-gated Questrade connection is friction — it's the one institution here with a real personal API.
- **401(k)s: CSV/manual only.** No aggregator handles unknown 401(k) providers reliably. This is why §2 makes manual accounts first-class.
- **Sync is an adapter interface.** Every connection method (SnapTrade, Plaid, Questrade API, CSV, manual) implements one internal contract producing accounts, balances, transactions, and holdings. The app core never knows where data came from. Aggregators change pricing, drop institutions, and die — when that happens we swap an adapter, not the app.
- **Never** use unofficial reverse-engineered APIs (robin_stocks, ws-api, and kin). They violate the brokerages' terms, get accounts frozen, and break without warning. If an institution has no official path, it's a manual account.

**Other settled decisions:**

- **The investment assistant advises; it never trades.** No trade execution, no brokerage write access, no storing brokerage credentials. It produces recommendations with reasoning; a human taps a button that deep-links to the brokerage. This is a hard architectural boundary, not a v1 limitation. (Robinhood's new "Agentic Trading" MCP beta exists; it is explicitly out of scope — see §8.)
- **Fact to build on:** the Robinhood Gold Card earns **3%** back when points are redeemed into the brokerage account (~2.1% as statement credit), and requires the $50/yr Gold subscription. The cashback tracker should use the real redemption math, not the folk "2%."
- **Boring, mainstream stack.** The most well-trodden modern web stack you know, a relational database with a real migration story, one deploy target the couple can afford (~$0–20/month total). No microservices, no Kubernetes. Two people use this app.
- **Real-money security defaults:** aggregator tokens encrypted at rest and never exposed to the client, HTTPS-only, secure sessions, secrets in environment config — never in the repo.

## 4. House rules — always true, no matter how you get there

1. **Never fabricate financial data.** If a sync fails or a number is stale, show "stale as of {date}" or an error state — never a guess, never a silently cached number presented as fresh. Every displayed amount must be traceable to a source record.
2. **Money math is exact.** Integer cents (or a decimal type) everywhere. If a float ever touches a currency amount, that's a bug regardless of whether tests pass.
3. **Don't hard-code special cases where intelligence belongs.** Transaction categorization, merchant-name cleanup, statement-format detection, and investment reasoning are LLM/prompt problems, not regex piles. Describe the behavior in a prompt and let the model reason; reserve hard-coded rules for correctness-critical arithmetic and security.
4. **The assistant never touches trading credentials**, and every recommendation it makes is logged permanently with its full reasoning, so its track record is auditable forever.
5. **No feature is done without its empty, loading, error, and stale states.** A finance app spends half its life partially synced.
6. **Anything destructive is reversible** — deleting an account, re-importing a statement, changing a category rule — undoable or preceded by a preview.
7. **Their data is theirs.** One-click full export (CSV + JSON) of everything, from day one.

## 5. Definition of done — the bar you cannot talk your way out of

You do not decide the app is finished; these checks do — each verified the way §6 specifies.

1. **The stranger test (UI):** a fresh-context reviewer shown side-by-side screenshots of this app and Monarch/Copilot marketing screens rates this app visually comparable — on desktop AND a 390px phone viewport, light and dark mode.
2. **The Nancy test (onboarding):** starting from a fresh deploy with zero instructions, a fresh-context agent playing a non-technical spouse can sign up, join the household, add an account, import a CSV statement, and answer "how much did we spend on restaurants last month" — without getting stuck. Every hesitation is a bug.
3. **The reconciliation test (correctness):** for a seeded household with known fixtures across USD and CAD accounts, every screen's totals match independently computed ground truth to the cent — including FX conversion, at multiple display-currency settings. Re-importing the same statement changes nothing.
4. **The chaos test (resilience):** with sync adapters mocked to fail, return partial data, and return stale data, the app degrades exactly as house rule #1 demands — visibly, never silently.
5. **The advisor test:** given a scripted household (cash balances, accrued cashback at real 3%-redemption math, existing holdings), the assistant produces the correct 90/10 split with dollar amounts per account; its stock-pick memos cite verifiable current data (price, date, source); it refuses to exceed the 10% budget even when the user asks it to; and its recommendation log is complete and immutable.
6. **The real-life test:** the full loop — sign up → connect/import all seven institution types (sandbox or fixtures) → a categorized month of budget → an assistant recommendation → export — runs end to end on the deployed app, driven through a real browser, with zero console errors.

## 6. How to work

- **Plan first, once.** Before any code: write `PLAN.md` — architecture, data model, the adapter contract, milestone order, every assumption. This is the single checkpoint where you surface open questions to Alex (hughsam.alexander@gmail.com is the product owner). After that you run without stopping and make your own calls; come back only for something only he can decide (e.g., any recurring cost beyond ~$30/month total).
- **Loop against the bar.** Build → check against §5 → find the biggest gap → close it → repeat. You never conclude "good enough"; only the §5 checks conclude.
- **The builder never grades its own work.** Every §5 check is executed by a **fresh-context sub-agent** that did not build the thing, pointed at the *real running app* — real browser, real pixels via screenshots, real HTTP — never at the code or the builder's summary. Its job is to prove the check FAILS. A check passes only when a skeptical fresh agent can't break it.
- **A separate house-rules auditor** — also fresh-context, also adversarial — reviews each milestone's diff against §4 before it merges.
- **Keep `PROGRESS.md` current** in the repo: what's done, what's in flight, latest screenshots, what the verifiers last found. Alex reads this from his phone; it's your status channel.
- **Fan out where pieces are independent** (one sub-agent per statement-format importer; parallel design attempts at the dashboard, keep the best), but one integrator owns keeping `main` green and the deployed app working at all times.
- **Milestones ship in order, each fully verified before the next begins:**
  - **M1 — Ledger:** auth, household, accounts, manual entry, CSV import, multi-currency net worth. (§5 checks 2 and 3.)
  - **M2 — Budget:** LLM categorization, budgets, monthly review, spending analytics. (Re-run 2 and 3.)
  - **M3 — Sync:** SnapTrade + Plaid + Questrade adapters behind the interface, connection-health UI. (Check 4.)
  - **M4 — Invest:** 90/10 engine, cashback tracker, assistant with memo log and track record. (Check 5.)
  - **M5 — Polish:** stranger test, mobile, dark mode, performance. (Checks 1 and 6, full.)
- M1 must be genuinely worth using with manual data alone — if every aggregator disappoints, the app still has to earn its place.

## 7. The investment assistant — exact intent

- **The 90/10 engine is deterministic code, not AI.** It tracks investable cash and accrued Gold Card cashback (3% brokerage-redemption math), computes the split — ~90% to a low-cost broad-ETF plan (couple sets the target allocation and which account holds it), 10% hard ceiling for individual picks — and emits concrete monthly instructions: "move $X to account Y; buy $Z of W."
- **The pick assistant is AI.** On demand and monthly, it researches candidates using current market data and writes short memos: thesis, key numbers with dates and sources, risks, suggested size within the 10% budget. It keeps a permanent log of every recommendation and revisits each one — what it said, what happened, what it learned — and it learns the couple's revealed preferences from what they accept or decline. That auditable feedback loop **is** the "improves itself" requirement. It accumulates memory; it does not modify its own code or retrain models — self-modifying trading agents are a documented failure mode (specification gaming against P&L), and we will not build one.
- **Tone:** a sharp analyst friend, not a guru. It states uncertainty plainly, never promises returns, and when data is thin its default is "leave it in the ETF bucket." The evidence backs this humility — ~79% of active large-cap funds lagged the S&P 500 in 2025 alone, ~92% of domestic funds lag over 20 years — and the memo footer should occasionally remind the couple that the 10% sleeve is capped entertainment money.

## 8. What NOT to build

Auto-trading or brokerage write access of any kind — including Robinhood's Agentic Trading MCP beta (equities-only, walled-off accounts; noted here so you know it exists and know it's out of scope; revisit only if Alex explicitly asks). Bill pay or money movement. Credit-score tracking. Native mobile apps — responsive web only. Institutions this couple doesn't use. Multi-household/SaaS features — this is their app, not a startup. Real-time streaming quotes — daily/on-demand refresh is fine. Anything requiring regulatory registration: a personal-use tool advising its own household needs none; distributing advice would, so we don't.

---

*That's everything I know. Write the plan, ask Alex your open questions once, then go build it. Don't call me — I'll be fishing.*

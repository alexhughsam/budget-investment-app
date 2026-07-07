# Build it, or just pay for Monarch?

**Verdict: build it.** Not because building is free, but because the single most important thing you need — one correct net worth across USD and CAD accounts — is something Monarch structurally cannot do, and the connectivity that used to make DIY impractical is now nearly free. Details and the honest counter-case below. All facts checked against sources in July 2026, with the load-bearing claims independently re-verified; vendor pricing pages move, so re-check them the week you start.

## Why Monarch specifically doesn't fit you

Monarch is a great app, and it *does* support Canada (it launched there in late 2023, still accepts new Canadian connections, and users report TD Canada Trust and Wealthsimple connecting). Its household sharing for couples is among the best in the category. But two things kill it for your exact situation:

1. **No currency conversion — at all.** Monarch displays every account with a bare `$` and sums CAD and USD as if they were the same currency: C$10,000 + US$10,000 shows as "$20,000." Monarch's own help docs recommend connecting only one country's accounts and warn that mixing "may produce misleading totals." Your household is roughly half CAD (TD Canada Trust, Questrade, Wealthsimple) and half USD (TD US, Fidelity, Robinhood, 401(k)s), so your headline net worth — the number the whole app exists to show you — would be wrong by construction, by roughly the USD/CAD exchange gap, every single day.
2. **Questrade is unconfirmed.** It appears in Monarch's connection directory, but I found no user-confirmed working connection.

So "just pay $99.99/yr for Monarch" doesn't actually buy what you described. Empower is free with excellent investment analytics but is US-only (needs a US ZIP + SSN, no Canadian institutions, no real partner login). Copilot is US-only too. YNAB has no investment tracking and flaky Canadian sync.

**The off-the-shelf option that genuinely fits is Lunch Money** ($40–150/yr pay-what-you-want): true multi-currency with historical FX, unlimited partner sharing, Plaid for US and Canadian banks, and SnapTrade as its default provider for Fidelity, Robinhood, Questrade, and Wealthsimple — your exact brokerage list. Its weaknesses: investment tracking is balance-oriented rather than holdings-deep, it's a solo-developer product, and there is no 90/10 engine or AI investment assistant and never will be.

## Why building is more feasible than it used to be

The historical dealbreaker for DIY was bank connectivity — enterprise contracts, sales calls, per-connection minimums. That changed:

- **Plaid** now has a free Trial plan (new US/Canada teams since April 15, 2026): up to 10 production Items with real data, including Transactions and Investments. Your two TD relationships fit easily, and both TD US and TD Canada Trust connect via an official TD–Plaid data-access agreement (OAuth, no screen scraping).
- **SnapTrade** has a free tier for personal use — 1 connected user, up to 5 brokerage connections — covering Robinhood, Wealthsimple, Questrade, and Fidelity (the latter two need a quick partner application to enable). Paid fallback is $1–2/month per connected user.
- **Questrade** is the rare institution with an official free personal API you can hit directly.
- **Fidelity** is the awkward one everywhere (it blocks screen scraping and routes access through Akoya; Plaid gates it behind higher tiers) — SnapTrade read-only or CSV import is the path.
- **Your 401(k)s** will be manual/CSV in any tool, bought or built — unknown-provider 401(k)s are the worst-connected account type in the industry.

So the realistic running cost of the custom app is **$0/yr in aggregator fees** (free tiers cover your account count) **plus ~$0–20/month hosting and LLM API usage** — against $99.99/yr for a Monarch that gets your net worth wrong, or ~$40–150/yr for Lunch Money without the investment features you asked for.

## The honest counter-case (read before committing)

- **You become the maintainer.** Bank connections break, OAuth tokens expire, aggregators change terms (Plaid's Trial plan is only months old; SnapTrade repriced within the last year). Expect an hour or two some months just keeping sync healthy. Buying means someone else carries that pager.
- **Free tiers have edges.** SnapTrade's free plan is one connected user and five connections — fine today, but it means modeling your household as one SnapTrade user, and growth past five brokerage connections starts costing (trivial) money.
- **Nancy has to like it.** A commercial app arrives polished and mobile-ready. The prompt holds the custom build to that same bar, but it's a bar that takes real iteration to clear.
- **If what you actually want is 95% budgeting** and you'd be content tracking investments as balances, Lunch Money at ~$40–150/yr is the pragmatic no-code answer, and trying it for a month first is cheap insurance either way.

## On the investment bot — recalibrated to reality

Three findings from the research that reshaped this part of your idea, and how the prompt handles them:

1. **Your cashback is better than you thought.** The Robinhood Gold Card earns **3%** when redeemed into the brokerage (not 2% — that's the ~2.1% statement-credit rate). The app's cashback tracker uses the real redemption math.
2. **An advisor, not a trader.** Robinhood did just launch "Agentic Trading" (May 2026, beta) — official MCP servers that let an AI agent trade equities in a walled-off account. Tempting, but the failure evidence for autonomous LLM trading is consistent (hallucinated facts flowing into real orders, concentration, loss-chasing; the best-known real-money experiment is a cautionary tale), and "self-improving" trading agents are a documented safety anti-pattern (they game the P&L metric). So the app's assistant researches, recommends with cited sources, keeps a permanent track record it must confront, and learns your preferences — but a human always places the trade. That's also legally clean: a bot advising only your own household needs no registration.
3. **The 90/10 split is the right call and the data says keep the 10 honest.** 79% of active large-cap funds lagged the S&P 500 in 2025; ~92% of domestic funds lag over 20 years; ~4% of stocks account for all net US market wealth creation since 1926. The 90% ETF sleeve needs no intelligence at all — a deterministic schedule beats cleverness — and the 10% sleeve is capped entertainment money, which the app enforces as a hard ceiling the assistant refuses to breach.

## Bottom line

| | Monarch | Lunch Money | Build (PROMPT.md) |
|---|---|---|---|
| Cost/yr | $99.99 | $40–150 | ~$0 aggregators + hosting/LLM |
| USD+CAD net worth | **Wrong by design** | Correct | Correct (hard-tested) |
| Your 7 institutions | Most, Questrade unconfirmed | All (Plaid + SnapTrade) | All (Plaid + SnapTrade + Questrade API + CSV) |
| Couple sharing | Excellent | Excellent | Built for exactly two |
| 90/10 engine + AI analyst | No | No | Yes — the point |
| Maintenance | Theirs | Theirs | **Yours** |

You asked "if we can't do what Monarch does, should I just pay for Monarch?" — the surprise is the reverse: Monarch can't do what *you* need. Build it (hand `PROMPT.md` to the agent as-is), and if you want a safety net, run a Lunch Money trial in parallel for the first month so you're never without a working tool.

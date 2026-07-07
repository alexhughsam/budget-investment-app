# Budget & Investment App — Kickoff Docs

Planning documents for a shared US+Canada household finance app for Alex and Nancy.

- **[PROMPT.md](PROMPT.md)** — the build prompt, written as a retiring lead engineer's complete handoff. Hand this to a coding agent verbatim to build the entire app: mission, account list, verified connectivity decisions (Plaid + SnapTrade + Questrade API + CSV), house rules, a hard definition of done, working process (plan → loop → fresh-context adversarial verification), the 90/10 investment assistant spec, and explicit anti-scope.
- **[BUILD-VS-BUY.md](BUILD-VS-BUY.md)** — the analysis of whether to build this or just pay for Monarch Money. Verdict: build (Monarch doesn't convert CAD/USD, which breaks this household's net worth by design; DIY connectivity is now nearly free). Includes the honest counter-case and a Lunch Money fallback.

Research basis: 14 web-research and adversarial-verification agents, July 2026. Vendor pricing and aggregator terms move fast — re-verify the pricing pages cited in BUILD-VS-BUY.md before wiring anything up.

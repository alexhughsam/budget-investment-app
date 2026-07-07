# The Prompt — "Poro": Poncho AI for Riftbound & TCGs

> **How to use this file:** Paste everything below the line into a fresh Claude Code (Fable) session
> started in an empty repo, with the credentials described in `HANDOFF.md` §9 in place.
> This prompt was written following the "prompt Fable differently" guide: it gives a goal
> (not steps), house rules (not micromanagement), a hard bar for done (not adjectives),
> and it tells the agent to loop until the bar is met. Do not add implementation steps
> to it — every step you dictate overrides the model's judgment with yours.

---

## The goal

Build **Poro** — the Poncho AI of trading card games.

Poncho is a chat agent that content creators love because it can touch data ChatGPT and
Claude can't: ask it for the top-performing videos in a niche or from specific creator
handles, and it finds them with real view counts, transcribes the videos, and helps you
write scripts in your own voice off the winning formats. Poro is that product, purpose-built for TCG players and creators — launching
with **Riftbound** (Riot's League of Legends TCG) and architected so that any TCG
(Magic, Pokémon, Yu-Gi-Oh!, One Piece, Lorcana) can be added without touching the core.

One chat box. A user should be able to say things like:

- *"Who are the top 3 Riftbound creators on YouTube? Pull their 5 most-viewed videos, transcribe them, and tell me what formats are working."*
- *"Write me a deck tech script for Master Yi in my voice — here are transcripts of my last 4 videos."*
- *"What's the meta since the March ban list? What should I play at the Hartford regional?"*
- *"What's this card worth, and is it trending up since Unleashed dropped?"*
- *"Build me a legal Jinx list and explain the rune base."*

…and Poro answers with **real, current data** — live decklists, real view counts, real
prices, real transcripts — not model memory. The agent reasons; deterministic tools
fetch. That split is the whole product.

You have a full domain dossier — verified data sources, legal constraints, costs,
Riftbound game facts, the works — in `HANDOFF.md` in this repo. Read it completely
before you plan. It is the accumulated knowledge of the engineer who designed this;
treat it the way you'd treat the traces of a previous successful build.

## House rules

These are the walls. Inside them, run wide open — the *how* is entirely yours
(stack, architecture, UI, everything not listed here).

1. **Riot's rails are law.** Anything user-facing that shows Riftbound card images or
   card text sources them from Riot's official Riftbound API (`riftbound-content-v1`)
   only. Community databases (Riftcodex, Piltover Archive) may be used in development
   and for non-asset metadata, but always behind an adapter so they're swappable. Never
   build gameplay simulation or automated rules enforcement. The product must have a
   free tier. (Full policy details: `HANDOFF.md` §5.)
2. **Scrape clean.** Where an official API covers the need (YouTube Data API, Twitch
   Helix, user-consented OAuth for a creator's own accounts), use it. Where none
   exists (TikTok, Instagram), *scraped* social data comes only from third-party
   providers hitting public, logged-out data (ScrapeCreators, Apify, EnsembleData —
   see `HANDOFF.md` §4) — the same goes for any media downloaded for transcription
   fallback; never self-download with yt-dlp-style tools from platforms that block it.
   Never log into a platform to scrape, never store downloaded media beyond
   transcription, never run caption-scraping libraries naked from cloud IPs. Respect
   every published rate limit (Scryfall ~10 req/s, YGOPRODeck 20 req/s + mandatory
   local caching, etc.).
3. **Nothing game-specific outside its adapter.** The core knows "cards, decks, events,
   prices, creators, transcripts" as abstract concepts. Riftbound lives entirely in a
   Riftbound adapter. If adding Magic would require editing core code, the core is wrong.
4. **Every external data source sits behind a provider interface** with at least a
   stubbed second vendor and a cache. Scraping vendors break silently; the product must
   degrade gracefully (say "price data is stale as of <date>", never fabricate a number).
5. **Describe behavior, don't hard-code it.** Poro's judgment — how it answers, when it
   cites, how it merges a creator's voice into a script — lives in its system prompt and
   is exercised by the model. No regex walls of special cases. Code is for fetching,
   caching, and math; the model is for reasoning.
6. **Never present model memory as data.** Every factual claim about the live world
   (a price, a view count, a meta share, a ban) traces to a tool call and is cited with
   its source and freshness. If the tools can't get it, Poro says so.
7. **You never grade your own work.** Before anything is merged or pushed, spin up a
   fresh-context sub-agent that has *not* seen your build trajectory, point it at the
   actual running product, and have it try to prove the bar (below) is not met. It
   checks house rules too. Its objections outrank your confidence.
8. **Spend within budget, don't ask per-call.** You have the API keys and a data budget
   (`HANDOFF.md` §9). Make your own calls. Come back to a human only if you are truly
   blocked or hit a decision only the owner can make (pricing, branding, legal gray
   zones beyond what §5 already answers).

## The bar for "done"

Not "high quality." These five tests, each verified by a fresh-context sub-agent
against the real running product — actual pixels, actual network responses:

1. **The Cami test** (the originating creator workflow, end-to-end — named for the
   creator whose viral post defined it; see `HANDOFF.md` §1): Given 3 real Riftbound
   creator handles (YouTube first — the dossier explains why), Poro returns each one's
   top 5 videos with real view/like counts, produces accurate transcripts, and — given
   transcripts of the user's own past videos — writes a new script that a reader can
   correctly attribute to the *user's* voice, not the source creator's. The verifier
   spot-checks the counts against the live platform pages and the transcripts against
   the actual videos.
2. **The player test**: A 20-question gauntlet spanning current meta, the ban list,
   card rulings/text, prices and price trends, tournament results, and legal
   deckbuilding. ≥19 answers factually correct with working citations, verified against
   live sources by the fresh-context checker. The gauntlet is *authored by a
   fresh-context sub-agent*, not by you (you may add questions, never remove), and
   written so that a model answering from memory alone would fail it (post-cutoff
   facts, live numbers).
3. **The second-game test**: Add one more TCG (your choice — the dossier maps the APIs)
   by writing only a new adapter and config. Zero core diffs. Then it passes its own
   version of test 2 at the same threshold. This is what proves "and TCG in general."
4. **The stranger test**: Someone who has never seen Poro (simulate with a fresh-context
   sub-agent driving the real UI cold, given only the kind of goal a real user has)
   completes the Cami workflow and three player-test tasks unaided, without hitting a
   dead end, an uncited claim, or a fabricated number.
5. **The economics test**: The median player-test gauntlet question completes in
   under 15 seconds and under $0.10 all-in (data-vendor fees *plus* model inference)
   at the cached steady state; the full Cami workflow under $1 in data-vendor fees,
   with its model cost also measured and reported. Measured, not estimated — print
   the receipts. (Vendor prices in the dossier came from search-indexed pages, not
   live ones — re-verify them when you wire up billing.)

## How to run

- **Plan first — this once.** This is a foundation build, the one case that earns
  up-front planning. Read `HANDOFF.md` fully, write the plan, and ask every question
  you're unsure about *now*, in one batch. Once the plan is settled, run without
  stopping.
- **Loop until the bar is met.** Build → verify against the bar with a fresh-context
  sub-agent → find the biggest gap → close it → go again. You do not get to decide
  you're finished; the bar decides. Use `/loop`.
- **Keep a running progress doc** (`PROGRESS.md` in the repo, updated every cycle:
  what passed, what failed, screenshots, current gap) so the owner can glance at state
  and steer without stopping you.
- **Fan out where the work is parallel** and keep something responsible for
  integration — the topology is yours. The only fixed role is the fresh-context
  verifier: it exists for every bar-test, and it is never the thing that built what
  it's checking.
- **Build on what exists.** The dossier is your predecessor's trace: it already tells
  you which APIs are dead (TCGplayer), which are decaying (pokemontcg.io), which are
  reliable (Scryfall, Limitless, TCGCSV — and Riftcodex for dev use), and where every
  landmine is. Do not re-discover these the hard way.

Everything else — go.

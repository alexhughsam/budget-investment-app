# HANDOFF.md — Poro, from the retiring lead

I'm retiring. This document is everything in my head about Poro: the vision, the
verified facts, the decisions and *why* I made them, the traps, and the exact order
I'd build in. You will never get to ask me a question, so I've tried to answer the
ones you'd ask. Read all of it before you write a line of code. The build prompt that
drives the work is `PROMPT.md`, sitting next to this file — this document is the
dossier that prompt depends on.

Everything factual below was verified against live sources in early July 2026.
Sources are cited inline; things I could *not* verify are flagged. When this doc and
the live world disagree, the live world wins — re-verify before relying on anything
load-bearing.

---

## 1. The vision

**Poro is the Poncho AI of trading card games.**

Poncho (tryponcho.com, built by Merit Systems) won content creators over by being a
chat agent that can touch live data ChatGPT and Claude can't: pay-per-use tools for
social media data, transcription, and more, invoked from plain English. The canonical
creator workflow — the one in the screenshot that started this project — is: give it
creator handles → it finds their top posts by views/likes → transcribes the videos →
helps you merge the winning script structures with your own voice and experience.
Full-time creators call it their most-used tool precisely because it fills the
"data that isn't available to Claude/ChatGPT" gap.

Nobody has built that for TCGs. Meanwhile:

- **Riftbound** (Riot's League of Legends TCG, launched Oct 31 2025) is commercially
  exploding — TCGplayer listings went from 68.6K to 585K+ in its first month, ~6,300
  searches/hour at launch (gosugamers.net, icv2.com) — while its content-creator
  niche is embryonic: the *official* TikTok account has only ~12.6K followers. A
  fast-growing game with an under-served creator scene is exactly where a
  content-research tool mints new creators.
- TCG data in general is fragmented across dozens of community sites with no unified
  interface. Players ask the same questions every day (what's the meta, what's this
  worth, is this legal, what should I play) and answer them by hand across 5 tabs.

Poro is one chat box that serves both loops:

- **The creator loop** (Poncho's workflow, TCG-flavored): find what's working in TCG
  content, get transcripts, write scripts in *your* voice, spot content gaps
  ("nobody has covered the new ban list on YouTube yet — here's a script").
- **The player loop**: live meta, decklists, prices, card lookup, rules, tournament
  results, deckbuilding help — answered with real data and citations.

The two loops share everything: the creator loop's "what's working" is powered by the
same meta/price/event data the player loop serves, and the player loop's answers are
the raw material creators turn into content.

**What Poro is NOT** (as important as what it is):

- Not a game client, simulator, or rules engine. Riot explicitly won't approve
  automated rules enforcement or gameplay simulation (§5), and it's a tar pit anyway.
- Not a deck database trying to out-Moxfield Moxfield. We *consume* those sites; we
  don't compete with them.
- Not a general social-media tool with a TCG skin. The moat is TCG domain depth: the
  agent knows what a rune base is, what "conquer" means, why the March bans mattered.
- Not model-memory trivia. If the tools can't fetch it, Poro says so. An agent that
  fabricates a card price dies by its first screenshot on r/Riftbound.

## 2. The one decision that matters most

**Agent-first architecture: a reasoning model with thin, deterministic data tools.**

Everything I believe about this product follows from one split: *code fetches, the
model reasons.* The tools are dumb, cacheable, testable functions ("get top videos
for channel", "get card by name", "get price history", "get transcript", "get meta
decklists"). All judgment — which tools to call, how to synthesize, how to imitate a
user's voice, when to caveat freshness — lives in the agent's system prompt and the
model's reasoning.

Why: every TCG tool that came before Poro hard-coded its intelligence (tier-list
algorithms, matchup tables, template scripts) and went stale the day the meta shifted.
A prompt describing *behavior* survives set releases, ban lists, and new games. When
you're tempted to write code that decides something, write a sentence in the system
prompt instead. (This is house rule #5 in `PROMPT.md`; it's the hill I'd die on.)

Model note: build on the newest Claude models (Fable 5 / `claude-fable-5` tier for
the agent; a cheaper tier is fine for bulk transcript summarization). Prompt caching
matters — the system prompt + tool schemas will be large.

## 3. Domain dossier — Riftbound (verified July 2026)

You need this to write the agent's system prompt, the eval gauntlet, and the
Riftbound adapter. All verified against the cited sources.

**The game** (Riot Games + UVS Games; physical TCG; CN launch Aug 2025, EN worldwide
Oct 31 2025; wiki.leagueoflegends.com, riftdaily.com):

- Six **Domains** (colors) in opposing pairs: Fury (red, aggro/discard), Calm (green,
  control), Mind (blue, planning), Body (orange, ramp), Chaos (purple, recursion),
  Order (yellow, go-wide/rally).
- Six card types: **Legend, Unit, Spell, Gear, Battlefield, Rune**.
- Constructed deck = 1 Legend + exactly 40-card main deck (incl. Chosen Champion, max
  3 copies per card) + exactly 12 runes + 3 uniquely-named battlefields; all cards
  must match the Legend's two domains (playriftbound.com deckbuilding primer).
- Win at **8 victory points** from Conquering/Holding battlefields (11 in 2v2); the
  final point must come from holding/conquering all battlefields in the same turn, or
  win by exhausting both opposing battlefields in 1v1. Formats: 1v1, 2v2, FFA.

**Sets** (set codes verified for first three only, via riftboundsymbols.com):

| Set | Code | EN release | Notes |
|---|---|---|---|
| Origins | OGN | Oct 31 2025 | 298 main cards (377 w/ variants); champions incl. Jinx, Yasuo, Teemo, Viktor, Lee Sin; Proving Grounds 4-deck box (Master Yi, Garen, Lux, Annie) |
| Spiritforged | SFD | Feb 13 2026 | 221 new cards; adds Equipment, gold tokens, Repeat spells; Azir, Irelia, Draven, Fiora, Jax, Ornn… |
| Unleashed | UNL | May 8 2026 | ~219 cards; jungle theme: XP resource, Hunt keyword, Level scaling; Kha'Zix, Lillia, Diana, Ivern; new Ultimate rarity |
| Vendetta | ? | Jul 31 2026 | First unified CN/US release; Akali, Mel, Ambessa. **Lands ~3 weeks after this handoff — day-one coverage is a launch marketing moment.** |
| Radiance | ? | Oct 23 2026 | 180-card pool + 60+ Showcase; Ekko, Seraphine, Evelynn |

**Ban list** (first ever, effective Mar 31 2026; playriftbound.com): Called Shot,
Scrapheap, Fight or Flight, plus battlefields Reaver's Row, Dreaming Tree, Obelisk of
Power. No restricted list — Riot bans outright. Standard rotation begins 2028 with
Set 10. *The agent must know current bans cold; it's the most-asked legality question.*

**Meta as I leave** (July 2026; riftdecks.com, hextechanalytics.com): led by Master
Yi (~10% share), Irelia, Diana. This will be stale by the time you read it — the
point is the *sources*, not the snapshot.

**Organized play**: store events → open Regional Qualifiers (2026: Lille, Atlanta,
Houston, Vancouver, Utrecht Jul 12–14, Hartford Jul 19–21, Las Vegas…) → invite-only
Regional Championships → first Worlds planned 2027. Runs on the Riftbound Gaming
Network (locator.riftbound.uvsgames.com), powered by **Carde.io**, linked to Riot
accounts. Third-party sanctioned: Showdown Series, Le Rift Tour.

**No official digital client** exists; game director Dave Guskin: digital is "not if,
but when" (pcgamesn.com). Community plays via Tabletop Simulator mods and TCG Arena.
When Riot ships digital, Poro's data layer should be positioned to consume it — but
do not build gameplay features (§5).

**Creators** (thin, growing — this is the opportunity): Twitch: JohnPanio, imls,
LotharHS (follower figures from aggregators, treat with caution). YouTube/mainstream:
Becca Scott (Good Time Society). Competitive/paid guides: Alanzq, Dhawally on Metafy.
Directory: riftbound.zone/en/creator. Riot runs 2026 Creator Activations (content
kits per set, paid contracts, planned Creator Discord) — Poro helping creators
capitalize on those kits is a natural hook. I could not verify the subreddit's size
(Reddit blocks crawlers); assume r/Riftbound exists and check manually.

## 4. Data source map

The heart of the product. Every row = a provider module behind the abstraction layer
(house rule #4). "Trust" is my judgment of how likely it still works in 12 months.

### 4a. Riftbound card data

| Source | Access | Trust | Notes |
|---|---|---|---|
| **Riot Riftbound API** (`riftbound-content-v1`, developer.riotgames.com/docs/riftbound) | API key from Riot Developer Portal (basic dev key auto-issued on login; production needs app registration/approval) | High (official) | Card id/name/rarity/set/artwork URLs/cost/might/power. **The only legal asset source for a monetized app (§5).** Docs 403'd to my crawlers — verified via snippets + the `equinox` Go client (pkg.go.dev/github.com/Kyagara/equinox). Verify endpoints by hand first thing. |
| **Riftcodex** (riftcodex.com; api.riftcodex.com) | Open REST, JSON, no auth | Medium (community) | `/cards`, `/sets` (lookup by set/TCGplayer/Cardmarket ID), `/indexes`. Tracks current sets (Unleashed confirmed in changelog). Dev/prototyping + ID-crosswalk use; not an asset source for prod. |
| **Piltover Archive** (piltoverarchive.com) | Site; no public API found | Medium | Leading community DB/deckbuilder (fan-made by STGMNN Labs under Riot's Legal Jibber Jabber policy — *not* official). Carde.io decklist-submission integration. Partner candidate, not a dependency. |

### 4b. Riftbound meta / decklists / events

| Source | Access | Notes |
|---|---|---|
| **riftDecks.com** | Scrape (no API found) | 70K+ decks, top decks by event. Primary meta source. |
| **hextechanalytics.com/meta**, **riftmeta.gg**, **riftbound.gg/tier-list**, **mobalytics.gg/riftbound** | Scrape | Cross-check + tier lists. |
| **riftools.app** | Scrape | Tournament decklist search. |
| **runesandrift.com** | Scrape | Event coverage. |
| **Carde.io** (event network backend) | Investigate | If a partnership or feed exists, it's the highest-quality event data. Nothing public found — worth one email. |

None of these have documented APIs — build polite scrapers (identify yourself in the
UA, cache aggressively, back off on errors) and treat each as replaceable. For other
games, **Limitless TCG** (docs.limitlesstcg.com/developer.html) is the model citizen:
a real documented API (key via user settings) for tournaments/standings/decklists —
use it for Pokémon/One Piece adapters, and watch whether it adds Riftbound.

### 4c. Prices

| Source | Access | Notes |
|---|---|---|
| **TCGplayer** | **API closed since late 2024** — no new keys, no waitlist | Do NOT plan around getting access. It's the canonical US price source, reached indirectly: |
| **TCGCSV.com** | Free daily CSV/JSON republication of TCGplayer categories/products/prices | The workhorse. Ingest daily, store your own history — price *trend* data is something you can only accumulate, which quietly becomes a moat. |
| **Cardmarket** | API closed to new applicants (existing users migrating to apiv2 by May 1 2026) | EU prices. Same story as TCGplayer. |
| **JustTCG / tcgfast / TCGAPIs / PriceCharting** | Paid APIs, various | Gap-fillers; PriceCharting covers graded/sealed. Pick one as secondary vendor when revenue justifies it. |
| Community trackers (riftboundstats.com/market, magicalmeta.ink/riftbound — hourly refresh, riftbound.cardprices.io) | Scrape | Cross-checks; magicalmeta already covers Origins→Radiance. |

### 4d. Creators & social (the Poncho layer)

**Strategy: YouTube-first.** It's the only platform whose *official* API supports
"arbitrary handle → top posts" — and it's where Riftbound's real content lives today.
TikTok/IG are architecturally ready but behind vendors.

| Platform | Path | Detail |
|---|---|---|
| **YouTube** | Official Data API v3 | Handle → channel (`channels.list`, 1 unit) → uploads playlist (`playlistItems.list`, 1 unit/page) + `videos.list` (1 unit) for viewCount/likeCount, sort client-side. **Avoid `search.list` (100 units) except for discovery.** Default quota 10,000 units/day; extensions require Google's audit form — **file it early, it's a manual weeks-long process.** |
| YouTube transcripts | Paid transcript API (Supadata — 100 free credits/mo, AI fallback; or TranscriptAPI) | `captions.download` needs the video *owner's* OAuth — useless for other people's videos. The unofficial timedtext route (youtube-transcript-api) is blocked from cloud IPs (PoToken bot detection); needs residential proxies. Just pay the vendor. |
| **TikTok** | Vendor only: **ScrapeCreators** (primary; ~$10/5,000 credits ≈ $2/1k requests, prepaid, dedicated TikTok transcript endpoint), Apify (clockworks actor ~$1.70/1k results) or EnsembleData as standby | Official Display API only covers OAuth'd users' own videos; Research API is academics-only, 1k req/day, commercial use banned. There is no official path — everyone uses vendors. TikTok captions come as WebVTT tracks the vendors just fetch. |
| **Instagram** | Same vendors | Official `business_discovery` only reads public Business/Creator accounts (~200 calls/hr) and view metrics have been unstable since Meta's April 2025 "views" migration. ScrapeCreators' IG transcript endpoint works under ~2-minute videos. Most hostile platform — ship it last. |
| **Twitch** | Official Helix API | Standard OAuth; fine for "who's streaming Riftbound." |
| Fallback STT | Whisper API ($0.006/min) / Deepgram Nova-3 (~$0.0043/min) / Groq Whisper Turbo (~$0.0006/min) | For videos with no caption track. A 60-second short costs well under a cent. Getting the *media* is the hard part, not the STT. |

### 4e. Other games (for the second-game test and beyond)

| Game | Card data | Meta/events | Watch out |
|---|---|---|---|
| MTG | **Scryfall** (free, ~10 req/s, free bulk downloads, WotC Fan Content Policy, forbids paywalling its data) + MTGJSON (MIT, bulk + 90-day prices) | Melee.gg (Swagger docs), mtgtop8/mtgdecks.net, Topdeck.gg (free API, 100 req/min, powers edhtop16) | Moxfield has NO public API and Cloudflare-blocks scrapers — don't fight it. Untapped.gg/17Lands parse Arena's Player.log; fragile, avoid depending on it. |
| Pokémon | **TCGdex** (free, open-source, no key, prices included) — NOT pokemontcg.io (absorbed by Scrydex, ~45% error rates observed) | **Limitless API** (documented, key by request), RK9→pokedata.ovh→pokestats.live/Trainer Hill | |
| Yu-Gi-Oh! | YGOPRODeck v7 (free, 20 req/s, **ToS requires local caching** — violators IP-banned 1hr) | yugiohmeta.com, yugiohtopdecks.com | |
| One Piece | apitcg.com / optcgapi.com (volunteer) | onepiece.limitlesstcg.com, gumgum.gg | Unofficial DBs, uncertain longevity. |
| Lorcana | Lorcast (Scryfall-style, v0 beta), LorcanaJSON | dreamborn.ink, inkdecks.com | Same. |
| Cross-game paid | **Scrydex** (Pokémon/MTG/Lorcana/YGO, credit tiers, graded-card data) | | The "one vendor" option when revenue justifies it. |

**I'd pick Magic as the second game** — Scryfall is the best card API in existence and
the verifier can check against the healthiest ecosystem. Pokémon via TCGdex+Limitless
is the close runner-up.

## 5. Legal rails — non-negotiable

These aren't my preferences; they're the conditions under which this product is
allowed to exist. Violating them is how Poro gets a cease-and-desist instead of users.

1. **Riot Riftbound policy** (developer.riotgames.com/policies/riftbound — verified
   via search index, pages 403 to crawlers; *re-read the live page before launch*):
   - Apps need a Riot Developer Portal API key; monetized products must be registered
     with **Approved** status.
   - Apps may use **only Riftbound assets provided via the Riot API** — card images
     from community scrapes are fine on your laptop, illegal in the product.
   - Must display official English card text (own translations only alongside).
   - **No automated rules enforcement / gameplay simulation** for the tabletop game —
     Riot is not approving these. No betting/gambling features, ever.
   - If you charge, the product must be **"transformative"** and must offer a **free
     tier**. Poro-as-content-research-agent is comfortably transformative (it makes
     new things *about* the game, it doesn't replicate the game) — a lawyer should
     bless the final pricing page anyway.
   - *Unresolved by me*: whether reselling Riot-API card data through a paid x402
     endpoint (§8, phase 4) fits these terms. Get written clarity from Riot before
     doing that specifically.
2. **Social scraping posture**: public, logged-out data via third-party providers
   only. *Meta v. Bright Data* (N.D. Cal., Jan 23 2024) held Meta's terms bind only
   logged-in scraping — logged-out public scraping is the industry's defensible
   pattern. Never scrape from a logged-in session; never bypass access controls;
   don't retain downloaded media beyond transcription. Platform ToS still nominally
   prohibit scraping — the vendor absorbs that risk, which is part of what you pay for.
3. **Per-API terms that bite**: Scryfall forbids paywalling its data (keep any paid
   Poro features clearly about *Poro's synthesis*, not raw Scryfall data); YGOPRODeck
   *requires* you to cache locally rather than hammer the API; WotC Fan Content
   Policy governs MTG imagery.
4. **User-provided credentials** (if a creator connects their own accounts for
   analytics): official OAuth (YouTube/TikTok Display/IG Graph) only — their own data
   through their own consent is exactly what those APIs are for.

## 6. Architecture

I deliberately did not write code. Prescribing a stack from the grave is how handoffs
rot — and per the build philosophy (`PROMPT.md`), the builder's judgment on the *how*
is better than my guesses. What I am prescribing is the shape, because the shape *is*
the vision:

```
┌─ Chat UI (web-first; simple; the agent is the product, not the chrome)
├─ Agent core: system prompt (Poro's brain — biggest file in the repo,
│   treat as code: versioned, reviewed, eval-gated) + tool registry
├─ Tool layer: thin deterministic tools, generic vocabulary
│   (cards.search, decks.top, prices.history, creators.top_posts,
│    videos.transcript, events.results, ...)
├─ Game adapters: riftbound/, mtg/, ... — each maps the generic tool
│   vocabulary onto its game's sources. ALL game specificity lives here.
├─ Provider layer: per-source modules w/ interface + fallback + health
│   checks (a dead scraper flips a health flag, agent discloses staleness)
├─ Cache/store: cards + daily prices (accumulate history from day one —
│   it becomes the moat), transcripts (they're expensive; never re-fetch),
│   creator snapshots. Everything timestamped; agent always knows data age.
└─ Voice profiles: per-user store of their transcripts/writing; injected
    as context when scripting. It's context engineering, not fine-tuning.
```

Decisions I've already made and why (don't relitigate without new facts):

- **Chat-first, not dashboard-first.** Poncho's lesson: the chat box *is* the
  product; dashboards are what incumbents (Mobalytics, riftbound.gg) already do.
- **Generic core + adapters** (house rule #3): the second-game test exists to keep
  this honest. The TCG world's biggest structural gap (per research) is that every
  tool is single-game; the cross-game architecture is the long-term differentiator.
- **Accumulate history**: TCGCSV gives you *today's* prices; nobody hands you a year
  of hourly history. Start the cron on day one.
- **Voice = context, not training**: the "merge with your own voice" feature is
  retrieval of the user's own transcripts + prompt engineering. Poncho does the same
  (it's ordinary LLM work atop fetched transcripts, not a named feature).

## 7. Cost model (steady state, verified vendor pricing)

- Creator lookup (TikTok/IG profile, ~100 posts): $0.05–$0.20 via ScrapeCreators-style
  per-request pricing. YouTube equivalent: ~free (a few quota units).
- Transcript: ~1 vendor credit (~$0.002) for caption-track fetch; <$0.01 STT fallback.
- Card/meta/price queries: ~$0 marginal (cached community/official sources).
- Model calls: dominant marginal cost — cache the system prompt, use cheap tiers for
  bulk summarization.
- Full Cami workflow (3 creators × 5 videos, transcripts, script): well under $1 in
  data fees. That's the economics test in `PROMPT.md`, and it's why per-query
  micro-costs never justify a "should I?" interruption (house rule #8).

## 8. Build order

Each phase ends at `PROMPT.md`'s bar-tests, fresh-context-verified — no calendar
estimates from me; the loop decides pace.

- **Phase 0 — Foundation** (this is the one place the "ultracode/plan-first"
  exception applies): agent core + tool registry + provider abstraction + cache +
  eval harness (the 20-question gauntlet *runs in CI*; the system prompt is
  eval-gated). Get the skeleton right; everything after is adapters.
- **Phase 1 — Riftbound player loop**: Riot API + Riftcodex crosswalk, riftDecks/
  hextech meta ingestion, TCGCSV prices + history cron, ban-list/rules knowledge.
  Bar: player test (≥19/20).
- **Phase 2 — Creator loop**: YouTube pipeline (quota-frugal pattern §4d, file the
  quota-extension form at phase start), transcript vendor, voice profiles, script
  generation. TikTok/IG behind the same interface, enabled when vendor accounts are
  funded. Bar: Cami test + stranger test.
- **Phase 3 — Second game (Magic)**: adapter-only. Bar: second-game test with zero
  core diffs.
- **Phase 4 — Distribution** (optional, revisit against the market): publish Poro's
  data tools as x402-protected paid endpoints indexed by AgentCash — Poncho's own
  agent (and any x402 agent) would then discover and pay for *our* TCG tools
  (median observed x402 endpoint price $0.028/call, 997K+ paid calls through
  AgentCash as of Apr 2026; agentcash.dev). Poro becomes both a product *and* the
  TCG data layer of the agentic web. Requires the Riot resale clarification (§5.1).
  There's also an open-source harness in the same family (github.com/cesr/poncho-ai,
  MIT, AGENT.md + skills/ conventions) if you want a self-hostable agent shell
  instead of building the chat plumbing yourself — evaluate, don't assume.

**Launch timing gift**: Vendetta releases July 31 2026 and Worlds is 2027. Day-one
Vendetta coverage ("ask Poro anything about the new set") is the marketing moment;
work backward from it if you can.

## 9. Keys, accounts, budgets

Set up before starting (the build prompt assumes these exist as env vars; none are
checked into this repo):

| What | Where | Note |
|---|---|---|
| Anthropic API key | console.anthropic.com | The agent itself. |
| Riot Developer Portal account + Riftbound key | developer.riotgames.com | Basic key auto-issued on login; register the app for production/Approved status early — approval is the longest legal pole. |
| YouTube Data API key | Google Cloud console | File quota-extension audit form at Phase 2 start. |
| ScrapeCreators account, prepaid credits | scrapecreators.com | Primary social vendor. ~$10/5k credits. |
| Apify account | apify.com | Standby vendor (free tier: $5 credits/mo). |
| Supadata (or TranscriptAPI) | supadata.ai | YouTube transcripts. 100 free credits/mo. |
| Twitch app credentials | dev.twitch.tv | Helix API. |
| **Data budget** | — | $200/mo development ceiling across all vendors. The agent spends freely inside it and reports spend in `PROGRESS.md`; it asks a human only to raise the ceiling. |

## 10. Risks and what I'd already decided to do about them

| Risk | Reality | Mitigation (already in the house rules) |
|---|---|---|
| Scraping vendors break silently | Certainty, not risk — endpoints churn when platforms change | Provider abstraction + standby vendor + health checks + honest staleness disclosure |
| Riot policy/approval friction | Docs 403 to crawlers; terms verified only via snippets | Re-read live policy first; register early; keep community assets out of prod builds from day one so there's nothing to unwind |
| Community sites (riftDecks, hextech) die or block us | Medium — young sites, no APIs | Multiple meta sources per adapter; polite scraping; partnership emails cost nothing (Piltover Archive, Carde.io) |
| Riftbound TikTok corpus too thin for the demo | Confirmed thin (official account ~12.6K followers) | YouTube-first strategy (§4d); TikTok pipeline ships dark, flips on as the corpus grows — and "TCG in general" (MTG/Pokémon TikTok is huge) carries the creator loop meanwhile |
| pokemontcg.io decay / TCGplayer closure | Already happened | TCGdex + TCGCSV chosen instead; both free |
| Riot ships an official digital client | "Not if, but when" | Good for us — more data, more players; we're transformative content tooling, not a client competitor |
| Model answers from stale memory | The trap for *every* LLM product in this space | House rules #6 (cite or say so) + gauntlet questions deliberately post-cutoff |

## 11. What I'd tell you over the retirement beer

- The system prompt is the product. Budget as much iteration for it as for all the
  code. Never edit it without running the gauntlet.
- Don't build the deck builder first. Everyone builds the deck builder first. The
  chat agent that *answers the question behind the deck* is the product.
- The price-history cron is the most boring and most valuable thing in the repo.
  Every day it runs is a day no competitor can buy back.
- When a scraper breaks at 2 a.m., the agent saying "price data is 14 hours stale"
  is a feature. Users forgive staleness; they never forgive confident fabrication.
- The Cami test is the demo. When it passes, record it end-to-end in one take —
  that recording is the launch post.
- I named it Poro after the little Freljord creature every League player instinctively
  trusts. If you rename it, keep the property: friendly, small, unexpectedly capable.

## 12. Source appendix (primary references)

Poncho/Merit: tryponcho.com, tryponcho.com/tools, poncho.merit.systems,
agentcash.dev, github.com/cesr/poncho-ai, @camiinthisthang on X (the originating
workflow). Riftbound official: playriftbound.com (card gallery, rules hub, bans,
organized play), developer.riotgames.com/docs/riftbound + /policies/riftbound,
locator.riftbound.uvsgames.com, riftbound.leagueoflegends.com (creator activations).
Riftbound community: riftcodex.com, piltoverarchive.com, riftdecks.com,
hextechanalytics.com, riftmeta.gg, riftbound.gg, riftools.app, runesandrift.com,
riftboundstats.com, magicalmeta.ink/riftbound, riftbound.zone. TCG general:
scryfall.com/docs/api, mtgjson.com, tcgdex.dev, docs.limitlesstcg.com/developer.html,
ygoprodeck.com/api-guide, tcgcsv.com, topdeck.gg/docs, melee.gg/swagger, lorcast.com,
dreamborn.ink, gumgum.gg, scrydex.com. Social/creator data:
developers.google.com/youtube/v3, scrapecreators.com, apify.com, ensembledata.com,
supadata.ai, developers.tiktok.com (Research API restrictions),
developers.facebook.com (business_discovery), Meta v. Bright Data coverage
(techcrunch.com, fbm.com). Commercial signals: gosugamers.net, icv2.com (Riftbound
launch demand).

---

That's everything. The vision fits in one sentence — *one chat box that knows more
about your card game, live, than any human could hold in their head, and helps you
play it and make things about it* — and the rest of this file exists so you never
have to guess what I meant by it. Build well.

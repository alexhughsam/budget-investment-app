import { db, schema } from "./db";
import { and, desc, eq } from "drizzle-orm";
import { todayISO, type Currency } from "./money";
import { randomUUID } from "node:crypto";

export type FxResult = {
  rate: number; // multiply base-cents by this to get quote-cents
  date: string;
  source: string;
  stale: boolean; // true when we could not get today's rate and are using the last known one
};

// Seed rate used only when the app has never successfully fetched and has no stored rate.
// Marked stale + clearly labeled in the UI. Never presented as current.
// Defined as USD→CAD; the inverse direction is derived, never assumed.
const SEED_USD_TO_CAD = { rate: 1.37, date: "2026-07-01", source: "seed (approximate)" };

async function fetchDaily(base: Currency, quote: Currency): Promise<{ rate: number; date: string; source: string } | null> {
  const attempts: Array<() => Promise<{ rate: number; date: string; source: string } | null>> = [
    async () => {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
      const rate = data.rates?.[quote];
      return rate && rate > 0 ? { rate, date: data.date ?? todayISO(), source: "frankfurter.app (ECB)" } : null;
    },
    async () => {
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = (await res.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.[quote];
      return rate && rate > 0 ? { rate, date: todayISO(), source: "open.er-api.com" } : null;
    },
  ];
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result) return result;
    } catch {
      // fall through to next source
    }
  }
  return null;
}

export async function getRate(base: Currency, quote: Currency): Promise<FxResult> {
  if (base === quote) return { rate: 1, date: todayISO(), source: "identity", stale: false };
  const today = todayISO();

  const existing = db
    .select()
    .from(schema.fxRates)
    .where(and(eq(schema.fxRates.base, base), eq(schema.fxRates.quote, quote)))
    .orderBy(desc(schema.fxRates.date))
    .limit(1)
    .all()[0];

  // Fresh enough: fetched today
  if (existing && existing.date === today) {
    return { rate: existing.rate, date: existing.date, source: existing.source, stale: false };
  }

  const fetched = await fetchDaily(base, quote);
  if (fetched) {
    db.insert(schema.fxRates)
      .values({
        id: randomUUID(),
        date: today,
        base,
        quote,
        rate: fetched.rate,
        source: fetched.source,
        fetchedAt: Date.now(),
      })
      .onConflictDoNothing()
      .run();
    return { rate: fetched.rate, date: fetched.date, source: fetched.source, stale: false };
  }

  if (existing) {
    return { rate: existing.rate, date: existing.date, source: existing.source, stale: true };
  }
  const seedRate = base === "USD" ? SEED_USD_TO_CAD.rate : 1 / SEED_USD_TO_CAD.rate;
  return { rate: seedRate, date: SEED_USD_TO_CAD.date, source: SEED_USD_TO_CAD.source, stale: true };
}

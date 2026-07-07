// The 90/10 engine is deterministic code, not AI (PROMPT.md §7).
// All amounts integer cents.

export type EtfTarget = { symbol: string; weightPct: number };

export type SplitInstruction = {
  etfCents: number;
  pickCents: number; // hard-capped
  pickCapPct: number;
  etfLines: Array<{ symbol: string; cents: number }>;
};

// Split investable cash: pick sleeve gets at most pickCapPct (default 10),
// funded first from cashback; everything else goes to the ETF plan.
export function computeSplit(input: {
  investableCents: number;
  cashbackAvailableCents: number;
  pickCapPct: number;
  etfTargets: EtfTarget[];
}): SplitInstruction {
  const { investableCents, cashbackAvailableCents, etfTargets } = input;
  const pickCapPct = Math.min(Math.max(input.pickCapPct, 0), 10); // never above 10 — house rule
  if (!Number.isInteger(investableCents) || !Number.isInteger(cashbackAvailableCents)) {
    throw new Error("computeSplit requires integer cents");
  }
  const total = Math.max(investableCents, 0);
  const capCents = Math.floor((total * pickCapPct) / 100);
  const pickCents = Math.min(Math.max(cashbackAvailableCents, 0), capCents);
  const etfCents = total - pickCents;

  // Allocate ETF bucket by weights using largest-remainder so the lines sum exactly.
  const weights = etfTargets.filter((t) => t.weightPct > 0);
  const weightSum = weights.reduce((a, t) => a + t.weightPct, 0);
  let etfLines: Array<{ symbol: string; cents: number }> = [];
  if (weightSum > 0 && etfCents > 0) {
    const raw = weights.map((t) => ({ symbol: t.symbol, exact: (etfCents * t.weightPct) / weightSum }));
    const floors = raw.map((r) => ({ symbol: r.symbol, cents: Math.floor(r.exact), frac: r.exact - Math.floor(r.exact) }));
    let remainder = etfCents - floors.reduce((a, f) => a + f.cents, 0);
    floors.sort((a, b) => b.frac - a.frac);
    for (const f of floors) {
      if (remainder <= 0) break;
      f.cents += 1;
      remainder -= 1;
    }
    etfLines = floors
      .map(({ symbol, cents }) => ({ symbol, cents }))
      .filter((l) => l.cents > 0)
      .sort((a, b) => b.cents - a.cents);
  }
  return { etfCents, pickCents, pickCapPct, etfLines };
}

// Robinhood Gold Card rewards (verified July 2026): 3% of spend when points are
// redeemed into the brokerage account; ~2.1% as statement credit.
export const CASHBACK_BROKERAGE_RATE_BP = 300; // basis points
export const CASHBACK_STATEMENT_RATE_BP = 210;

export function cashbackEarnedCents(spendCents: number, mode: "brokerage" | "statement" = "brokerage"): number {
  if (!Number.isInteger(spendCents) || spendCents < 0) throw new Error("spendCents must be a non-negative integer");
  const bp = mode === "brokerage" ? CASHBACK_BROKERAGE_RATE_BP : CASHBACK_STATEMENT_RATE_BP;
  return Math.floor((spendCents * bp) / 10000);
}

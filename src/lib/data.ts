import { db, schema } from "./db";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { getRate, type FxResult } from "./fx";
import { convertCents, monthOf, sumCents, todayISO, type Currency } from "./money";

export type AccountWithBalance = typeof schema.accounts.$inferSelect & {
  balanceCents: number | null;
  balanceAsOf: string | null;
  balanceStale: boolean;
};

const STALE_DAYS = 7;

function isStale(asOf: string | null): boolean {
  if (!asOf) return true;
  const ageMs = Date.now() - new Date(`${asOf}T00:00:00Z`).getTime();
  return ageMs > STALE_DAYS * 24 * 3600 * 1000;
}

export function getAccounts(householdId: string): AccountWithBalance[] {
  const accounts = db
    .select()
    .from(schema.accounts)
    .where(and(eq(schema.accounts.householdId, householdId), isNull(schema.accounts.archivedAt)))
    .all();
  return accounts.map((a) => {
    const latest = db
      .select()
      .from(schema.balanceSnapshots)
      .where(eq(schema.balanceSnapshots.accountId, a.id))
      .orderBy(desc(schema.balanceSnapshots.asOf))
      .limit(1)
      .all()[0];
    return {
      ...a,
      balanceCents: latest?.amountCents ?? null,
      balanceAsOf: latest?.asOf ?? null,
      balanceStale: isStale(latest?.asOf ?? null),
    };
  });
}

export type NetWorth = {
  totalCents: number;
  displayCurrency: Currency;
  fx: FxResult;
  byCurrency: Record<Currency, number>; // native totals, no conversion
  anyStale: boolean;
  missingCount: number; // accounts with no balance at all
};

export async function getNetWorth(householdId: string, displayCurrency: Currency): Promise<NetWorth> {
  const accounts = getAccounts(householdId);
  const byCurrency: Record<Currency, number> = { USD: 0, CAD: 0 };
  let anyStale = false;
  let missingCount = 0;
  for (const a of accounts) {
    if (a.balanceCents === null) {
      missingCount++;
      continue;
    }
    // Credit accounts hold debt: stored balances are what you owe, so subtract.
    const signed = a.type === "credit" ? -Math.abs(a.balanceCents) : a.balanceCents;
    byCurrency[a.currency] += signed;
    if (a.balanceStale) anyStale = true;
  }
  const other: Currency = displayCurrency === "USD" ? "CAD" : "USD";
  const fx = await getRate(other, displayCurrency);
  const totalCents = byCurrency[displayCurrency] + convertCents(byCurrency[other], fx.rate);
  return { totalCents, displayCurrency, fx, byCurrency, anyStale, missingCount };
}

export type NetWorthPoint = { date: string; totalCents: number };

// Net-worth history: for each snapshot date, carry the latest-known balance
// forward per account, convert with the display-currency FX rate.
export async function getNetWorthHistory(householdId: string, displayCurrency: Currency, days = 180): Promise<NetWorthPoint[]> {
  const accounts = getAccounts(householdId);
  if (accounts.length === 0) return [];
  const ids = accounts.map((a) => a.id);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const snaps = db
    .select()
    .from(schema.balanceSnapshots)
    .where(and(inArray(schema.balanceSnapshots.accountId, ids), gte(schema.balanceSnapshots.asOf, since)))
    .orderBy(schema.balanceSnapshots.asOf)
    .all();
  if (snaps.length === 0) return [];

  const other: Currency = displayCurrency === "USD" ? "CAD" : "USD";
  const fx = await getRate(other, displayCurrency);
  const meta = new Map(accounts.map((a) => [a.id, a]));
  const dates = [...new Set(snaps.map((s) => s.asOf))].sort();
  const latestPerAccount = new Map<string, number>();

  // Seed with any balances older than the window so lines don't start at zero.
  const priorRows = db
    .select({
      accountId: schema.balanceSnapshots.accountId,
      amountCents: schema.balanceSnapshots.amountCents,
      asOf: sql<string>`max(${schema.balanceSnapshots.asOf})`,
    })
    .from(schema.balanceSnapshots)
    .where(and(inArray(schema.balanceSnapshots.accountId, ids), lte(schema.balanceSnapshots.asOf, since)))
    .groupBy(schema.balanceSnapshots.accountId)
    .all();
  for (const row of priorRows) latestPerAccount.set(row.accountId, row.amountCents);

  const points: NetWorthPoint[] = [];
  for (const date of dates) {
    for (const s of snaps.filter((x) => x.asOf === date)) latestPerAccount.set(s.accountId, s.amountCents);
    let total = 0;
    for (const [accountId, cents] of latestPerAccount) {
      const a = meta.get(accountId);
      if (!a) continue;
      const signed = a.type === "credit" ? -Math.abs(cents) : cents;
      total += a.currency === displayCurrency ? signed : convertCents(signed, fx.rate);
    }
    points.push({ date, totalCents: total });
  }
  return points;
}

export function getCategories(householdId: string) {
  return db.select().from(schema.categories).where(eq(schema.categories.householdId, householdId)).orderBy(schema.categories.name).all();
}

export type TxnRow = typeof schema.transactions.$inferSelect & {
  accountName: string;
  accountCurrency: Currency;
  categoryName: string | null;
};

export function getTransactions(householdId: string, opts?: { month?: string; accountId?: string; limit?: number }): TxnRow[] {
  const accounts = getAccounts(householdId);
  const ids = opts?.accountId ? [opts.accountId] : accounts.map((a) => a.id);
  if (ids.length === 0) return [];
  const conditions = [inArray(schema.transactions.accountId, ids)];
  if (opts?.month) {
    conditions.push(gte(schema.transactions.date, `${opts.month}-01`), lte(schema.transactions.date, `${opts.month}-31`));
  }
  const rows = db
    .select()
    .from(schema.transactions)
    .where(and(...conditions))
    .orderBy(desc(schema.transactions.date), desc(schema.transactions.createdAt))
    .limit(opts?.limit ?? 500)
    .all();
  const acctMap = new Map(accounts.map((a) => [a.id, a]));
  const cats = new Map(getCategories(householdId).map((c) => [c.id, c.name]));
  return rows.map((t) => ({
    ...t,
    accountName: acctMap.get(t.accountId)?.name ?? "?",
    accountCurrency: (acctMap.get(t.accountId)?.currency ?? "USD") as Currency,
    categoryName: t.categoryId ? (cats.get(t.categoryId) ?? null) : null,
  }));
}

export type BudgetLine = {
  categoryId: string;
  categoryName: string;
  kind: string;
  budgetCents: number | null;
  actualCents: number; // display currency, expenses positive
};

export async function getBudgetView(householdId: string, month: string, displayCurrency: Currency) {
  const categories = getCategories(householdId);
  const budgets = db
    .select()
    .from(schema.budgets)
    .where(and(eq(schema.budgets.householdId, householdId), eq(schema.budgets.month, month)))
    .all();
  const txns = getTransactions(householdId, { month, limit: 10000 });
  const other: Currency = displayCurrency === "USD" ? "CAD" : "USD";
  const fx = await getRate(other, displayCurrency);

  const lines: BudgetLine[] = categories
    .filter((c) => c.kind === "expense")
    .map((c) => {
      const spentNative = txns.filter((t) => t.categoryId === c.id && t.amountCents < 0);
      const actualCents = sumCents(
        spentNative.map((t) => {
          const abs = -t.amountCents;
          return t.accountCurrency === displayCurrency ? abs : convertCents(abs, fx.rate);
        }),
      );
      const budget = budgets.find((b) => b.categoryId === c.id);
      return { categoryId: c.id, categoryName: c.name, kind: c.kind, budgetCents: budget?.amountCents ?? null, actualCents };
    })
    .sort((a, b) => b.actualCents - a.actualCents);

  const uncategorized = txns.filter((t) => !t.categoryId && t.amountCents < 0);
  const uncategorizedCents = sumCents(
    uncategorized.map((t) => (t.accountCurrency === displayCurrency ? -t.amountCents : convertCents(-t.amountCents, fx.rate))),
  );
  const income = txns.filter((t) => {
    const cat = categories.find((c) => c.id === t.categoryId);
    return t.amountCents > 0 && cat?.kind !== "transfer" && cat?.kind !== "investment";
  });
  const incomeCents = sumCents(
    income.map((t) => (t.accountCurrency === displayCurrency ? t.amountCents : convertCents(t.amountCents, fx.rate))),
  );
  return { lines, uncategorizedCents, uncategorizedCount: uncategorized.length, incomeCents, fx };
}

export function getHousehold(householdId: string) {
  return db.select().from(schema.households).where(eq(schema.households.id, householdId)).all()[0];
}

export function getMembers(householdId: string) {
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.householdMembers.role })
    .from(schema.householdMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.householdMembers.userId))
    .where(eq(schema.householdMembers.householdId, householdId))
    .all();
}

export function getInvestmentSettings(householdId: string) {
  const existing = db.select().from(schema.investmentSettings).where(eq(schema.investmentSettings.householdId, householdId)).all()[0];
  return (
    existing ?? {
      householdId,
      etfTargetsJson: JSON.stringify([{ symbol: "VTI", weightPct: 70 }, { symbol: "VXUS", weightPct: 30 }]),
      pickBudgetPctCap: 10,
      etfAccountId: null,
      pickAccountId: null,
    }
  );
}

export function getCashback(householdId: string) {
  return db
    .select()
    .from(schema.cashbackEntries)
    .where(eq(schema.cashbackEntries.householdId, householdId))
    .orderBy(desc(schema.cashbackEntries.month))
    .all();
}

export function getRecommendations(householdId: string) {
  return db
    .select()
    .from(schema.recommendations)
    .where(eq(schema.recommendations.householdId, householdId))
    .orderBy(desc(schema.recommendations.createdAt))
    .all();
}

export function getConnections(householdId: string) {
  return db.select().from(schema.syncConnections).where(eq(schema.syncConnections.householdId, householdId)).all();
}

export function getHoldings(householdId: string, accountId?: string) {
  const accounts = getAccounts(householdId);
  const ids = accountId ? [accountId] : accounts.map((a) => a.id);
  if (ids.length === 0) return [];
  return db.select().from(schema.holdings).where(inArray(schema.holdings.accountId, ids)).all();
}

export function currentMonth(): string {
  return monthOf(todayISO());
}

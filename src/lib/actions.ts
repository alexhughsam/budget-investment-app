"use server";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "./db";
import { getSession, requireUser } from "./auth";
import { dedupeHash, headerSignature, mapRow, type ColumnMapping } from "./csv";
import { aiAvailable, categorizeTransactions, writeAdvisorMemo } from "./ai";
import { getAccounts, getCashback, getCategories, getInvestmentSettings, getRecommendations, getTransactions } from "./data";
import { parseAmountToCents, todayISO, formatCents, type Currency } from "./money";
import { cashbackEarnedCents, computeSplit, type EtfTarget } from "./invest";
import { runSync } from "./sync";

export type ActionResult = { ok: boolean; message: string };

const DEFAULT_CATEGORIES: Array<{ name: string; kind: "expense" | "income" | "transfer" | "investment"; icon: string }> = [
  { name: "Groceries", kind: "expense", icon: "cart" },
  { name: "Restaurants", kind: "expense", icon: "fork" },
  { name: "Housing", kind: "expense", icon: "home" },
  { name: "Utilities & Phone", kind: "expense", icon: "bolt" },
  { name: "Transport", kind: "expense", icon: "car" },
  { name: "Travel", kind: "expense", icon: "plane" },
  { name: "Health", kind: "expense", icon: "heart" },
  { name: "Shopping", kind: "expense", icon: "bag" },
  { name: "Entertainment", kind: "expense", icon: "film" },
  { name: "Subscriptions", kind: "expense", icon: "repeat" },
  { name: "Fees", kind: "expense", icon: "receipt" },
  { name: "Uncategorized", kind: "expense", icon: "tag" },
  { name: "Salary", kind: "income", icon: "coins" },
  { name: "Other Income", kind: "income", icon: "coins" },
  { name: "Transfers", kind: "transfer", icon: "swap" },
  { name: "Investments", kind: "investment", icon: "chart" },
];

// ---------- Auth ----------

export async function signUp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      name: z.string().min(1).max(80),
      email: z.string().email(),
      password: z.string().min(8, "Password must be at least 8 characters"),
      householdName: z.string().min(1).max(80),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { name, email, password, householdName } = parsed.data;

  if (db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).all()[0]) {
    return { ok: false, message: "An account with that email already exists" };
  }
  const now = Date.now();
  const userId = randomUUID();
  const householdId = randomUUID();
  const inviteCode = randomUUID().slice(0, 8).toUpperCase();
  db.insert(schema.users).values({ id: userId, email: email.toLowerCase(), name, passwordHash: bcrypt.hashSync(password, 10), createdAt: now }).run();
  db.insert(schema.households).values({ id: householdId, name: householdName, inviteCode, displayCurrency: "USD", createdAt: now }).run();
  db.insert(schema.householdMembers).values({ householdId, userId, role: "owner" }).run();
  db.insert(schema.categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ id: randomUUID(), householdId, ...c })))
    .run();

  const session = await getSession();
  session.userId = userId;
  session.householdId = householdId;
  await session.save();
  redirect("/");
}

export async function joinHousehold(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      name: z.string().min(1).max(80),
      email: z.string().email(),
      password: z.string().min(8, "Password must be at least 8 characters"),
      inviteCode: z.string().min(4),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { name, email, password, inviteCode } = parsed.data;

  const household = db.select().from(schema.households).where(eq(schema.households.inviteCode, inviteCode.trim().toUpperCase())).all()[0];
  if (!household) return { ok: false, message: "Invite code not found — check it with your partner" };
  if (db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).all()[0]) {
    return { ok: false, message: "An account with that email already exists" };
  }
  const now = Date.now();
  const userId = randomUUID();
  db.insert(schema.users).values({ id: userId, email: email.toLowerCase(), name, passwordHash: bcrypt.hashSync(password, 10), createdAt: now }).run();
  db.insert(schema.householdMembers).values({ householdId: household.id, userId, role: "member" }).run();

  const session = await getSession();
  session.userId = userId;
  session.householdId = household.id;
  await session.save();
  redirect("/");
}

export async function logIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).all()[0];
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return { ok: false, message: "Email or password is incorrect" };
  }
  const membership = db.select().from(schema.householdMembers).where(eq(schema.householdMembers.userId, user.id)).all()[0];
  if (!membership) return { ok: false, message: "This account has no household" };
  const session = await getSession();
  session.userId = user.id;
  session.householdId = membership.householdId;
  await session.save();
  redirect("/");
}

export async function logOut(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

// ---------- Accounts & balances ----------

export async function createAccount(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireUser();
  const parsed = z
    .object({
      name: z.string().min(1).max(80),
      institution: z.string().min(1).max(80),
      country: z.enum(["US", "CA"]),
      type: z.enum(["checking", "savings", "credit", "brokerage", "retirement"]),
      currency: z.enum(["USD", "CAD"]),
      openingBalance: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const now = Date.now();
  const id = randomUUID();
  db.insert(schema.accounts)
    .values({ id, householdId, ownerUserId: null, ...parsed.data, connectionSource: "manual", createdAt: now, archivedAt: null })
    .run();
  const opening = parsed.data.openingBalance?.trim();
  if (opening) {
    let cents: number;
    try {
      cents = parseAmountToCents(opening);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Bad amount" };
    }
    db.insert(schema.balanceSnapshots)
      .values({ id: randomUUID(), accountId: id, asOf: todayISO(), amountCents: cents, source: "manual", createdAt: now })
      .run();
  }
  revalidatePath("/", "layout");
  redirect(`/accounts/${id}`);
}

export async function updateBalance(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireUser();
  const accountId = String(formData.get("accountId"));
  const asOf = String(formData.get("asOf") || todayISO());
  const account = db.select().from(schema.accounts).where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.householdId, householdId))).all()[0];
  if (!account) return { ok: false, message: "Account not found" };
  let cents: number;
  try {
    cents = parseAmountToCents(String(formData.get("amount") ?? ""));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bad amount" };
  }
  db.insert(schema.balanceSnapshots)
    .values({ id: randomUUID(), accountId, asOf, amountCents: cents, source: "manual", createdAt: Date.now() })
    .onConflictDoUpdate({ target: [schema.balanceSnapshots.accountId, schema.balanceSnapshots.asOf], set: { amountCents: cents, source: "manual" } })
    .run();
  revalidatePath("/", "layout");
  return { ok: true, message: `Balance recorded: ${formatCents(cents, account.currency as Currency)} as of ${asOf}` };
}

export async function archiveAccount(formData: FormData): Promise<void> {
  const { householdId } = await requireUser();
  const accountId = String(formData.get("accountId"));
  // Reversible, not destructive (house rule 6): archived accounts hide from views but keep all data.
  db.update(schema.accounts)
    .set({ archivedAt: Date.now() })
    .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.householdId, householdId)))
    .run();
  revalidatePath("/", "layout");
  redirect("/accounts");
}

export async function addTransaction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireUser();
  const accountId = String(formData.get("accountId"));
  const account = db.select().from(schema.accounts).where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.householdId, householdId))).all()[0];
  if (!account) return { ok: false, message: "Account not found" };
  const description = String(formData.get("description") ?? "").trim();
  const date = String(formData.get("date") || todayISO());
  if (!description) return { ok: false, message: "Description is required" };
  let cents: number;
  try {
    cents = parseAmountToCents(String(formData.get("amount") ?? ""));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bad amount" };
  }
  if (String(formData.get("direction")) === "out" && cents > 0) cents = -cents;
  const row = { date, description, amountCents: cents };
  const res = db
    .insert(schema.transactions)
    .values({
      id: randomUUID(),
      accountId,
      ...row,
      merchant: null,
      categoryId: (formData.get("categoryId") as string) || null,
      categorySource: formData.get("categoryId") ? "user" : "none",
      importId: null,
      dedupeHash: dedupeHash(row),
      notes: null,
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();
  revalidatePath("/", "layout");
  return res.changes > 0
    ? { ok: true, message: "Transaction added" }
    : { ok: false, message: "That looks like a duplicate of an existing transaction — nothing added" };
}

export async function setTransactionCategory(formData: FormData): Promise<void> {
  const { householdId } = await requireUser();
  const txnId = String(formData.get("transactionId"));
  const categoryId = String(formData.get("categoryId")) || null;
  const accountIds = getAccounts(householdId).map((a) => a.id);
  if (accountIds.length > 0) {
    db.update(schema.transactions)
      .set({ categoryId, categorySource: "user" })
      .where(and(eq(schema.transactions.id, txnId), inArray(schema.transactions.accountId, accountIds)))
      .run();
  }
  revalidatePath("/", "layout");
}

// ---------- CSV import ----------

const importSchema = z.object({
  accountId: z.string(),
  filename: z.string(),
  headers: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.string())),
  mapping: z.object({
    date: z.string(),
    description: z.string(),
    amount: z.string().optional().default(""),
    debit: z.string().optional(),
    credit: z.string().optional(),
    dateFormat: z.enum(["YMD", "MDY", "DMY"]),
    flipSign: z.boolean(),
  }),
});

export async function importCsv(payload: unknown): Promise<ActionResult & { imported?: number; dupes?: number; failed?: number }> {
  const { householdId } = await requireUser();
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Import payload was invalid" };
  const { accountId, filename, headers, rows, mapping } = parsed.data;
  const account = db.select().from(schema.accounts).where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.householdId, householdId))).all()[0];
  if (!account) return { ok: false, message: "Account not found" };
  if (rows.length === 0) return { ok: false, message: "No rows found in that file" };
  if (rows.length > 20000) return { ok: false, message: "File too large (max 20,000 rows)" };

  const importId = randomUUID();
  const now = Date.now();
  let imported = 0;
  let dupes = 0;
  let failed = 0;
  for (const raw of rows) {
    let mapped;
    try {
      mapped = mapRow(raw, mapping as ColumnMapping);
    } catch {
      failed++;
      continue;
    }
    if (!mapped) {
      failed++;
      continue;
    }
    const res = db
      .insert(schema.transactions)
      .values({
        id: randomUUID(),
        accountId,
        date: mapped.date,
        description: mapped.description,
        merchant: null,
        amountCents: mapped.amountCents,
        categoryId: null,
        categorySource: "none",
        importId,
        dedupeHash: dedupeHash(mapped),
        notes: null,
        createdAt: now,
      })
      .onConflictDoNothing()
      .run();
    if (res.changes > 0) imported++;
    else dupes++;
  }

  db.insert(schema.imports)
    .values({ id: importId, accountId, filename, mappingJson: JSON.stringify(mapping), rowCount: rows.length, importedCount: imported, dupeCount: dupes, createdAt: now })
    .run();
  // Remember this institution's format for next time.
  db.insert(schema.importMappings)
    .values({ id: randomUUID(), householdId, headerSignature: headerSignature(headers), mappingJson: JSON.stringify(mapping), updatedAt: now })
    .onConflictDoUpdate({
      target: [schema.importMappings.householdId, schema.importMappings.headerSignature],
      set: { mappingJson: JSON.stringify(mapping), updatedAt: now },
    })
    .run();
  revalidatePath("/", "layout");
  return {
    ok: true,
    imported,
    dupes,
    failed,
    message: `Imported ${imported} transaction(s); ${dupes} duplicate(s) skipped${failed ? `; ${failed} row(s) could not be parsed` : ""}`,
  };
}

export async function findSavedMapping(headers: string[]): Promise<ColumnMapping | null> {
  const { householdId } = await requireUser();
  const row = db
    .select()
    .from(schema.importMappings)
    .where(and(eq(schema.importMappings.householdId, householdId), eq(schema.importMappings.headerSignature, headerSignature(headers))))
    .all()[0];
  return row ? (JSON.parse(row.mappingJson) as ColumnMapping) : null;
}

// ---------- AI categorization ----------

export async function categorizeUncategorized(_prev?: ActionResult | null, _formData?: FormData): Promise<ActionResult> {
  const { householdId } = await requireUser();
  if (!aiAvailable()) {
    return { ok: false, message: "AI categorization is not configured — set ANTHROPIC_API_KEY on the server to enable it" };
  }
  const txns = getTransactions(householdId, { limit: 5000 }).filter((t) => !t.categoryId);
  if (txns.length === 0) return { ok: true, message: "Nothing to categorize — every transaction has a category" };
  const batch = txns.slice(0, 200);
  const categories = getCategories(householdId);
  const suggestions = await categorizeTransactions(
    batch.map((t) => ({ id: t.id, description: t.description, amountCents: t.amountCents, date: t.date })),
    categories.map((c) => c.name),
  );
  const byName = new Map(categories.map((c) => [c.name, c.id]));
  let applied = 0;
  for (const s of suggestions) {
    const categoryId = byName.get(s.category);
    if (!categoryId) continue;
    db.update(schema.transactions)
      .set({ categoryId, categorySource: "ai", merchant: s.merchant ?? null })
      .where(eq(schema.transactions.id, s.transactionId))
      .run();
    applied++;
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `Categorized ${applied} of ${batch.length} transaction(s)${txns.length > 200 ? " (run again for the rest)" : ""}` };
}

// ---------- Budgets ----------

export async function setBudget(formData: FormData): Promise<void> {
  const { householdId } = await requireUser();
  const categoryId = String(formData.get("categoryId"));
  const month = String(formData.get("month"));
  const raw = String(formData.get("amount") ?? "").trim();
  if (!raw) {
    db.delete(schema.budgets)
      .where(and(eq(schema.budgets.householdId, householdId), eq(schema.budgets.categoryId, categoryId), eq(schema.budgets.month, month)))
      .run();
  } else {
    let cents: number;
    try {
      cents = Math.abs(parseAmountToCents(raw));
    } catch {
      return;
    }
    db.insert(schema.budgets)
      .values({ id: randomUUID(), householdId, categoryId, month, amountCents: cents, currency: "USD" })
      .onConflictDoUpdate({ target: [schema.budgets.householdId, schema.budgets.categoryId, schema.budgets.month], set: { amountCents: cents } })
      .run();
  }
  revalidatePath("/budget");
}

// ---------- Investments ----------

export async function saveInvestmentSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireUser();
  const targetsRaw = String(formData.get("etfTargets") ?? "");
  const targets: EtfTarget[] = [];
  for (const line of targetsRaw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^([A-Za-z.\-]{1,10})\s+(\d{1,3})%?$/);
    if (!m) return { ok: false, message: `Could not parse ETF line: "${t}" (use e.g. "VTI 70")` };
    targets.push({ symbol: m[1].toUpperCase(), weightPct: Number(m[2]) });
  }
  const sum = targets.reduce((a, t) => a + t.weightPct, 0);
  if (targets.length > 0 && sum !== 100) return { ok: false, message: `ETF weights must sum to 100 (currently ${sum})` };
  db.insert(schema.investmentSettings)
    .values({ householdId, etfTargetsJson: JSON.stringify(targets), pickBudgetPctCap: 10, etfAccountId: null, pickAccountId: null })
    .onConflictDoUpdate({ target: [schema.investmentSettings.householdId], set: { etfTargetsJson: JSON.stringify(targets) } })
    .run();
  revalidatePath("/invest");
  return { ok: true, message: "Investment plan saved" };
}

export async function recordCashbackSpend(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireUser();
  const month = String(formData.get("month"));
  let spendCents: number;
  try {
    spendCents = Math.abs(parseAmountToCents(String(formData.get("spend") ?? "")));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bad amount" };
  }
  db.insert(schema.cashbackEntries)
    .values({ id: randomUUID(), householdId, month, spendCents, redeemedCents: 0 })
    .onConflictDoUpdate({ target: [schema.cashbackEntries.householdId, schema.cashbackEntries.month], set: { spendCents } })
    .run();
  revalidatePath("/invest");
  return { ok: true, message: `Recorded ${formatCents(spendCents, "USD")} of Gold Card spend for ${month} → earns ${formatCents(cashbackEarnedCents(spendCents), "USD")} at 3% brokerage redemption` };
}

export async function requestMemo(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireUser();
  if (!aiAvailable()) {
    return { ok: false, message: "The advisor is not configured — set ANTHROPIC_API_KEY on the server to enable it" };
  }
  const kind = formData.get("kind") === "allocation" ? "allocation" : "pick";
  const investableRaw = String(formData.get("investable") ?? "").trim();
  let investableCents = 0;
  if (investableRaw) {
    try {
      investableCents = Math.abs(parseAmountToCents(investableRaw));
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Bad amount" };
    }
  }
  const settings = getInvestmentSettings(householdId);
  const targets = JSON.parse(settings.etfTargetsJson) as EtfTarget[];
  const cashback = getCashback(householdId);
  const cashbackAvailable = cashback.reduce((a, c) => a + cashbackEarnedCents(c.spendCents) - c.redeemedCents, 0);
  const split = computeSplit({ investableCents, cashbackAvailableCents: cashbackAvailable, pickCapPct: settings.pickBudgetPctCap, etfTargets: targets });
  const holdingsList = getAccounts(householdId)
    .filter((a) => a.type === "brokerage" || a.type === "retirement")
    .map((a) => `- ${a.name} (${a.institution}, ${a.currency}): ${a.balanceCents !== null ? formatCents(a.balanceCents, a.currency as Currency) : "no balance recorded"}`)
    .join("\n");
  const past = getRecommendations(householdId)
    .slice(0, 10)
    .map((r) => `- [${r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "?"}] (${r.status}) ${r.title}${r.outcomeNote ? ` — outcome: ${r.outcomeNote}` : ""}`)
    .join("\n");

  const memo = await writeAdvisorMemo({
    kind,
    contextMarkdown:
      `Investable cash this month: ${formatCents(investableCents, "USD")}\n` +
      `90/10 split (deterministic engine): ETF bucket ${formatCents(split.etfCents, "USD")}, pick budget ${formatCents(split.pickCents, "USD")} (cap ${split.pickCapPct}%)\n` +
      `ETF plan: ${targets.map((t) => `${t.symbol} ${t.weightPct}%`).join(", ") || "not set"}\n` +
      `Accrued unredeemed cashback: ${formatCents(cashbackAvailable, "USD")}\n` +
      `Investment accounts:\n${holdingsList || "(none)"}`,
    pickBudgetCents: split.pickCents,
    currency: "USD",
    pastMemosSummary: past,
  });
  if (!memo) return { ok: false, message: "The advisor could not produce a memo this time — try again" };
  db.insert(schema.recommendations)
    .values({ id: randomUUID(), householdId, kind, title: memo.title, body: memo.body, dataJson: JSON.stringify({ split }), status: "open", decidedAt: null, outcomeNote: null, createdAt: Date.now() })
    .run();
  revalidatePath("/invest");
  return { ok: true, message: "Memo ready — it's at the top of the log" };
}

export async function decideRecommendation(formData: FormData): Promise<void> {
  const { householdId } = await requireUser();
  const id = String(formData.get("id"));
  const status = formData.get("status") === "accepted" ? "accepted" : "declined";
  const note = String(formData.get("note") ?? "").trim() || null;
  // Status transitions only — the memo body is immutable (house rule 4).
  db.update(schema.recommendations)
    .set({ status, decidedAt: Date.now(), outcomeNote: note })
    .where(and(eq(schema.recommendations.id, id), eq(schema.recommendations.householdId, householdId)))
    .run();
  revalidatePath("/invest");
}

// ---------- Settings & sync ----------

export async function setDisplayCurrency(formData: FormData): Promise<void> {
  const { householdId } = await requireUser();
  const currency = formData.get("currency") === "CAD" ? "CAD" : "USD";
  db.update(schema.households).set({ displayCurrency: currency }).where(eq(schema.households.id, householdId)).run();
  revalidatePath("/", "layout");
}

export async function triggerSync(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireUser();
  const provider = String(formData.get("provider"));
  const result = await runSync(householdId, provider);
  revalidatePath("/", "layout");
  return result;
}

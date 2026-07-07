import { db, schema } from "../db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { dedupeHash } from "../csv";
import { mockAdapter } from "./mock";
import { EMPTY_RESULT, type SyncAdapter, type SyncResult } from "./types";

// Real-provider stubs: they implement the same contract and report exactly why
// they're not live yet. Wiring them up = filling in sync() with the provider
// SDK; nothing else in the app changes.

const plaidAdapter: SyncAdapter = {
  id: "plaid",
  displayName: "Plaid (TD Bank US, TD Canada Trust)",
  probe() {
    const configured = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
    return {
      configured,
      detail: configured
        ? "Credentials present — adapter implementation pending"
        : "Set PLAID_CLIENT_ID and PLAID_SECRET (free Trial plan covers 10 connections)",
    };
  },
  async sync(): Promise<SyncResult> {
    return { ok: false, error: "Plaid adapter not implemented yet — use CSV import meanwhile", ...EMPTY_RESULT };
  },
};

const snaptradeAdapter: SyncAdapter = {
  id: "snaptrade",
  displayName: "SnapTrade (Robinhood, Wealthsimple, Questrade, Fidelity)",
  probe() {
    const configured = Boolean(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY);
    return {
      configured,
      detail: configured
        ? "Credentials present — adapter implementation pending"
        : "Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY (free personal tier: 1 user, 5 connections)",
    };
  },
  async sync(): Promise<SyncResult> {
    return { ok: false, error: "SnapTrade adapter not implemented yet — use CSV import meanwhile", ...EMPTY_RESULT };
  },
};

const questradeAdapter: SyncAdapter = {
  id: "questrade",
  displayName: "Questrade (official personal API)",
  probe() {
    const configured = Boolean(process.env.QUESTRADE_REFRESH_TOKEN);
    return {
      configured,
      detail: configured
        ? "Token present — adapter implementation pending"
        : "Set QUESTRADE_REFRESH_TOKEN from api.questrade.com (free personal API)",
    };
  },
  async sync(): Promise<SyncResult> {
    return { ok: false, error: "Questrade adapter not implemented yet — use CSV import meanwhile", ...EMPTY_RESULT };
  },
};

export const adapters: SyncAdapter[] = [mockAdapter, plaidAdapter, snaptradeAdapter, questradeAdapter];

// Run one adapter and persist its output through the same normalized pipeline
// CSV/manual use. Returns a human-readable summary for the connections UI.
export async function runSync(householdId: string, adapterId: string): Promise<{ ok: boolean; message: string }> {
  const adapter = adapters.find((a) => a.id === adapterId);
  if (!adapter) return { ok: false, message: "Unknown provider" };

  const now = Date.now();
  let result: SyncResult;
  try {
    result = await adapter.sync();
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : "Sync failed", ...EMPTY_RESULT };
  }

  const status = !result.ok ? "error" : result.staleAsOf ? "stale" : "ok";
  db.insert(schema.syncConnections)
    .values({ id: randomUUID(), householdId, provider: adapter.id, status, lastSyncAt: now, error: result.error ?? null })
    .onConflictDoUpdate({
      target: [schema.syncConnections.householdId, schema.syncConnections.provider],
      set: { status, lastSyncAt: now, error: result.error ?? null },
    })
    .run();

  if (!result.ok) return { ok: false, message: result.error ?? "Sync failed" };

  let newAccounts = 0;
  let newTxns = 0;
  for (const acct of result.accounts) {
    const externalName = `${adapter.id}:${acct.externalId}`;
    let existing = db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.householdId, householdId), eq(schema.accounts.name, acct.name), eq(schema.accounts.connectionSource, adapter.id)))
      .all()[0];
    if (!existing) {
      existing = {
        id: randomUUID(),
        householdId,
        ownerUserId: null,
        name: acct.name,
        institution: acct.institution,
        country: acct.country,
        type: acct.type,
        currency: acct.currency,
        connectionSource: adapter.id,
        createdAt: now,
        archivedAt: null,
      };
      db.insert(schema.accounts).values(existing).run();
      newAccounts++;
    }
    const accountId = existing.id;

    for (const bal of result.balances.filter((b) => b.externalAccountId === acct.externalId)) {
      db.insert(schema.balanceSnapshots)
        .values({ id: randomUUID(), accountId, asOf: bal.asOf, amountCents: bal.amountCents, source: adapter.id, createdAt: now })
        .onConflictDoUpdate({
          target: [schema.balanceSnapshots.accountId, schema.balanceSnapshots.asOf],
          set: { amountCents: bal.amountCents, source: adapter.id },
        })
        .run();
    }
    for (const txn of result.transactions.filter((t) => t.externalAccountId === acct.externalId)) {
      const inserted = db
        .insert(schema.transactions)
        .values({
          id: randomUUID(),
          accountId,
          date: txn.date,
          description: txn.description,
          merchant: null,
          amountCents: txn.amountCents,
          categoryId: null,
          categorySource: "none",
          importId: null,
          dedupeHash: dedupeHash(txn),
          notes: externalName,
          createdAt: now,
        })
        .onConflictDoNothing()
        .run();
      if (inserted.changes > 0) newTxns++;
    }
    for (const holding of result.holdings.filter((h) => h.externalAccountId === acct.externalId)) {
      db.insert(schema.holdings)
        .values({
          id: randomUUID(),
          accountId,
          symbol: holding.symbol,
          name: holding.name ?? null,
          quantity: holding.quantity,
          costBasisCents: null,
          priceCents: holding.priceCents,
          priceAsOf: holding.priceAsOf,
          currency: holding.currency,
        })
        .onConflictDoUpdate({
          target: [schema.holdings.accountId, schema.holdings.symbol],
          set: { quantity: holding.quantity, priceCents: holding.priceCents, priceAsOf: holding.priceAsOf },
        })
        .run();
    }
  }

  const notes = [
    `${newAccounts} account(s) added`,
    `${newTxns} new transaction(s)`,
    result.partial ? "PARTIAL: some data was missing from the provider" : null,
    result.staleAsOf ? `STALE: data as of ${result.staleAsOf}` : null,
  ].filter(Boolean);
  return { ok: true, message: notes.join(" · ") };
}

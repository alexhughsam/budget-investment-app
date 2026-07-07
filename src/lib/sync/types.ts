// The sync adapter contract (PROMPT.md §3). Every way data enters the app —
// aggregator, CSV, manual entry — normalizes to these shapes. The app core
// never knows where data came from.

import type { Currency } from "../money";

export type SyncAccount = {
  externalId: string;
  name: string;
  institution: string;
  country: "US" | "CA";
  type: "checking" | "savings" | "credit" | "brokerage" | "retirement";
  currency: Currency;
};

export type SyncBalance = { externalAccountId: string; asOf: string; amountCents: number };

export type SyncTransaction = {
  externalAccountId: string;
  date: string;
  description: string;
  amountCents: number; // negative = outflow
};

export type SyncHolding = {
  externalAccountId: string;
  symbol: string;
  name?: string;
  quantity: number;
  priceCents: number;
  priceAsOf: string;
  currency: Currency;
};

export type SyncResult = {
  ok: boolean;
  partial?: boolean; // some data missing — surface, don't hide
  staleAsOf?: string; // data is from this date, not fresh
  error?: string;
  accounts: SyncAccount[];
  balances: SyncBalance[];
  transactions: SyncTransaction[];
  holdings: SyncHolding[];
};

export interface SyncAdapter {
  id: "mock" | "plaid" | "snaptrade" | "questrade";
  displayName: string;
  // Is this adapter configured with credentials and ready to use?
  probe(): { configured: boolean; detail: string };
  sync(): Promise<SyncResult>;
}

export const EMPTY_RESULT: Omit<SyncResult, "ok"> = { accounts: [], balances: [], transactions: [], holdings: [] };

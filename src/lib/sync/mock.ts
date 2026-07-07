// Deterministic mock adapter. Powers the demo/dev experience and the chaos test:
// HEARTH_MOCK_MODE=ok|fail|partial|stale exercises every degradation path.

import { todayISO } from "../money";
import { EMPTY_RESULT, type SyncAdapter, type SyncResult } from "./types";

function mode(): "ok" | "fail" | "partial" | "stale" {
  const m = process.env.HEARTH_MOCK_MODE;
  return m === "fail" || m === "partial" || m === "stale" ? m : "ok";
}

export const mockAdapter: SyncAdapter = {
  id: "mock",
  displayName: "Demo connection",
  probe() {
    return { configured: process.env.HEARTH_ENABLE_MOCK === "1", detail: "Deterministic demo data (set HEARTH_ENABLE_MOCK=1)" };
  },
  async sync(): Promise<SyncResult> {
    const m = mode();
    if (m === "fail") {
      return { ok: false, error: "Mock provider returned an authentication error (simulated)", ...EMPTY_RESULT };
    }
    const asOf = m === "stale" ? "2026-06-20" : todayISO();
    const result: SyncResult = {
      ok: true,
      staleAsOf: m === "stale" ? asOf : undefined,
      partial: m === "partial",
      accounts: [
        { externalId: "mock-chk", name: "Everyday Chequing", institution: "Demo Bank CA", country: "CA", type: "checking", currency: "CAD" },
        { externalId: "mock-brk", name: "Demo Brokerage", institution: "Demo Broker US", country: "US", type: "brokerage", currency: "USD" },
      ],
      balances: [
        { externalAccountId: "mock-chk", asOf, amountCents: 482_355 },
        ...(m === "partial" ? [] : [{ externalAccountId: "mock-brk", asOf, amountCents: 1_275_000 }]),
      ],
      transactions: [
        { externalAccountId: "mock-chk", date: asOf, description: "MOCK GROCERY MART #12", amountCents: -8_734 },
        { externalAccountId: "mock-chk", date: asOf, description: "MOCK PAYROLL DEPOSIT", amountCents: 250_000 },
      ],
      holdings:
        m === "partial"
          ? []
          : [{ externalAccountId: "mock-brk", symbol: "VTI", name: "Vanguard Total Market", quantity: 42, priceCents: 28_500, priceAsOf: asOf, currency: "USD" }],
    };
    return result;
  },
};

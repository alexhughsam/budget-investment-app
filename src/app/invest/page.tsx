import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { decideRecommendation, recordCashbackSpend, requestMemo, saveInvestmentSettings } from "@/lib/actions";
import { aiAvailable } from "@/lib/ai";
import { cashbackEarnedCents, computeSplit, type EtfTarget } from "@/lib/invest";
import { currentMonth, getCashback, getHousehold, getInvestmentSettings, getRecommendations } from "@/lib/data";
import { formatCents } from "@/lib/money";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invest" };

export default async function InvestPage({ searchParams }: { searchParams: Promise<{ investable?: string }> }) {
  const { investable } = await searchParams;
  const { user, householdId } = await requireUser();
  const household = getHousehold(householdId);
  const settings = getInvestmentSettings(householdId);
  const targets = JSON.parse(settings.etfTargetsJson) as EtfTarget[];
  const cashback = getCashback(householdId);
  const cashbackAvailable = cashback.reduce((a, c) => a + cashbackEarnedCents(c.spendCents) - c.redeemedCents, 0);
  const memos = getRecommendations(householdId);

  const investableCents = (() => {
    const n = Number(investable);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 500_000; // default illustration: $5,000
  })();
  const split = computeSplit({ investableCents, cashbackAvailableCents: cashbackAvailable, pickCapPct: settings.pickBudgetPctCap, etfTargets: targets });

  return (
    <AppShell userName={user.name} householdName={household?.name ?? ""}>
      <h1 className="text-2xl font-bold mb-1">Invest</h1>
      <p className="text-sm mb-6" style={{ color: "var(--ink-2)" }}>
        The 90/10 system: ~90% of investable money goes to broad ETFs on a schedule; at most {settings.pickBudgetPctCap}% —
        funded by Gold Card cashback — goes to individual picks. The engine below is deterministic; the advisor writes memos,
        a human places every trade.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 90/10 engine */}
        <section className="card p-5">
          <h2 className="font-bold mb-3">Monthly instructions</h2>
          <form method="GET" className="flex items-end gap-2 mb-4">
            <label className="block text-sm font-medium flex-1" style={{ color: "var(--ink-2)" }}>
              Investable cash this month (USD)
              <input name="investable" defaultValue={(investableCents / 100).toFixed(2)} className="input mt-1 tnum" inputMode="decimal" />
            </label>
            <button className="btn">Compute</button>
          </form>
          <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: "var(--surface-2)" }}>
            <div className="flex justify-between font-semibold">
              <span>ETF bucket ({100 - split.pickCapPct}%+)</span>
              <span className="tnum">{formatCents(split.etfCents, "USD")}</span>
            </div>
            {split.etfLines.map((l) => (
              <div key={l.symbol} className="flex justify-between pl-4" style={{ color: "var(--ink-2)" }}>
                <span>Buy {l.symbol}</span>
                <span className="tnum">{formatCents(l.cents, "USD")}</span>
              </div>
            ))}
            {split.etfLines.length === 0 && (
              <p className="pl-4 text-xs" style={{ color: "var(--ink-3)" }}>
                Set your ETF plan below to see per-fund amounts.
              </p>
            )}
            <div className="flex justify-between font-semibold pt-2 border-t" style={{ borderColor: "var(--baseline)" }}>
              <span>Pick budget (≤{split.pickCapPct}%, from cashback)</span>
              <span className="tnum">{formatCents(split.pickCents, "USD")}</span>
            </div>
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              Hard ceiling — the advisor refuses to allocate beyond it. Unredeemed cashback available:{" "}
              {formatCents(cashbackAvailable, "USD")}.
            </p>
          </div>

          <h3 className="font-semibold text-sm mt-5 mb-2">ETF plan</h3>
          <ActionForm action={saveInvestmentSettings} submitLabel="Save plan">
            <textarea
              name="etfTargets"
              rows={3}
              className="input font-mono text-xs"
              defaultValue={targets.map((t) => `${t.symbol} ${t.weightPct}`).join("\n")}
              aria-label="ETF plan, one per line: symbol weight"
            />
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              One per line: symbol and weight, e.g. &quot;VTI 70&quot;. Weights must sum to 100.
            </p>
          </ActionForm>

          <h3 className="font-semibold text-sm mt-5 mb-2">Gold Card cashback tracker</h3>
          <ActionForm action={recordCashbackSpend} submitLabel="Record spend">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                Month
                <input name="month" type="month" defaultValue={currentMonth()} className="input mt-1" />
              </label>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                Card spend (USD)
                <input name="spend" className="input mt-1" placeholder="3,200.00" inputMode="decimal" />
              </label>
            </div>
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              Earns 3% when redeemed into the brokerage (the good option) — vs ~2.1% as a statement credit.
            </p>
          </ActionForm>
          {cashback.length > 0 && (
            <table className="w-full text-xs mt-3">
              <thead>
                <tr className="text-left" style={{ color: "var(--ink-3)" }}>
                  <th className="py-1">Month</th>
                  <th className="py-1 text-right">Spend</th>
                  <th className="py-1 text-right">Earned @3%</th>
                </tr>
              </thead>
              <tbody>
                {cashback.map((c) => (
                  <tr key={c.id} className="hairline-b last:border-0">
                    <td className="py-1">{c.month}</td>
                    <td className="py-1 text-right tnum">{formatCents(c.spendCents, "USD")}</td>
                    <td className="py-1 text-right tnum font-semibold">{formatCents(cashbackEarnedCents(c.spendCents), "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Advisor */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2">
              <Icon name="sparkle" className="w-4 h-4" /> Advisor memos
            </h2>
          </div>
          {!aiAvailable() ? (
            <div className="rounded-xl p-4 text-sm" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
              The advisor is <span className="font-semibold">not configured</span>. Set <code>ANTHROPIC_API_KEY</code> on the
              server and it will research picks, write cited memos, and keep an auditable track record. It never trades — you
              do.
            </div>
          ) : (
            <ActionForm action={requestMemo} submitLabel="Write me a memo" pendingLabel="Researching… (can take a minute)">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                  Type
                  <select name="kind" className="input mt-1" defaultValue="pick">
                    <option value="pick">Stock pick (10% sleeve)</option>
                    <option value="allocation">Allocation check-in</option>
                  </select>
                </label>
                <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                  Investable this month (USD)
                  <input name="investable" className="input mt-1" defaultValue={(investableCents / 100).toFixed(2)} inputMode="decimal" />
                </label>
              </div>
            </ActionForm>
          )}

          <div className="mt-5 space-y-4">
            {memos.length === 0 && (
              <p className="text-sm" style={{ color: "var(--ink-3)" }}>
                No memos yet. Every memo is logged permanently — what it said, what you decided, and how it turned out.
              </p>
            )}
            {memos.map((m) => (
              <details key={m.id} className="rounded-xl border p-4" style={{ borderColor: "var(--hairline)" }}>
                <summary className="cursor-pointer">
                  <span className="font-semibold text-sm">{m.title}</span>
                  <span className="block text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {new Date(m.createdAt).toISOString().slice(0, 10)} · {m.kind} ·{" "}
                    <span
                      className="font-semibold"
                      style={{ color: m.status === "accepted" ? "var(--good)" : m.status === "declined" ? "var(--critical)" : "var(--ink-2)" }}
                    >
                      {m.status}
                    </span>
                    {m.outcomeNote ? ` · outcome: ${m.outcomeNote}` : ""}
                  </span>
                </summary>
                <div className="prose-memo text-sm mt-3 whitespace-pre-wrap">{m.body}</div>
                {m.status === "open" && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <form action={decideRecommendation} className="flex gap-2 items-center flex-wrap">
                      <input type="hidden" name="id" value={m.id} />
                      <input name="note" placeholder="note (optional)" className="input !w-44 !py-1 text-xs" />
                      <button name="status" value="accepted" className="btn !py-1 text-xs">
                        Accepted it
                      </button>
                      <button name="status" value="declined" className="btn btn-ghost !py-1 text-xs">
                        Passed
                      </button>
                    </form>
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

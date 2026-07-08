import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { NetWorthChart } from "@/components/NetWorthChart";
import { Icon } from "@/components/icons";
import { currentMonth, getAccounts, getBudgetView, getHousehold, getNetWorth, getNetWorthHistory, getTransactions } from "@/lib/data";
import { formatCents, type Currency } from "@/lib/money";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  checking: "Chequing / Checking",
  savings: "Savings",
  credit: "Credit cards",
  brokerage: "Brokerage",
  retirement: "Retirement",
};

export default async function DashboardPage() {
  const { user, householdId } = await requireUser();
  const household = getHousehold(householdId);
  const display = (household?.displayCurrency ?? "USD") as Currency;
  const accounts = getAccounts(householdId);
  const netWorth = await getNetWorth(householdId, display);
  const history = await getNetWorthHistory(householdId, display);
  const month = currentMonth();
  const budget = await getBudgetView(householdId, month, display);
  const recent = getTransactions(householdId, { limit: 6 });
  const spentTotal = budget.lines.reduce((a, l) => a + l.actualCents, 0) + budget.uncategorizedCents;

  const groups = Object.entries(TYPE_LABEL)
    .map(([type, label]) => ({ type, label, accounts: accounts.filter((a) => a.type === type) }))
    .filter((g) => g.accounts.length > 0);

  return (
    <AppShell userName={user.name} householdName={household?.name ?? "Household"}>
      <div className="space-y-6">
        {/* Net worth hero — the passbook page */}
        <section className="ledger-page p-5 md:p-7">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--ink-3)", fontFamily: "var(--font-data)" }}>
                Household net worth
              </h1>
              <p className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mt-2 tabular-nums">
                {formatCents(netWorth.totalCents, display)}
              </p>
              <p className="text-xs mt-3 tnum" style={{ color: "var(--ink-2)" }}>
                {formatCents(netWorth.byCurrency.USD, "USD")} &nbsp;+&nbsp; {formatCents(netWorth.byCurrency.CAD, "CAD")}
                <span style={{ color: "var(--ink-3)" }}>
                  {" "}
                  · converted at {netWorth.fx.rate.toFixed(4)} ({netWorth.fx.source})
                </span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="stamp" style={{ color: netWorth.fx.stale ? "var(--serious)" : "var(--good)" }}>
                {netWorth.fx.stale ? `FX stale · ${netWorth.fx.date}` : `FX ${netWorth.fx.date}`}
              </span>
              {netWorth.anyStale && (
                <span className="stamp" style={{ color: "var(--serious)" }}>
                  <Icon name="alert" className="w-3 h-3" /> stale balances
                </span>
              )}
              {netWorth.missingCount > 0 && (
                <span className="stamp" style={{ color: "var(--ink-3)" }}>
                  {netWorth.missingCount} unrecorded
                </span>
              )}
            </div>
          </div>
          <div className="mt-5">
            <NetWorthChart points={history} currencySymbol={display === "USD" ? "US$" : "C$"} />
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          {/* This month */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">This month</h2>
              <Link href="/budget" className="text-sm font-semibold text-link">
                Budget →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                <div className="text-xs font-medium" style={{ color: "var(--ink-3)" }}>
                  Income
                </div>
                <div className="text-xl font-bold tnum" style={{ color: "var(--good)" }}>
                  {formatCents(budget.incomeCents, display)}
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                <div className="text-xs font-medium" style={{ color: "var(--ink-3)" }}>
                  Spending
                </div>
                <div className="text-xl font-bold tnum">{formatCents(spentTotal, display)}</div>
              </div>
            </div>
            {budget.uncategorizedCount > 0 && (
              <p className="text-xs mt-3" style={{ color: "var(--ink-3)" }}>
                {budget.uncategorizedCount} transaction(s) still uncategorized —{" "}
                <Link href="/transactions" className="font-semibold text-link">
                  fix that
                </Link>
              </p>
            )}
            {recent.length === 0 && (
              <p className="text-sm mt-3" style={{ color: "var(--ink-2)" }}>
                No transactions yet. Add an account, then import a CSV statement or add transactions by hand.
              </p>
            )}
            {recent.length > 0 && (
              <ul className="mt-4 space-y-1">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm py-1.5 hairline-b last:border-0">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.merchant ?? t.description}</div>
                      <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                        {t.date} · {t.accountName}
                      </div>
                    </div>
                    <span className="tnum font-semibold shrink-0 pl-3" style={{ color: t.amountCents > 0 ? "var(--good)" : "var(--ink)" }}>
                      {formatCents(t.amountCents, t.accountCurrency, { sign: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Accounts */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">Accounts</h2>
              <Link href="/accounts/new" className="text-sm font-semibold inline-flex items-center gap-1 text-link">
                <Icon name="plus" className="w-3.5 h-3.5" /> Add
              </Link>
            </div>
            {accounts.length === 0 && (
              <div className="text-sm space-y-2" style={{ color: "var(--ink-2)" }}>
                <p>No accounts yet — this app is empty until you add your first one.</p>
                <Link href="/accounts/new" className="btn inline-flex">
                  Add your first account
                </Link>
              </div>
            )}
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.type}>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ink-3)" }}>
                    {g.label}
                  </div>
                  <ul>
                    {g.accounts.map((a) => (
                      <li key={a.id}>
                        <Link href={`/accounts/${a.id}`} className="flex items-center justify-between py-1.5 text-sm hover:opacity-80">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="badge" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
                              {a.country}
                            </span>
                            <span className="truncate font-medium">{a.name}</span>
                          </div>
                          <div className="text-right shrink-0 pl-3">
                            {a.balanceCents === null ? (
                              <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                                no balance
                              </span>
                            ) : (
                              <>
                                <span className="tnum font-semibold">{formatCents(a.balanceCents, a.currency as Currency)}</span>
                                {a.balanceStale && (
                                  <span className="block text-[10px]" style={{ color: "var(--serious)" }}>
                                    stale · {a.balanceAsOf}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

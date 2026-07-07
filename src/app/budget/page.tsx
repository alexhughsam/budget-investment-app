import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { setBudget } from "@/lib/actions";
import { currentMonth, getBudgetView, getHousehold } from "@/lib/data";
import { formatCents, type Currency } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Budget" };

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const { user, householdId } = await requireUser();
  const household = getHousehold(householdId);
  const display = (household?.displayCurrency ?? "USD") as Currency;
  const view = await getBudgetView(householdId, month, display);
  const totalBudget = view.lines.reduce((a, l) => a + (l.budgetCents ?? 0), 0);
  const totalSpent = view.lines.reduce((a, l) => a + l.actualCents, 0) + view.uncategorizedCents;
  const saved = view.incomeCents - totalSpent;

  return (
    <AppShell userName={user.name} householdName={household?.name ?? ""}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-2xl font-bold">Budget</h1>
        <div className="flex items-center gap-2">
          <Link href={`/budget?month=${shiftMonth(month, -1)}`} className="btn btn-ghost !px-3">
            ←
          </Link>
          <span className="font-semibold tnum">{month}</span>
          <Link href={`/budget?month=${shiftMonth(month, 1)}`} className="btn btn-ghost !px-3">
            →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Income", value: view.incomeCents, color: "var(--good)" },
          { label: "Spending", value: totalSpent, color: "var(--ink)" },
          { label: saved >= 0 ? "Left to save/invest" : "Overspent", value: saved, color: saved >= 0 ? "var(--good)" : "var(--critical)" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="text-xs font-medium" style={{ color: "var(--ink-3)" }}>
              {s.label}
            </div>
            <div className="text-lg md:text-2xl font-bold tnum" style={{ color: s.color }}>
              {formatCents(s.value, display)}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
        All figures shown in {display}; cross-currency spending converted at {view.fx.rate.toFixed(4)} ({view.fx.source}
        {view.fx.stale ? `, STALE as of ${view.fx.date}` : ""}). Budgets total {formatCents(totalBudget, display)}.
      </p>

      {view.uncategorizedCount > 0 && (
        <div className="card p-4 mb-4 text-sm" style={{ color: "var(--ink-2)" }}>
          <span className="font-bold">{formatCents(view.uncategorizedCents, display)}</span> of spending is uncategorized (
          {view.uncategorizedCount} transaction(s)) and isn&apos;t reflected in the category bars below —{" "}
          <Link href={`/transactions?month=${month}`} className="font-semibold" style={{ color: "var(--accent)" }}>
            categorize it
          </Link>
          .
        </div>
      )}

      <div className="card divide-y" style={{ borderColor: "var(--hairline)" }}>
        {view.lines.length === 0 && (
          <p className="p-6 text-sm" style={{ color: "var(--ink-2)" }}>
            No expense categories yet — they&apos;re created with your household.
          </p>
        )}
        {view.lines.map((l) => {
          const pct = l.budgetCents ? Math.min((l.actualCents / l.budgetCents) * 100, 100) : 0;
          const over = l.budgetCents !== null && l.actualCents > l.budgetCents;
          return (
            <div key={l.categoryId} className="px-4 py-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-semibold">{l.categoryName}</span>
                <span className="tnum" style={{ color: "var(--ink-2)" }}>
                  {formatCents(l.actualCents, display)}
                  {l.budgetCents !== null && (
                    <span style={{ color: over ? "var(--critical)" : "var(--ink-3)" }}> / {formatCents(l.budgetCents, display)}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }} role="img" aria-label={`${l.categoryName}: spent ${formatCents(l.actualCents, display)}${l.budgetCents ? ` of ${formatCents(l.budgetCents, display)} budget` : ", no budget set"}`}>
                  {l.budgetCents !== null && (
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: over ? "var(--critical)" : "var(--series-1)" }}
                    />
                  )}
                </div>
                <form action={setBudget} className="flex items-center gap-1">
                  <input type="hidden" name="categoryId" value={l.categoryId} />
                  <input type="hidden" name="month" value={month} />
                  <input
                    name="amount"
                    defaultValue={l.budgetCents !== null ? (l.budgetCents / 100).toFixed(2) : ""}
                    placeholder="budget"
                    inputMode="decimal"
                    className="input !w-24 !py-1 !px-2 text-xs tnum"
                    aria-label={`Monthly budget for ${l.categoryName}`}
                  />
                  <button className="btn btn-ghost !py-1 !px-2 text-xs">Set</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

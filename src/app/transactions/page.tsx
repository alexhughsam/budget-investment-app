import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CategorySelect } from "@/components/CategorySelect";
import { ActionForm } from "@/components/ActionForm";
import { categorizeUncategorized } from "@/lib/actions";
import { aiAvailable } from "@/lib/ai";
import { Icon } from "@/components/icons";
import { currentMonth, getCategories, getHousehold, getTransactions } from "@/lib/data";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transactions" };

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();
  const { user, householdId } = await requireUser();
  const household = getHousehold(householdId);
  const txns = getTransactions(householdId, { month, limit: 1000 });
  const categories = getCategories(householdId);
  const uncategorized = txns.filter((t) => !t.categoryId).length;

  return (
    <AppShell userName={user.name} householdName={household?.name ?? ""}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex items-center gap-2">
          <Link href={`/transactions?month=${shiftMonth(month, -1)}`} className="btn btn-ghost !px-3">
            ←
          </Link>
          <span className="font-semibold tnum">{month}</span>
          <Link href={`/transactions?month=${shiftMonth(month, 1)}`} className="btn btn-ghost !px-3">
            →
          </Link>
        </div>
      </div>

      <div className="card p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {uncategorized === 0 ? (
            <>Every transaction this month has a category. Nice.</>
          ) : (
            <>
              <span className="font-bold">{uncategorized}</span> uncategorized transaction(s) this month.
            </>
          )}
          {!aiAvailable() && (
            <span className="block text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
              Auto-categorization is off — set ANTHROPIC_API_KEY on the server to enable it.
            </span>
          )}
        </p>
        <ActionForm action={categorizeUncategorized} submitLabel="Auto-categorize with AI" pendingLabel="Categorizing…" className="flex items-center gap-3">
          <span className="hidden" />
        </ActionForm>
      </div>

      <div className="card overflow-x-auto">
        {txns.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: "var(--ink-2)" }}>
            No transactions in {month}. Import a statement from an account page, or add one by hand.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs hairline-b" style={{ color: "var(--ink-3)" }}>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id} className="hairline-b last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap text-xs" style={{ color: "var(--ink-2)" }}>
                    {t.date}
                  </td>
                  <td className="px-4 py-2 max-w-[260px]">
                    <span className="block truncate font-medium">{t.merchant ?? t.description}</span>
                    {t.categorySource === "ai" && (
                      <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: "var(--ink-3)" }}>
                        <Icon name="sparkle" className="w-2.5 h-2.5" /> AI categorized
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
                    {t.accountName}
                  </td>
                  <td className="px-4 py-2">
                    <CategorySelect transactionId={t.id} categoryId={t.categoryId} categories={categories} />
                  </td>
                  <td className="px-4 py-2 text-right tnum font-semibold whitespace-nowrap" style={{ color: t.amountCents > 0 ? "var(--good)" : "var(--ink)" }}>
                    {formatCents(t.amountCents, t.accountCurrency, { sign: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

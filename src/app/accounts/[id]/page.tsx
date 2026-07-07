import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { CsvImport } from "@/components/CsvImport";
import { ActionForm } from "@/components/ActionForm";
import { CategorySelect } from "@/components/CategorySelect";
import { addTransaction, archiveAccount, updateBalance } from "@/lib/actions";
import { getAccounts, getCategories, getHoldings, getHousehold, getTransactions } from "@/lib/data";
import { formatCents, todayISO, type Currency } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, householdId } = await requireUser();
  const household = getHousehold(householdId);
  const account = getAccounts(householdId).find((a) => a.id === id);
  if (!account) notFound();
  const txns = getTransactions(householdId, { accountId: id, limit: 100 });
  const categories = getCategories(householdId);
  const holdings = getHoldings(householdId, id);
  const currency = account.currency as Currency;

  return (
    <AppShell userName={user.name} householdName={household?.name ?? ""}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            {account.institution} · {account.country} · {account.type} · {currency}
          </p>
        </div>
        <div className="text-right">
          {account.balanceCents === null ? (
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>
              No balance recorded yet
            </p>
          ) : (
            <>
              <p className="text-3xl font-bold tnum">{formatCents(account.balanceCents, currency)}</p>
              <p className="text-xs" style={{ color: account.balanceStale ? "var(--serious)" : "var(--ink-3)" }}>
                {account.balanceStale ? "STALE — " : ""}as of {account.balanceAsOf}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5">
          <h2 className="font-bold mb-3">Update balance</h2>
          <ActionForm action={updateBalance} submitLabel="Record balance">
            <input type="hidden" name="accountId" value={account.id} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                Balance ({currency})
                <input name="amount" required className="input mt-1" placeholder="10,250.00" inputMode="decimal" />
              </label>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                As of
                <input name="asOf" type="date" defaultValue={todayISO()} className="input mt-1" />
              </label>
            </div>
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              For credit cards, enter what you owe — Hearth subtracts it from net worth automatically.
            </p>
          </ActionForm>
        </section>

        <section className="card p-5">
          <h2 className="font-bold mb-3">Import statement (CSV)</h2>
          <CsvImport accountId={account.id} />
        </section>

        <section className="card p-5">
          <h2 className="font-bold mb-3">Add a transaction</h2>
          <ActionForm action={addTransaction} submitLabel="Add transaction">
            <input type="hidden" name="accountId" value={account.id} />
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
              Description
              <input name="description" required className="input mt-1" placeholder="Loblaws groceries" />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                Amount
                <input name="amount" required className="input mt-1" placeholder="84.20" inputMode="decimal" />
              </label>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                Direction
                <select name="direction" className="input mt-1" defaultValue="out">
                  <option value="out">Money out</option>
                  <option value="in">Money in</option>
                </select>
              </label>
              <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
                Date
                <input name="date" type="date" defaultValue={todayISO()} className="input mt-1" />
              </label>
            </div>
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
              Category
              <select name="categoryId" className="input mt-1" defaultValue="">
                <option value="">— pick later —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
        </section>

        {(account.type === "brokerage" || account.type === "retirement") && (
          <section className="card p-5">
            <h2 className="font-bold mb-3">Holdings</h2>
            {holdings.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                No holdings recorded. Holdings arrive via sync (Settings → Connections) or stay balance-only — both are fine.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: "var(--ink-3)" }}>
                    <th className="py-1">Symbol</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.id} className="hairline-b last:border-0">
                      <td className="py-1.5 font-semibold">{h.symbol}</td>
                      <td className="py-1.5 text-right tnum">{h.quantity}</td>
                      <td className="py-1.5 text-right tnum">
                        {formatCents(h.priceCents, h.currency as Currency)}
                        <span className="block text-[10px]" style={{ color: "var(--ink-3)" }}>
                          as of {h.priceAsOf}
                        </span>
                      </td>
                      <td className="py-1.5 text-right tnum font-semibold">{formatCents(Math.round(h.quantity * h.priceCents), h.currency as Currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>

      <section className="card p-5 mt-6">
        <h2 className="font-bold mb-3">Transactions</h2>
        {txns.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            Nothing yet — import a CSV statement above or add transactions by hand.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: "var(--ink-3)" }}>
                  <th className="py-1 pr-3">Date</th>
                  <th className="py-1 pr-3">Description</th>
                  <th className="py-1 pr-3">Category</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="hairline-b last:border-0">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-xs" style={{ color: "var(--ink-2)" }}>
                      {t.date}
                    </td>
                    <td className="py-1.5 pr-3">{t.merchant ?? t.description}</td>
                    <td className="py-1.5 pr-3">
                      <CategorySelect transactionId={t.id} categoryId={t.categoryId} categories={categories} />
                    </td>
                    <td className="py-1.5 text-right tnum font-semibold" style={{ color: t.amountCents > 0 ? "var(--good)" : "var(--ink)" }}>
                      {formatCents(t.amountCents, currency, { sign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form action={archiveAccount} className="mt-6">
        <input type="hidden" name="accountId" value={account.id} />
        <button className="btn btn-ghost text-sm" style={{ color: "var(--critical)" }}>
          Archive this account
        </button>
        <span className="text-xs ml-2" style={{ color: "var(--ink-3)" }}>
          Hides it from every view. Nothing is deleted — data stays exportable.
        </span>
      </form>
    </AppShell>
  );
}

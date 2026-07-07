import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { getAccounts, getHousehold } from "@/lib/data";
import { formatCents, type Currency } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const { user, householdId } = await requireUser();
  const household = getHousehold(householdId);
  const accounts = getAccounts(householdId);

  return (
    <AppShell userName={user.name} householdName={household?.name ?? ""}>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <Link href="/accounts/new" className="btn">
          <Icon name="plus" className="w-4 h-4" /> Add account
        </Link>
      </div>
      {accounts.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <p className="font-semibold">Nothing here yet</p>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            Add each of your accounts — TD (US and Canada), Questrade, Wealthsimple, Fidelity, Robinhood, your 401(k)s — and
            Hearth pulls them into one net-worth picture across USD and CAD.
          </p>
          <Link href="/accounts/new" className="btn inline-flex">
            Add your first account
          </Link>
        </div>
      ) : (
        <div className="card divide-y" style={{ borderColor: "var(--hairline)" }}>
          {accounts.map((a) => (
            <Link key={a.id} href={`/accounts/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--surface-2)] first:rounded-t-[14px] last:rounded-b-[14px]">
              <div>
                <div className="font-semibold text-sm flex items-center gap-2">
                  {a.name}
                  <span className="badge" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
                    {a.country} · {a.currency}
                  </span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {a.institution} · {a.type} · {a.connectionSource === "manual" ? "manual / CSV" : a.connectionSource}
                </div>
              </div>
              <div className="text-right">
                {a.balanceCents === null ? (
                  <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                    no balance recorded
                  </span>
                ) : (
                  <>
                    <div className="tnum font-bold">{formatCents(a.balanceCents, a.currency as Currency)}</div>
                    <div className="text-[11px]" style={{ color: a.balanceStale ? "var(--serious)" : "var(--ink-3)" }}>
                      {a.balanceStale ? "stale · " : "as of "}
                      {a.balanceAsOf}
                    </div>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

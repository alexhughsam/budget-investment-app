import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { createAccount } from "@/lib/actions";
import { ActionForm } from "@/components/ActionForm";
import { getHousehold } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add account" };

export default async function NewAccountPage() {
  const { user, householdId } = await requireUser();
  const household = getHousehold(householdId);
  return (
    <AppShell userName={user.name} householdName={household?.name ?? ""}>
      <h1 className="text-2xl font-bold mb-1">Add account</h1>
      <p className="text-sm mb-5" style={{ color: "var(--ink-2)" }}>
        Every account works manually from day one — record balances by hand or import CSV statements. Aggregator sync can be
        attached later in Settings without changing anything here.
      </p>
      <div className="card p-5 max-w-lg">
        <ActionForm action={createAccount} submitLabel="Create account" pendingLabel="Creating…">
          <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
            Account name
            <input name="name" required className="input mt-1" placeholder="TD Everyday Chequing" />
          </label>
          <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
            Institution
            <input name="institution" required className="input mt-1" placeholder="TD Canada Trust" list="institutions" />
            <datalist id="institutions">
              <option value="TD Bank (US)" />
              <option value="TD Canada Trust" />
              <option value="Questrade" />
              <option value="Wealthsimple" />
              <option value="Fidelity" />
              <option value="Robinhood" />
            </datalist>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
              Country
              <select name="country" className="input mt-1" defaultValue="CA">
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </select>
            </label>
            <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
              Currency
              <select name="currency" className="input mt-1" defaultValue="CAD">
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
            Type
            <select name="type" className="input mt-1" defaultValue="checking">
              <option value="checking">Chequing / Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit card</option>
              <option value="brokerage">Brokerage</option>
              <option value="retirement">Retirement (401k / RRSP)</option>
            </select>
          </label>
          <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
            Current balance <span className="font-normal" style={{ color: "var(--ink-3)" }}>(optional — for credit cards, the amount you owe)</span>
            <input name="openingBalance" className="input mt-1" placeholder="12,345.67" inputMode="decimal" />
          </label>
        </ActionForm>
      </div>
    </AppShell>
  );
}

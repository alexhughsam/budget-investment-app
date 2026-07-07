import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { setDisplayCurrency, triggerSync } from "@/lib/actions";
import { adapters } from "@/lib/sync";
import { getConnections, getHousehold, getMembers } from "@/lib/data";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, householdId } = await requireUser();
  const household = getHousehold(householdId);
  const members = getMembers(householdId);
  const connections = getConnections(householdId);

  return (
    <AppShell userName={user.name} householdName={household?.name ?? ""}>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5">
          <h2 className="font-bold mb-3">Household</h2>
          <p className="text-sm mb-1" style={{ color: "var(--ink-2)" }}>
            <span className="font-semibold">{household?.name}</span>
          </p>
          <p className="text-sm mb-4" style={{ color: "var(--ink-2)" }}>
            Invite your partner with this code:{" "}
            <code className="px-2 py-0.5 rounded font-bold tracking-widest" style={{ background: "var(--surface-2)" }}>
              {household?.inviteCode}
            </code>
            <span className="block text-xs mt-1" style={{ color: "var(--ink-3)" }}>
              They sign up at <span className="font-mono">/join</span> with it — both of you see everything.
            </span>
          </p>
          <h3 className="font-semibold text-sm mb-2">Members</h3>
          <ul className="text-sm space-y-1 mb-4">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between">
                <span>
                  {m.name} <span style={{ color: "var(--ink-3)" }}>({m.email})</span>
                </span>
                <span className="badge" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="font-semibold text-sm mb-2">Display currency</h3>
          <form action={setDisplayCurrency} className="flex gap-2">
            {(["USD", "CAD"] as const).map((c) => (
              <button
                key={c}
                name="currency"
                value={c}
                className={household?.displayCurrency === c ? "btn" : "btn btn-ghost"}
                aria-pressed={household?.displayCurrency === c}
              >
                {c}
              </button>
            ))}
          </form>
          <p className="text-xs mt-2" style={{ color: "var(--ink-3)" }}>
            Net worth and budgets convert to this currency with a daily ECB rate; every converted number is labeled with its
            rate and date.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="font-bold mb-3">Connections</h2>
          <p className="text-sm mb-4" style={{ color: "var(--ink-2)" }}>
            Live sync is optional — every account works with manual balances and CSV import. When you&apos;re ready, add
            provider credentials to the server environment and these light up.
          </p>
          <ul className="space-y-3">
            {adapters.map((a) => {
              const probe = a.probe();
              const conn = connections.find((c) => c.provider === a.id);
              const status = conn?.status ?? (probe.configured ? "ok" : "not_configured");
              const statusColor =
                status === "ok" ? "var(--good-badge)" : status === "not_configured" ? "var(--ink-3)" : status === "stale" ? "var(--warning)" : "var(--critical)";
              return (
                <li key={a.id} className="rounded-xl border p-3" style={{ borderColor: "var(--hairline)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{a.displayName}</div>
                      <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                        {conn?.error ? `Last sync error: ${conn.error}` : probe.detail}
                        {conn?.lastSyncAt ? ` · last sync ${new Date(conn.lastSyncAt).toISOString().slice(0, 16).replace("T", " ")}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge" style={{ background: "var(--surface-2)", color: statusColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                        {status.replace("_", " ")}
                      </span>
                      {probe.configured && (
                        <ActionForm action={triggerSync} submitLabel="Sync" pendingLabel="Syncing…" className="!space-y-0">
                          <input type="hidden" name="provider" value={a.id} />
                        </ActionForm>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Icon name="download" className="w-4 h-4" /> Your data
          </h2>
          <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
            Everything Hearth knows, in one file — accounts, balances, transactions, budgets, holdings, memos.
          </p>
          <div className="flex gap-2">
            <a href="/api/export?format=json" className="btn" download>
              Export JSON
            </a>
            <a href="/api/export?format=csv" className="btn btn-ghost" download>
              Transactions CSV
            </a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

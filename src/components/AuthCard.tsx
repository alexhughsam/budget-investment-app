// Auth pages get the full passbook treatment: spruce cover, cream page.
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center p-4" style={{ background: "var(--cover)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-7 justify-center">
          <span className="w-9 h-9 rounded-md grid place-items-center font-bold text-lg font-display" style={{ background: "var(--cover-ink)", color: "var(--cover)" }}>
            H
          </span>
          <span className="font-display font-bold text-3xl tracking-tight" style={{ color: "var(--cover-ink)" }}>
            Hearth
          </span>
        </div>
        <div className="ledger-page p-6">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="text-sm mb-5 mt-1" style={{ color: "var(--ink-2)" }}>
            {subtitle}
          </p>
          {children}
        </div>
        <p className="text-center text-xs mt-5" style={{ color: "var(--cover-muted)" }}>
          One home for your household&apos;s money — both sides of the border.
        </p>
      </div>
    </div>
  );
}

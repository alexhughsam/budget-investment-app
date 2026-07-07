export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <span className="w-8 h-8 rounded-lg grid place-items-center text-white font-bold" style={{ background: "var(--accent)" }}>
            H
          </span>
          <span className="font-bold text-2xl tracking-tight">Hearth</span>
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm mb-5" style={{ color: "var(--ink-2)" }}>
            {subtitle}
          </p>
          {children}
        </div>
        <p className="text-center text-xs mt-4" style={{ color: "var(--ink-3)" }}>
          One home for your household&apos;s money — both sides of the border.
        </p>
      </div>
    </div>
  );
}

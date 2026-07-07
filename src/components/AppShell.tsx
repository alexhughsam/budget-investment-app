import Link from "next/link";
import { Icon } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { logOut } from "@/lib/actions";

const NAV = [
  { href: "/", label: "Dashboard", icon: "home" },
  { href: "/accounts", label: "Accounts", icon: "accounts" },
  { href: "/transactions", label: "Transactions", icon: "transactions" },
  { href: "/budget", label: "Budget", icon: "budget" },
  { href: "/invest", label: "Invest", icon: "invest" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function AppShell({ children, userName, householdName }: { children: React.ReactNode; userName: string; householdName: string }) {
  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col md:w-60 shrink-0 border-r p-4 gap-1 sticky top-0 h-screen" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>
        <Link href="/" className="flex items-center gap-2 px-2 py-2 mb-3">
          <span className="w-7 h-7 rounded-lg grid place-items-center text-white font-bold text-sm" style={{ background: "var(--accent)" }}>
            H
          </span>
          <span className="font-bold text-lg tracking-tight">Hearth</span>
        </Link>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-[var(--surface-2)]" style={{ color: "var(--ink-2)" }}>
            <Icon name={item.icon} className="w-[18px] h-[18px]" />
            {item.label}
          </Link>
        ))}
        <div className="mt-auto space-y-2">
          <div className="px-3 text-xs" style={{ color: "var(--ink-3)" }}>
            <div className="font-semibold" style={{ color: "var(--ink-2)" }}>
              {householdName}
            </div>
            <div>Signed in as {userName}</div>
          </div>
          <div className="flex items-center gap-2 px-2">
            <ThemeToggle />
            <form action={logOut}>
              <button className="btn btn-ghost !px-2.5" title="Sign out" aria-label="Sign out">
                <Icon name="logout" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-20 border-b" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>
        <Link href="/" className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md grid place-items-center text-white font-bold text-xs" style={{ background: "var(--accent)" }}>
            H
          </span>
          <span className="font-bold">Hearth</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={logOut}>
            <button className="btn btn-ghost !px-2" title="Sign out" aria-label="Sign out">
              <Icon name="logout" className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 min-w-0 px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-5xl mx-auto w-full">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t grid grid-cols-6" style={{ borderColor: "var(--hairline)", background: "var(--surface)" }}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium" style={{ color: "var(--ink-2)" }}>
            <Icon name={item.icon} className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

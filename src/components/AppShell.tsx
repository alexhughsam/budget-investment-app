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

function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`${small ? "w-6 h-6 text-[13px]" : "w-8 h-8 text-lg"} rounded-md grid place-items-center font-display font-bold`}
        style={{ background: "var(--cover-ink)", color: "var(--cover)" }}
      >
        H
      </span>
      <span className={`font-display font-bold ${small ? "text-base" : "text-xl"} tracking-tight`} style={{ color: "var(--cover-ink)" }}>
        Hearth
      </span>
    </span>
  );
}

// The passbook: a spruce "cover" wraps warm ruled "pages".
export function AppShell({ children, userName, householdName }: { children: React.ReactNode; userName: string; householdName: string }) {
  return (
    <div className="min-h-screen md:flex" style={{ background: "var(--cover)" }}>
      {/* Cover (desktop sidebar) */}
      <aside className="hidden md:flex md:flex-col md:w-60 shrink-0 p-4 gap-0.5 sticky top-0 h-screen" style={{ background: "var(--cover)" }}>
        <Link href="/" className="px-2 py-3 mb-4">
          <Wordmark />
        </Link>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-[var(--cover-2)]"
            style={{ color: "var(--cover-muted)" }}
          >
            <Icon name={item.icon} className="w-[18px] h-[18px]" />
            <span style={{ color: "var(--cover-ink)" }}>{item.label}</span>
          </Link>
        ))}
        <div className="mt-auto space-y-3">
          <div className="px-3 text-xs" style={{ color: "var(--cover-muted)" }}>
            <div className="font-semibold" style={{ color: "var(--cover-ink)" }}>
              {householdName}
            </div>
            <div>Signed in as {userName}</div>
          </div>
          <div className="flex items-center gap-2 px-2">
            <ThemeToggle cover />
            <form action={logOut}>
              <button
                className="inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors hover:bg-[var(--cover-2)]"
                style={{ borderColor: "var(--cover-2)", color: "var(--cover-ink)" }}
                title="Sign out"
                aria-label="Sign out"
              >
                <Icon name="logout" className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Cover (mobile header) */}
      <header className="md:hidden flex items-center justify-between px-4 py-2.5 sticky top-0 z-20" style={{ background: "var(--cover)" }}>
        <Link href="/">
          <Wordmark small />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle cover />
          <form action={logOut}>
            <button
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border"
              style={{ borderColor: "var(--cover-2)", color: "var(--cover-ink)" }}
              title="Sign out"
              aria-label="Sign out"
            >
              <Icon name="logout" className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Pages */}
      <div className="flex-1 min-w-0 md:my-3 md:mr-3 md:rounded-xl overflow-hidden" style={{ background: "var(--page)" }}>
        <main className="px-4 md:px-8 py-6 pb-24 md:pb-10 max-w-5xl mx-auto w-full">{children}</main>
      </div>

      {/* Cover (mobile bottom nav) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-6" style={{ background: "var(--cover)" }}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium" style={{ color: "var(--cover-ink)" }}>
            <Icon name={item.icon} className="w-5 h-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

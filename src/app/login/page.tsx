import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { logIn } from "@/lib/actions";
import { ActionForm } from "@/components/ActionForm";
import { AuthCard } from "@/components/AuthCard";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your household">
      <ActionForm action={logIn} submitLabel="Sign in" pendingLabel="Signing in…">
        <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Email
          <input name="email" type="email" required autoComplete="email" className="input mt-1" placeholder="you@example.com" />
        </label>
        <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Password
          <input name="password" type="password" required autoComplete="current-password" className="input mt-1" />
        </label>
      </ActionForm>
      <p className="text-sm mt-4" style={{ color: "var(--ink-2)" }}>
        New here?{" "}
        <Link href="/signup" className="font-semibold text-link">
          Create a household
        </Link>{" "}
        or{" "}
        <Link href="/join" className="font-semibold text-link">
          join with an invite code
        </Link>
        .
      </p>
    </AuthCard>
  );
}

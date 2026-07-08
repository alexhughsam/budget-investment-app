import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { signUp } from "@/lib/actions";
import { ActionForm } from "@/components/ActionForm";
import { AuthCard } from "@/components/AuthCard";

export const metadata = { title: "Create household" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthCard title="Start your household" subtitle="You'll get an invite code to share with your partner">
      <ActionForm action={signUp} submitLabel="Create household" pendingLabel="Creating…">
        <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Your name
          <input name="name" required className="input mt-1" placeholder="Alex" />
        </label>
        <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Household name
          <input name="householdName" required className="input mt-1" placeholder="Alex & Nancy" />
        </label>
        <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Email
          <input name="email" type="email" required autoComplete="email" className="input mt-1" />
        </label>
        <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Password <span className="font-normal" style={{ color: "var(--ink-3)" }}>(8+ characters)</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
        </label>
      </ActionForm>
      <p className="text-sm mt-4" style={{ color: "var(--ink-2)" }}>
        Already have a household?{" "}
        <Link href="/login" className="font-semibold text-link">
          Sign in
        </Link>{" "}
        ·{" "}
        <Link href="/join" className="font-semibold text-link">
          Join with a code
        </Link>
      </p>
    </AuthCard>
  );
}

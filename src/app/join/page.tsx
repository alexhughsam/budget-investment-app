import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { joinHousehold } from "@/lib/actions";
import { ActionForm } from "@/components/ActionForm";
import { AuthCard } from "@/components/AuthCard";

export const metadata = { title: "Join household" };

export default async function JoinPage() {
  if (await currentUser()) redirect("/");
  return (
    <AuthCard title="Join your household" subtitle="Use the invite code from your partner's Settings page">
      <ActionForm action={joinHousehold} submitLabel="Join household" pendingLabel="Joining…">
        <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Invite code
          <input name="inviteCode" required className="input mt-1 uppercase tracking-widest" placeholder="AB12CD34" />
        </label>
        <label className="block text-sm font-medium" style={{ color: "var(--ink-2)" }}>
          Your name
          <input name="name" required className="input mt-1" placeholder="Nancy" />
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
        Starting fresh instead?{" "}
        <Link href="/signup" className="font-semibold text-link">
          Create a household
        </Link>
      </p>
    </AuthCard>
  );
}

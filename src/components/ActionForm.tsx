"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/actions";

// Generic form wrapper for server actions returning ActionResult.
// Shows pending state and the success/error message inline.
export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  pendingLabel,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? "space-y-3"}>
      {children}
      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn" disabled={pending}>
          {pending ? (pendingLabel ?? "Working…") : submitLabel}
        </button>
        {state && (
          <p role="status" className="text-sm font-medium" style={{ color: state.ok ? "var(--good)" : "var(--critical)" }}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

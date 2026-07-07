"use client";

import { useRef, useTransition } from "react";
import { setTransactionCategory } from "@/lib/actions";

// Inline category editor: auto-submits on change.
export function CategorySelect({
  transactionId,
  categoryId,
  categories,
}: {
  transactionId: string;
  categoryId: string | null;
  categories: Array<{ id: string; name: string }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form ref={formRef} action={(fd) => startTransition(() => setTransactionCategory(fd))}>
      <input type="hidden" name="transactionId" value={transactionId} />
      <select
        name="categoryId"
        defaultValue={categoryId ?? ""}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="input !w-auto !py-1 !px-2 text-xs"
        aria-label="Category"
      >
        <option value="">Uncategorized</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}

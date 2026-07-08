"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icons";

// Reads the current theme from <html data-theme>, set before paint by the
// inline script in layout.tsx and updated by toggle().
let notify: (() => void) | null = null;
function subscribe(cb: () => void) {
  notify = cb;
  return () => {
    notify = null;
  };
}
function getTheme() {
  return document.documentElement.dataset.theme ?? null;
}

export function ThemeToggle({ cover = false }: { cover?: boolean }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => null);
  function toggle() {
    const current =
      document.documentElement.dataset.theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("hearth-theme", next);
    notify?.();
  }
  if (cover) {
    return (
      <button
        onClick={toggle}
        className="inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors hover:bg-[var(--cover-2)]"
        style={{ borderColor: "var(--cover-2)", color: "var(--cover-ink)" }}
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} className="w-4 h-4" />
      </button>
    );
  }
  return (
    <button onClick={toggle} className="btn-ghost btn !px-2.5" aria-label="Toggle dark mode" title="Toggle dark mode">
      <Icon name={theme === "dark" ? "sun" : "moon"} className="w-4 h-4" />
    </button>
  );
}

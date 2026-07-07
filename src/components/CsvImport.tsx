"use client";

import { useState } from "react";
import Papa from "papaparse";
import { findSavedMapping, importCsv } from "@/lib/actions";
import type { ColumnMapping } from "@/lib/csv";

type Step = "pick" | "map" | "done";

// CSV/statement import with a column-mapping UI. The mapping is remembered
// per header signature server-side, so each institution's format is a
// one-time setup. Preview shows the first mapped rows before anything writes.
export function CsvImport({ accountId }: { accountId: string }) {
  const [step, setStep] = useState<Step>("pick");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({ dateFormat: "YMD", flipSign: false });
  const [savedMappingUsed, setSavedMappingUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function guess(headers: string[]): Partial<ColumnMapping> {
    const lower = headers.map((h) => h.toLowerCase());
    const find = (patterns: RegExp[]) => {
      const i = lower.findIndex((h) => patterns.some((p) => p.test(h)));
      return i >= 0 ? headers[i] : undefined;
    };
    return {
      date: find([/date/]),
      description: find([/desc/, /payee/, /merchant/, /^name$/, /details/, /narrative/]),
      amount: find([/^amount$/, /^amt$/, /transaction amount/]),
      debit: find([/debit/, /withdrawal/, /money out/]),
      credit: find([/^credit$/, /deposit/, /money in/]),
      dateFormat: "YMD",
      flipSign: false,
    };
  }

  function onFile(file: File) {
    setError(null);
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (res) => {
        const hdrs = res.meta.fields ?? [];
        if (hdrs.length === 0 || res.data.length === 0) {
          setError("Couldn't find a header row and data rows in that file.");
          return;
        }
        setHeaders(hdrs);
        setRows(res.data);
        const saved = await findSavedMapping(hdrs).catch(() => null);
        if (saved) {
          setMapping(saved);
          setSavedMappingUsed(true);
        } else {
          setMapping(guess(hdrs));
          setSavedMappingUsed(false);
        }
        setStep("map");
      },
      error: () => setError("That file could not be parsed as CSV."),
    });
  }

  async function submit() {
    if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit && !mapping.credit)) {
      setError("Pick at least a date, description, and an amount (or debit/credit) column.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await importCsv({
        accountId,
        filename,
        headers,
        rows,
        mapping: {
          date: mapping.date,
          description: mapping.description,
          amount: mapping.amount ?? "",
          debit: mapping.debit || undefined,
          credit: mapping.credit || undefined,
          dateFormat: mapping.dateFormat ?? "YMD",
          flipSign: mapping.flipSign ?? false,
        },
      });
      if (res.ok) {
        setResult(res.message);
        setStep("done");
      } else {
        setError(res.message);
      }
    } catch {
      setError("Import failed — nothing was written. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const colSelect = (label: string, key: keyof ColumnMapping, optional = false) => (
    <label className="block text-sm">
      <span className="font-medium" style={{ color: "var(--ink-2)" }}>
        {label}
        {optional ? " (optional)" : ""}
      </span>
      <select
        className="input mt-1"
        value={(mapping[key] as string) ?? ""}
        onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value || undefined }))}
      >
        <option value="">—</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );

  if (step === "done") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium" style={{ color: "var(--good)" }} role="status">
          {result}
        </p>
        <button className="btn btn-ghost" onClick={() => { setStep("pick"); setResult(null); }}>
          Import another file
        </button>
      </div>
    );
  }

  if (step === "map") {
    let previewNote: string | null = null;
    const preview = rows.slice(0, 4).map((r) => {
      const date = mapping.date ? r[mapping.date] : "?";
      const desc = mapping.description ? r[mapping.description] : "?";
      const amt = mapping.amount ? r[mapping.amount] : mapping.debit || mapping.credit ? `${mapping.debit ? r[mapping.debit] ?? "" : ""}${mapping.credit && r[mapping.credit] ? ` / +${r[mapping.credit]}` : ""}` : "?";
      return { date, desc, amt };
    });
    if (savedMappingUsed) previewNote = "Used the saved mapping for this file format — adjust if needed.";
    return (
      <div className="space-y-4">
        <div className="text-sm" style={{ color: "var(--ink-2)" }}>
          <span className="font-semibold">{filename}</span> · {rows.length} rows
          {previewNote && <span className="block text-xs mt-1" style={{ color: "var(--good)" }}>{previewNote}</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {colSelect("Date column", "date")}
          {colSelect("Description column", "description")}
          {colSelect("Amount column (signed)", "amount", true)}
          {colSelect("Debit column", "debit", true)}
          {colSelect("Credit column", "credit", true)}
          <label className="block text-sm">
            <span className="font-medium" style={{ color: "var(--ink-2)" }}>Ambiguous date order</span>
            <select className="input mt-1" value={mapping.dateFormat} onChange={(e) => setMapping((m) => ({ ...m, dateFormat: e.target.value as ColumnMapping["dateFormat"] }))}>
              <option value="YMD">Year-Month-Day</option>
              <option value="MDY">Month/Day/Year (US)</option>
              <option value="DMY">Day/Month/Year</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-2)" }}>
          <input type="checkbox" checked={mapping.flipSign ?? false} onChange={(e) => setMapping((m) => ({ ...m, flipSign: e.target.checked }))} />
          Flip signs (my bank exports spending as positive numbers)
        </label>
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ color: "var(--ink-3)" }}>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p, i) => (
                <tr key={i} className="hairline-b last:border-0">
                  <td className="px-3 py-1.5 whitespace-nowrap">{p.date}</td>
                  <td className="px-3 py-1.5">{p.desc}</td>
                  <td className="px-3 py-1.5 text-right tnum">{p.amt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--critical)" }} role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button className="btn" onClick={submit} disabled={busy}>
            {busy ? "Importing…" : `Import ${rows.length} rows`}
          </button>
          <button className="btn btn-ghost" onClick={() => setStep("pick")} disabled={busy}>
            Back
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--ink-3)" }}>
          Duplicates are detected automatically — re-importing the same statement won&apos;t double anything.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label
        className="block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-[var(--surface-2)]"
        style={{ borderColor: "var(--baseline)", color: "var(--ink-2)" }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <span className="font-semibold block">Drop a CSV statement here or click to browse</span>
        <span className="text-xs block mt-1" style={{ color: "var(--ink-3)" }}>
          Works with exports from TD, Fidelity, Questrade, Wealthsimple, Robinhood, 401(k) portals — any CSV with a header row.
        </span>
      </label>
      {error && (
        <p className="text-sm font-medium" style={{ color: "var(--critical)" }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

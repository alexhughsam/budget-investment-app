import { createHash } from "node:crypto";
import { parseAmountToCents } from "./money";

export type ColumnMapping = {
  date: string; // header name for date column
  description: string;
  amount: string; // single signed amount column…
  debit?: string; // …or separate debit/credit columns
  credit?: string;
  dateFormat: "YMD" | "MDY" | "DMY";
  flipSign: boolean; // some banks export outflows as positive
};

export type MappedRow = {
  date: string; // normalized YYYY-MM-DD
  description: string;
  amountCents: number;
};

export function headerSignature(headers: string[]): string {
  return createHash("sha256").update(headers.map((h) => h.trim().toLowerCase()).join("|")).digest("hex");
}

export function normalizeDate(raw: string, format: ColumnMapping["dateFormat"]): string {
  const t = raw.trim();
  // ISO-ish already
  const iso = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const parts = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (parts) {
    const [, a, b, cRaw] = parts;
    const year = cRaw.length === 2 ? `20${cRaw}` : cRaw;
    const [month, day] = format === "DMY" ? [b, a] : [a, b];
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // e.g. "Jul 3, 2026"
  const parsed = new Date(t);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  throw new Error(`Unrecognized date: "${raw}"`);
}

export function mapRow(row: Record<string, string>, mapping: ColumnMapping): MappedRow | null {
  const dateRaw = row[mapping.date];
  const description = (row[mapping.description] ?? "").trim();
  if (!dateRaw || !description) return null;

  let amountCents: number;
  if (mapping.debit || mapping.credit) {
    const debitRaw = mapping.debit ? (row[mapping.debit] ?? "").trim() : "";
    const creditRaw = mapping.credit ? (row[mapping.credit] ?? "").trim() : "";
    if (!debitRaw && !creditRaw) return null;
    const debit = debitRaw ? Math.abs(parseAmountToCents(debitRaw)) : 0;
    const credit = creditRaw ? Math.abs(parseAmountToCents(creditRaw)) : 0;
    amountCents = credit - debit; // outflow negative
  } else {
    const amountRaw = (row[mapping.amount] ?? "").trim();
    if (!amountRaw) return null;
    amountCents = parseAmountToCents(amountRaw);
  }
  if (mapping.flipSign) amountCents = -amountCents;

  return { date: normalizeDate(dateRaw, mapping.dateFormat), description, amountCents };
}

// Dedupe hash: same account + date + amount + normalized description = same transaction.
// Re-importing the same statement is a no-op by construction.
export function dedupeHash(row: { date: string; description: string; amountCents: number }): string {
  const normalized = row.description.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${row.date}|${row.amountCents}|${normalized}`).digest("hex");
}

// Best-effort auto-detection of a mapping from headers; user confirms in the UI.
export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const find = (patterns: RegExp[]) => headers.find((h) => patterns.some((p) => p.test(h.trim().toLowerCase())));
  return {
    date: find([/^date$/, /transaction date/, /posted/, /^trans.?date/]),
    description: find([/desc/, /payee/, /merchant/, /^name$/, /narrative/, /details/]),
    amount: find([/^amount$/, /^amt$/, /transaction amount/]),
    debit: find([/debit/, /withdrawal/, /money out/]),
    credit: find([/credit(?!.*card)/, /deposit/, /money in/]),
    dateFormat: "YMD",
    flipSign: false,
  };
}

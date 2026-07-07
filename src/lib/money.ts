export type Currency = "USD" | "CAD";

// Parse a user-entered amount string ("1,234.56", "$12", "-4.20") to integer cents.
// Throws on anything that doesn't parse exactly — never guess money.
export function parseAmountToCents(input: string): number {
  const cleaned = input.trim().replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!/^-?\d*(\.\d{1,2})?$/.test(cleaned) || cleaned === "" || cleaned === "-") {
    throw new Error(`Not a valid amount: "${input}"`);
  }
  const negative = cleaned.startsWith("-");
  const [whole, frac = ""] = cleaned.replace("-", "").split(".");
  const wholeNum = Number(whole || "0");
  const fracNum = Number(frac.padEnd(2, "0") || "0");
  const cents = wholeNum * 100 + fracNum;
  if (!Number.isSafeInteger(cents)) throw new Error(`Amount out of range: "${input}"`);
  return negative ? -cents : cents;
}

export function formatCents(cents: number, currency: Currency, opts?: { sign?: boolean }): string {
  if (!Number.isInteger(cents)) throw new Error(`formatCents got a non-integer: ${cents}`);
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const wholeStr = whole.toLocaleString("en-US");
  const sym = currency === "USD" ? "US$" : "C$";
  const sign = cents < 0 ? "-" : opts?.sign && cents > 0 ? "+" : "";
  return `${sign}${sym}${wholeStr}.${frac}`;
}

// Convert cents between currencies with an explicit rate. Rounds half away from zero.
export function convertCents(cents: number, rate: number): number {
  if (!Number.isInteger(cents)) throw new Error(`convertCents got a non-integer: ${cents}`);
  if (!(rate > 0) || !Number.isFinite(rate)) throw new Error(`Invalid FX rate: ${rate}`);
  const raw = cents * rate;
  return raw >= 0 ? Math.round(raw) : -Math.round(-raw);
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => {
    if (!Number.isInteger(v)) throw new Error(`sumCents got a non-integer: ${v}`);
    return acc + v;
  }, 0);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

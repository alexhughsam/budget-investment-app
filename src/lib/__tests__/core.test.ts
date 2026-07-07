import { describe, expect, it } from "vitest";
import { convertCents, formatCents, parseAmountToCents, sumCents } from "../money";
import { cashbackEarnedCents, computeSplit } from "../invest";
import { dedupeHash, headerSignature, mapRow, normalizeDate } from "../csv";

describe("money", () => {
  it("parses user amounts to exact cents", () => {
    expect(parseAmountToCents("1,234.56")).toBe(123456);
    expect(parseAmountToCents("$12")).toBe(1200);
    expect(parseAmountToCents("-4.20")).toBe(-420);
    expect(parseAmountToCents("(50.00)")).toBe(-5000);
    expect(parseAmountToCents("0.07")).toBe(7);
  });
  it("rejects garbage instead of guessing", () => {
    expect(() => parseAmountToCents("12.345")).toThrow();
    expect(() => parseAmountToCents("abc")).toThrow();
    expect(() => parseAmountToCents("")).toThrow();
  });
  it("formats with currency symbols", () => {
    expect(formatCents(123456, "USD")).toBe("US$1,234.56");
    expect(formatCents(-50, "CAD")).toBe("-C$0.50");
    expect(formatCents(100, "USD", { sign: true })).toBe("+US$1.00");
  });
  it("rejects non-integer cents everywhere", () => {
    expect(() => formatCents(1.5, "USD")).toThrow();
    expect(() => sumCents([1, 2.5])).toThrow();
    expect(() => convertCents(10.1, 1.3)).toThrow();
  });
  it("converts symmetrically with round-half-away-from-zero", () => {
    expect(convertCents(100, 1.37)).toBe(137);
    expect(convertCents(-100, 1.37)).toBe(-137);
    expect(convertCents(1, 1.345)).toBe(1);
  });
});

describe("90/10 engine (reconciliation ground truth)", () => {
  it("caps the pick sleeve at 10% and funds it from cashback", () => {
    const s = computeSplit({
      investableCents: 500_000, // $5,000
      cashbackAvailableCents: 100_000, // $1,000 cashback — more than the cap
      pickCapPct: 10,
      etfTargets: [
        { symbol: "VTI", weightPct: 70 },
        { symbol: "VXUS", weightPct: 30 },
      ],
    });
    expect(s.pickCents).toBe(50_000); // capped at 10% of 5,000
    expect(s.etfCents).toBe(450_000);
    expect(s.etfLines.reduce((a, l) => a + l.cents, 0)).toBe(450_000); // exact split
    expect(s.etfLines[0]).toEqual({ symbol: "VTI", cents: 315_000 });
  });
  it("never exceeds 10% even when asked", () => {
    const s = computeSplit({ investableCents: 100_000, cashbackAvailableCents: 100_000, pickCapPct: 50, etfTargets: [] });
    expect(s.pickCapPct).toBe(10);
    expect(s.pickCents).toBe(10_000);
  });
  it("uses only available cashback when below the cap", () => {
    const s = computeSplit({ investableCents: 500_000, cashbackAvailableCents: 1_234, pickCapPct: 10, etfTargets: [] });
    expect(s.pickCents).toBe(1_234);
    expect(s.etfCents).toBe(498_766);
  });
  it("largest-remainder allocation sums exactly for awkward weights", () => {
    const s = computeSplit({
      investableCents: 100,
      cashbackAvailableCents: 0,
      pickCapPct: 10,
      etfTargets: [
        { symbol: "A", weightPct: 33 },
        { symbol: "B", weightPct: 33 },
        { symbol: "C", weightPct: 34 },
      ],
    });
    expect(s.etfLines.reduce((a, l) => a + l.cents, 0)).toBe(100);
  });
  it("computes Gold Card cashback at the verified 3% brokerage rate", () => {
    expect(cashbackEarnedCents(100_000)).toBe(3_000); // $1,000 spend → $30
    expect(cashbackEarnedCents(100_000, "statement")).toBe(2_100); // ~2.1%
  });
});

describe("csv import", () => {
  it("normalizes dates in multiple formats", () => {
    expect(normalizeDate("2026-07-03", "YMD")).toBe("2026-07-03");
    expect(normalizeDate("07/03/2026", "MDY")).toBe("2026-07-03");
    expect(normalizeDate("03/07/2026", "DMY")).toBe("2026-07-03");
    expect(normalizeDate("7/3/26", "MDY")).toBe("2026-07-03");
  });
  it("maps signed-amount rows", () => {
    const row = { Date: "2026-07-01", Description: "COFFEE", Amount: "-4.50" };
    expect(mapRow(row, { date: "Date", description: "Description", amount: "Amount", dateFormat: "YMD", flipSign: false })).toEqual({
      date: "2026-07-01",
      description: "COFFEE",
      amountCents: -450,
    });
  });
  it("maps debit/credit rows with outflow negative", () => {
    const mapping = { date: "Date", description: "Desc", amount: "", debit: "Debit", credit: "Credit", dateFormat: "YMD" as const, flipSign: false };
    expect(mapRow({ Date: "2026-07-01", Desc: "GROCERY", Debit: "84.20", Credit: "" }, mapping)?.amountCents).toBe(-8420);
    expect(mapRow({ Date: "2026-07-01", Desc: "PAYROLL", Debit: "", Credit: "2500.00" }, mapping)?.amountCents).toBe(250000);
  });
  it("flipSign inverts bank exports that show spending as positive", () => {
    const row = { Date: "2026-07-01", Description: "STORE", Amount: "10.00" };
    expect(mapRow(row, { date: "Date", description: "Description", amount: "Amount", dateFormat: "YMD", flipSign: true })?.amountCents).toBe(-1000);
  });
  it("dedupe hash is stable across whitespace/case noise, and re-import is a no-op", () => {
    const a = dedupeHash({ date: "2026-07-01", description: "TIM  HORTONS #42", amountCents: -450 });
    const b = dedupeHash({ date: "2026-07-01", description: "tim hortons #42", amountCents: -450 });
    const c = dedupeHash({ date: "2026-07-02", description: "TIM HORTONS #42", amountCents: -450 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it("header signatures identify an institution's format", () => {
    expect(headerSignature(["Date", "Description", "Amount"])).toBe(headerSignature([" date", "DESCRIPTION", "amount "]));
    expect(headerSignature(["Date", "Desc"])).not.toBe(headerSignature(["Date", "Description"]));
  });
});

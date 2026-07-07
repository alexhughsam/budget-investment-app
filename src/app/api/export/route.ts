import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { getAccounts, getCategories, getTransactions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await currentUser();
  if (!ctx) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { householdId } = ctx;
  const format = req.nextUrl.searchParams.get("format") ?? "json";

  if (format === "csv") {
    const txns = getTransactions(householdId, { limit: 100000 });
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      "date,account,description,merchant,category,amount,currency",
      ...txns.map((t) =>
        [t.date, esc(t.accountName), esc(t.description), esc(t.merchant ?? ""), esc(t.categoryName ?? ""), (t.amountCents / 100).toFixed(2), t.accountCurrency].join(","),
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hearth-transactions.csv"`,
      },
    });
  }

  const accounts = getAccounts(householdId);
  const ids = accounts.map((a) => a.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    household: db.select().from(schema.households).where(eq(schema.households.id, householdId)).all()[0],
    accounts,
    categories: getCategories(householdId),
    balances: ids.length ? db.select().from(schema.balanceSnapshots).where(inArray(schema.balanceSnapshots.accountId, ids)).all() : [],
    transactions: ids.length ? db.select().from(schema.transactions).where(inArray(schema.transactions.accountId, ids)).all() : [],
    holdings: ids.length ? db.select().from(schema.holdings).where(inArray(schema.holdings.accountId, ids)).all() : [],
    budgets: db.select().from(schema.budgets).where(eq(schema.budgets.householdId, householdId)).all(),
    recommendations: db.select().from(schema.recommendations).where(eq(schema.recommendations.householdId, householdId)).all(),
    cashback: db.select().from(schema.cashbackEntries).where(eq(schema.cashbackEntries.householdId, householdId)).all(),
    note: "All amounts are integer cents in each record's native currency.",
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="hearth-export.json"`,
    },
  });
}

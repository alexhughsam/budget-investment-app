import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// All monetary amounts are INTEGER CENTS in the account's native currency.
// House rule: a float never touches a currency amount.

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  displayCurrency: text("display_currency", { enum: ["USD", "CAD"] }).notNull().default("USD"),
  createdAt: integer("created_at").notNull(),
});

export const householdMembers = sqliteTable(
  "household_members",
  {
    householdId: text("household_id").notNull().references(() => households.id),
    userId: text("user_id").notNull().references(() => users.id),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  },
  (t) => [uniqueIndex("hm_unique").on(t.householdId, t.userId)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    ownerUserId: text("owner_user_id").references(() => users.id), // null = joint
    name: text("name").notNull(),
    institution: text("institution").notNull(),
    country: text("country", { enum: ["US", "CA"] }).notNull(),
    type: text("type", { enum: ["checking", "savings", "credit", "brokerage", "retirement"] }).notNull(),
    currency: text("currency", { enum: ["USD", "CAD"] }).notNull(),
    connectionSource: text("connection_source", {
      enum: ["manual", "csv", "mock", "plaid", "snaptrade", "questrade"],
    })
      .notNull()
      .default("manual"),
    createdAt: integer("created_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (t) => [index("accounts_household").on(t.householdId)],
);

export const balanceSnapshots = sqliteTable(
  "balance_snapshots",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    asOf: text("as_of").notNull(), // YYYY-MM-DD
    amountCents: integer("amount_cents").notNull(),
    source: text("source").notNull().default("manual"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("balance_unique").on(t.accountId, t.asOf), index("balance_account").on(t.accountId)],
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("tag"),
    kind: text("kind", { enum: ["expense", "income", "transfer", "investment"] }).notNull().default("expense"),
  },
  (t) => [uniqueIndex("cat_unique").on(t.householdId, t.name)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    date: text("date").notNull(), // YYYY-MM-DD
    description: text("description").notNull(),
    merchant: text("merchant"),
    amountCents: integer("amount_cents").notNull(), // negative = outflow
    categoryId: text("category_id").references(() => categories.id),
    categorySource: text("category_source", { enum: ["none", "ai", "user", "rule"] }).notNull().default("none"),
    importId: text("import_id"),
    dedupeHash: text("dedupe_hash").notNull(),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("txn_dedupe").on(t.accountId, t.dedupeHash),
    index("txn_account_date").on(t.accountId, t.date),
    index("txn_date").on(t.date),
  ],
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    categoryId: text("category_id").notNull().references(() => categories.id),
    month: text("month").notNull(), // YYYY-MM
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency", { enum: ["USD", "CAD"] }).notNull().default("USD"),
  },
  (t) => [uniqueIndex("budget_unique").on(t.householdId, t.categoryId, t.month)],
);

export const holdings = sqliteTable(
  "holdings",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    symbol: text("symbol").notNull(),
    name: text("name"),
    quantity: real("quantity").notNull(), // share quantity is not money; fractional shares allowed
    costBasisCents: integer("cost_basis_cents"),
    priceCents: integer("price_cents").notNull(),
    priceAsOf: text("price_as_of").notNull(), // YYYY-MM-DD
    currency: text("currency", { enum: ["USD", "CAD"] }).notNull(),
  },
  (t) => [uniqueIndex("holding_unique").on(t.accountId, t.symbol)],
);

export const fxRates = sqliteTable(
  "fx_rates",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(), // YYYY-MM-DD
    base: text("base").notNull(), // e.g. USD
    quote: text("quote").notNull(), // e.g. CAD
    rate: real("rate").notNull(), // rate itself is not money
    source: text("source").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
  },
  (t) => [uniqueIndex("fx_unique").on(t.date, t.base, t.quote)],
);

export const imports = sqliteTable("imports", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  filename: text("filename").notNull(),
  mappingJson: text("mapping_json").notNull(),
  rowCount: integer("row_count").notNull(),
  importedCount: integer("imported_count").notNull(),
  dupeCount: integer("dupe_count").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const importMappings = sqliteTable(
  "import_mappings",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    headerSignature: text("header_signature").notNull(),
    mappingJson: text("mapping_json").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("mapping_unique").on(t.householdId, t.headerSignature)],
);

// Append-only advisor log. body is immutable after insert; only status/outcome change.
export const recommendations = sqliteTable(
  "recommendations",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    kind: text("kind", { enum: ["allocation", "pick"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(), // markdown memo with cited data
    dataJson: text("data_json"),
    status: text("status", { enum: ["open", "accepted", "declined"] }).notNull().default("open"),
    decidedAt: integer("decided_at"),
    outcomeNote: text("outcome_note"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("rec_household").on(t.householdId)],
);

export const investmentSettings = sqliteTable("investment_settings", {
  householdId: text("household_id").primaryKey().references(() => households.id),
  etfTargetsJson: text("etf_targets_json").notNull().default("[]"), // [{symbol, weightPct, accountId}]
  pickBudgetPctCap: integer("pick_budget_pct_cap").notNull().default(10),
  etfAccountId: text("etf_account_id"),
  pickAccountId: text("pick_account_id"),
});

export const cashbackEntries = sqliteTable(
  "cashback_entries",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    month: text("month").notNull(), // YYYY-MM
    spendCents: integer("spend_cents").notNull(),
    redeemedCents: integer("redeemed_cents").notNull().default(0),
  },
  (t) => [uniqueIndex("cashback_unique").on(t.householdId, t.month)],
);

export const syncConnections = sqliteTable(
  "sync_connections",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull().references(() => households.id),
    provider: text("provider", { enum: ["mock", "plaid", "snaptrade", "questrade"] }).notNull(),
    status: text("status", { enum: ["ok", "stale", "error", "not_configured"] }).notNull(),
    lastSyncAt: integer("last_sync_at"),
    error: text("error"),
  },
  (t) => [uniqueIndex("conn_unique").on(t.householdId, t.provider)],
);

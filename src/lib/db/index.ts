import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

declare global {
  var __hearthDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sqlite = new Database(path.join(DATA_DIR, "hearth.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

// Singleton across dev hot reloads
export const db = globalThis.__hearthDb ?? (globalThis.__hearthDb = createDb());

export { schema };

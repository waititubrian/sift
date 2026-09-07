import Database from "better-sqlite3";
import path from "path";

const globalForDb = globalThis as unknown as { sift_db: Database.Database | undefined };

function createDb() {
  const file = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./dev.db";
  const dbPath = path.isAbsolute(file)
    ? file
    : path.join(/* turbopackIgnore: true */ process.cwd(), file);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      raw_message TEXT NOT NULL,
      raw_payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS ai_analysis (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL UNIQUE REFERENCES lead(id) ON DELETE CASCADE,
      intent_score INTEGER NOT NULL,
      temperature TEXT NOT NULL,
      summary TEXT NOT NULL,
      budget_mentioned INTEGER NOT NULL,
      timeline TEXT,
      pain_point TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      model_used TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS integration_log (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
      target TEXT NOT NULL,
      status TEXT NOT NULL,
      response_snippet TEXT NOT NULL,
      attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lead_created_at ON lead(created_at);
    CREATE INDEX IF NOT EXISTS idx_integration_log_lead_id ON integration_log(lead_id);
  `);
  return db;
}

export const db = globalForDb.sift_db ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.sift_db = db;

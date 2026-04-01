/**
 * Resolves Drizzle `db:push` conflicts (e.g. primary key / drift) by
 * recreating the public schema on a dedicated app database.
 * Loads DATABASE_URL from .env.local (same as drizzle.config.ts).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (.env.local missing or empty).");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

const tables = [
  "documents",
  "comparisons",
  "voice_notes",
  "property_notes",
  "inspections",
  "properties",
  "users",
];

async function resetByTables() {
  for (const t of tables) {
    await sql.unsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`);
  }
  await sql.unsafe(`DROP TYPE IF EXISTS "property_status" CASCADE`);
  console.log("Dropped PropTrackr tables and property_status enum.");
}

async function main() {
  try {
    await sql`SELECT 1`;
  } catch (e) {
    console.error("Cannot connect to Postgres:", e.message);
    process.exit(1);
  }

  try {
    await sql.unsafe(`DROP SCHEMA public CASCADE`);
    await sql.unsafe(`CREATE SCHEMA public`);
    await sql.unsafe(`GRANT ALL ON SCHEMA public TO public`);
    console.log("Recreated public schema (clean slate for db:push).");
  } catch (e) {
    console.warn(
      "Schema recreate failed (permissions?). Falling back to table drops:",
      e.message,
    );
    await resetByTables();
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

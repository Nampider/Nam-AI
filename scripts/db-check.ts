// Tells you exactly why the database connection fails (drizzle-kit hides the error).
// Run with: pnpm tsx scripts/db-check.ts
import { existsSync } from "node:fs";
import { Client } from "pg";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing from .env");
  process.exit(1);
}

const parsed = new URL(url);
console.log(
  `Connecting to host=${parsed.hostname} port=${parsed.port || 5432} db=${parsed.pathname.slice(1)} user=${parsed.username}`,
);

const hints: Record<string, string> = {
  ECONNREFUSED: "Nothing is listening on that port. Start the database with: pnpm db:up (then wait ~5 seconds).",
  ETIMEDOUT: "The host did not answer. Check the host and port in DATABASE_URL.",
  ENOTFOUND: "That hostname does not resolve. Check DATABASE_URL.",
  "28P01": "Password rejected: another Postgres is already using that port, probably from a different project. Either stop it, or move Nam-AI to port 5433 in docker-compose.yml and DATABASE_URL.",
  "28000": "That user does not exist on the server answering this port, so it is a different Postgres than you expect.",
  "3D000": "The server is up but has no database with that name. Docker: pnpm db:down && pnpm db:up. Homebrew: createdb namai.",
};

const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });

async function main() {
  await client.connect();
  const { rows } = await client.query("select version() as version, current_database() as db, current_user as usr");
  console.log("Connected.");
  console.log("  server:", String(rows[0].version).split(" ").slice(0, 2).join(" "));
  console.log("  database:", rows[0].db, "| user:", rows[0].usr);

  const { rows: tables } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  console.log("  tables:", tables.length === 0 ? "none yet — run pnpm db:migrate" : tables.map((t) => t.table_name).join(", "));
}

main()
  .catch((err) => {
    const e = err as NodeJS.ErrnoException;
    console.error("Could not connect:", e.message);
    const hint = e.code ? hints[e.code] : undefined;
    console.error(`\nWhat to do: ${hint ?? "check that the database is running and that DATABASE_URL matches it."}`);
    process.exitCode = 1;
  })
  .finally(() => client.end().catch(() => {}));

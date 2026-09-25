import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Dev hot-reload re-runs this file; reuse the pool instead of opening new connections each time.
const g = globalThis as unknown as { pgPool?: Pool };
const pool = g.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") g.pgPool = pool;

export const db = drizzle({ client: pool, schema });

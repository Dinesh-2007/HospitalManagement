import { Pool, type QueryResult, type QueryResultRow, types } from "pg";

// Force DATE (oid 1082) to be returned as a string (YYYY-MM-DD) instead of a Date object
// to prevent timezone shifting in JSON serialization.
types.setTypeParser(1082, (val) => val);

declare global {
  var __hsmsPool: Pool | undefined;
  var __tenantPools: Record<string, Pool> | undefined;
}

const pool =
  globalThis.__hsmsPool ??
  new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    ssl: process.env.SSL === "true",
  });

const tenantPools = globalThis.__tenantPools ?? {};

if (process.env.NODE_ENV !== "production") {
  globalThis.__hsmsPool = pool;
  globalThis.__tenantPools = tenantPools;
}

// Function to safely normalize database name
export function getSafeDbName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

export async function createTenantDbIfNotExists(hospitalName: string) {
  const safeDbName = getSafeDbName(hospitalName);

  // Check if DB exists
  const res = await pool.query(
    `SELECT datname FROM pg_catalog.pg_database WHERE datname = $1`,
    [safeDbName]
  );

  if (res.rowCount === 0) {
    // Create DB (needs raw string format without params since it's DDL)
    // Enclosed in quotes just in case, though safeDbName is alphanumeric
    await pool.query(`CREATE DATABASE "${safeDbName}"`);
  }

  return safeDbName;
}

export async function getTenantDB(hospitalName: string): Promise<Pool> {
  const safeDbName = getSafeDbName(hospitalName);

  if (tenantPools[safeDbName]) {
    return tenantPools[safeDbName];
  }

  // Create a new pool for this db
  const newPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: safeDbName,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    ssl: process.env.SSL === "true",
  });

  tenantPools[safeDbName] = newPool;
  return newPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export default pool;

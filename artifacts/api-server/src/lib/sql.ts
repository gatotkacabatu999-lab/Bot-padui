/**
 * pg-based tagged-template SQL helper — interface-compatible with neon's
 * tagged template so the ported API handler works without changes.
 */
import pg from "pg";

const { Pool } = pg;

// Lazily created pool; returns an unavailable shim when DATABASE_URL is absent.
let _pool: InstanceType<typeof Pool> | null = null;

function getPool() {
  const url = String(process.env["DATABASE_URL"] ?? "").trim();
  if (!url) return null;
  if (!_pool) {
    _pool = new Pool({ connectionString: url });
  }
  return _pool;
}

export type SqlTag = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

function createUnavailableSql(): SqlTag {
  return async () => {
    throw new Error("DATABASE_URL not configured");
  };
}

function createSql(pool: InstanceType<typeof Pool>): SqlTag {
  return async function sql(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) {
    let text = "";
    strings.forEach((str, i) => {
      text += str;
      if (i < values.length) {
        text += `$${i + 1}`;
      }
    });
    const result = await pool.query(text, values as unknown[]);
    return result.rows as Record<string, unknown>[];
  };
}

const pool = getPool();
export const sql: SqlTag = pool ? createSql(pool) : createUnavailableSql();

export function isDatabaseConfigured(): boolean {
  return Boolean(String(process.env["DATABASE_URL"] ?? "").trim());
}

#!/usr/bin/env node
import { createServer, tool, z } from '@mcp-toolkit/core';

const DATABASE_URL = process.env.DATABASE_URL || '';
const READ_ONLY = !process.argv.includes('--writable');

if (!DATABASE_URL) {
  process.stderr.write('ERROR: DATABASE_URL environment variable is required\n');
  process.exit(1);
}

function getDriver() {
  if (DATABASE_URL.startsWith('postgres')) return 'postgres';
  if (DATABASE_URL.startsWith('sqlite') || DATABASE_URL.endsWith('.db')) return 'sqlite';
  throw new Error(`Unsupported database URL: ${DATABASE_URL}`);
}

async function runQuery(sql: string): Promise<{ rows: unknown[]; rowCount: number }> {
  const driver = getDriver();

  if (driver === 'postgres') {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: DATABASE_URL });
    const result = await pool.query(sql);
    await pool.end();
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  }

  if (driver === 'sqlite') {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(DATABASE_URL.replace('sqlite://', ''));
    const stmt = db.prepare(sql);
    const rows = stmt.all();
    db.close();
    return { rows, rowCount: rows.length };
  }

  throw new Error('No driver matched');
}

const server = createServer({ name: 'mcp-database', version: '1.0.0' });

server.addTool(
  tool({
    name: 'query_database',
    description: READ_ONLY
      ? 'Run a read-only SQL query (SELECT only). Write operations are blocked.'
      : 'Run a SQL query against the database.',
    input: z.object({
      sql: z.string().describe('SQL query to execute'),
    }),
    run: async ({ sql }) => {
      const trimmed = sql.trim().toUpperCase();

      if (READ_ONLY && !trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        return {
          content: 'Write operations are blocked. Start the server with --writable to enable them.',
          isError: true,
        };
      }

      try {
        const { rows, rowCount } = await runQuery(sql);
        const preview = rows.slice(0, 50);
        const output = JSON.stringify(preview, null, 2);
        const note = rows.length > 50 ? `\n\n(showing 50 of ${rowCount} rows)` : '';
        return { content: `${rowCount} row(s) returned:\n\n${output}${note}` };
      } catch (err) {
        return { content: `Query failed: ${(err as Error).message}`, isError: true };
      }
    },
  })
);

server.addTool(
  tool({
    name: 'list_tables',
    description: 'List all tables in the database with their column names.',
    input: z.object({}),
    run: async () => {
      const driver = getDriver();
      let sql: string;

      if (driver === 'postgres') {
        sql = `
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `;
      } else {
        sql = `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
      }

      try {
        const { rows } = await runQuery(sql);
        return { content: JSON.stringify(rows, null, 2) };
      } catch (err) {
        return { content: `Failed: ${(err as Error).message}`, isError: true };
      }
    },
  })
);

server.start();

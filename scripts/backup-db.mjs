#!/usr/bin/env node
// Full data backup of Supabase public schema + auth.users.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/backup-db.mjs
// Output: backups/<timestamp>/ with one JSON file per table + manifest.json
//
// Schema (DDL) is already tracked in supabase/migrations/ — this dumps DATA only.

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_REF = 'qdxpkjgwdgxyszclxykf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN env var.');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const PAGE_SIZE = 2000;

async function runSql(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`SQL failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function listPublicTables() {
  const rows = await runSql(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name;`
  );
  return rows.map((r) => r.table_name);
}

async function getPrimaryKey(schema, table) {
  const rows = await runSql(`
    SELECT a.attname AS col
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = '${schema}."${table}"'::regclass AND i.indisprimary
    ORDER BY array_position(i.indkey, a.attnum);
  `);
  return rows.map((r) => r.col);
}

async function dumpTable(schema, table) {
  const pk = await getPrimaryKey(schema, table);
  const orderBy = pk.length
    ? `ORDER BY ${pk.map((c) => `"${c}"`).join(', ')}`
    : '';
  const all = [];
  let offset = 0;
  while (true) {
    const batch = await runSql(
      `SELECT * FROM ${schema}."${table}" ${orderBy} LIMIT ${PAGE_SIZE} OFFSET ${offset};`
    );
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function main() {
  const stamp = ts();
  const outDir = join('backups', stamp);
  await mkdir(outDir, { recursive: true });

  const tables = await listPublicTables();
  console.log(`Found ${tables.length} tables in public schema.`);

  const manifest = {
    created_at: new Date().toISOString(),
    project_ref: PROJECT_REF,
    tables: {},
  };

  for (const t of tables) {
    process.stdout.write(`  dumping public.${t} ... `);
    const rows = await dumpTable('public', t);
    await writeFile(
      join(outDir, `public.${t}.json`),
      JSON.stringify(rows, null, 2),
      'utf8'
    );
    manifest.tables[`public.${t}`] = rows.length;
    console.log(`${rows.length} rows`);
  }

  process.stdout.write(`  dumping auth.users ... `);
  const users = await runSql(`
    SELECT id, email, raw_user_meta_data, raw_app_meta_data,
           created_at, updated_at, last_sign_in_at, email_confirmed_at,
           phone, role, aud
    FROM auth.users ORDER BY created_at;
  `);
  await writeFile(
    join(outDir, 'auth.users.json'),
    JSON.stringify(users, null, 2),
    'utf8'
  );
  manifest.tables['auth.users'] = users.length;
  console.log(`${users.length} users`);

  await writeFile(
    join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log(`\nBackup complete → ${outDir}`);
  const total = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
  console.log(`Total rows dumped: ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

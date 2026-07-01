#!/usr/bin/env node
// Push a reload to every open BigRockHub tab on demand.
// Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/force-reload.mjs
//
// Deploys no longer auto-reload students' tabs (see main.jsx) — run this
// only when a change genuinely needs to reach everyone immediately.

const PROJECT_REF = 'qdxpkjgwdgxyszclxykf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN env var.');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

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

const now = new Date().toISOString();
await runSql(
  `UPDATE app_settings SET value = '${now}', updated_at = now() WHERE key = 'force_reload_at';`
);
console.log(`force_reload_at bumped to ${now} — open tabs will reload within ~60s (or on next focus).`);

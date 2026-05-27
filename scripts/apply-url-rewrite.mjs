// Step 2 of Cloudinary -> R2 migration: rewrite the DB columns.
// Reads backups/cloudinary_to_r2_map_<ts>.csv (latest) and updates every
// referenced column in one statement per column using a VALUES join.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=... node scripts/apply-url-rewrite.mjs [--apply] [--map=path.csv]
//
// Without --apply: dry-run (prints what would be updated, no DB write).

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_REF = 'qdxpkjgwdgxyszclxykf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('Missing SUPABASE_ACCESS_TOKEN'); process.exit(1); }

const APPLY = process.argv.includes('--apply');
const mapArg = process.argv.find(a => a.startsWith('--map='));

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
async function sql(q) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Locate the map CSV ─────────────────────────────────────────────
async function latestMap() {
  if (mapArg) return mapArg.slice('--map='.length);
  const entries = await readdir('backups');
  const csvs = entries.filter(n => n.startsWith('cloudinary_to_r2_map_') && n.endsWith('.csv')).sort();
  if (!csvs.length) throw new Error('No cloudinary_to_r2_map_*.csv found in backups/');
  return join('backups', csvs[csvs.length - 1]);
}

function parseCsv(s) {
  const lines = s.split(/\r?\n/).filter(Boolean);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // first two cols are URLs (no commas inside); split on first 2 commas
    const c1 = line.indexOf(',');
    const c2 = line.indexOf(',', c1 + 1);
    const c3 = line.indexOf(',', c2 + 1);
    if (c1 < 0 || c2 < 0 || c3 < 0) continue;
    out.push({
      old_url: line.slice(0, c1),
      new_url: line.slice(c1 + 1, c2),
      status: line.slice(c2 + 1, c3),
    });
  }
  return out;
}

// Postgres string-literal escape (single quotes -> double single quotes)
function esc(s) { return s.replace(/'/g, "''"); }

// ── Targets ────────────────────────────────────────────────────────
const PLAIN_URL_COLUMNS = [
  ['assets', 'ref_cloud_url'],
  ['assets', 'output_cloud_url'],
  ['image_annotations', 'image_url'],
  ['miro_wip_images', 'image_url'],
  ['pack_cards', 'image_url'],
  ['profiles', 'avatar_url'],
  ['shots', 'concept_image_url'],
  ['shots', 'ref_cloud_url'],
  ['shots', 'output_cloud_url'],
  ['shots', 'audio_url'],
  ['shots', 'video_url'],
  ['storyboard_stickers', 'image_url'],
];
const ARRAY_COLUMNS = [
  ['task_wip_updates', 'images'],
  ['task_wip_updates', 'pinned_storyboard_urls'],
];

async function main() {
  const mapPath = await latestMap();
  console.log(`Map CSV: ${mapPath}`);
  const csv = await readFile(mapPath, 'utf8');
  const rows = parseCsv(csv).filter(r => r.status === 'uploaded' || r.status === 'skipped_exists');
  console.log(`Mappings: ${rows.length}`);
  if (!rows.length) { console.error('No usable mappings.'); process.exit(1); }

  // Snapshot before mutating: dump the affected columns so we can compare
  // / rollback at row level if needed. Already covered by the full DB
  // backup, but a focused diff makes audits easy.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await mkdir('backups', { recursive: true });
  const snapshot = { taken_at: new Date().toISOString(), plain: {}, arrays: {} };
  console.log('\nTaking pre-rewrite snapshot of affected columns...');
  // SELECT * keeps the snapshot resilient to per-table PK quirks (e.g.
  // image_annotations has the URL itself as PK — no id column).
  for (const [t, c] of PLAIN_URL_COLUMNS) {
    const data = await sql(`SELECT * FROM public."${t}" WHERE "${c}" LIKE '%res.cloudinary.com%';`);
    snapshot.plain[`${t}.${c}`] = data;
    if (data.length) console.log(`  ${t}.${c}: ${data.length} rows`);
  }
  for (const [t, c] of ARRAY_COLUMNS) {
    const data = await sql(`SELECT * FROM public."${t}" WHERE EXISTS (SELECT 1 FROM unnest("${c}") u WHERE u LIKE '%res.cloudinary.com%');`);
    snapshot.arrays[`${t}.${c}`] = data;
    if (data.length) console.log(`  ${t}.${c}: ${data.length} rows (array)`);
  }
  const snapPath = join('backups', `pre_url_rewrite_${stamp}.json`);
  await writeFile(snapPath, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`  → ${snapPath}\n`);

  // Build the VALUES list once. Stringify safely.
  const valuesSql = rows.map(r => `('${esc(r.old_url)}','${esc(r.new_url)}')`).join(',\n  ');

  console.log(APPLY ? 'APPLY mode: writing changes\n' : 'DRY-RUN: counts only, no writes\n');
  let totalUpdates = 0;

  // Plain URL columns: single UPDATE per column via VALUES join.
  for (const [t, c] of PLAIN_URL_COLUMNS) {
    const previewQ = `
      WITH m(old_url, new_url) AS (VALUES ${valuesSql})
      SELECT COUNT(*)::int AS n FROM public."${t}" p
      JOIN m ON p."${c}" = m.old_url;
    `;
    const before = await sql(previewQ);
    const n = before[0].n;
    if (!APPLY) {
      console.log(`  ${t}.${c}: would update ${n} rows`);
      totalUpdates += n;
      continue;
    }
    if (n === 0) { console.log(`  ${t}.${c}: 0 (skip)`); continue; }
    const upd = `
      WITH m(old_url, new_url) AS (VALUES ${valuesSql})
      UPDATE public."${t}" p
      SET "${c}" = m.new_url
      FROM m
      WHERE p."${c}" = m.old_url;
    `;
    await sql(upd);
    console.log(`  ${t}.${c}: ${n} rows updated`);
    totalUpdates += n;
  }

  // Array columns: rebuild the array using a LEFT JOIN to the map.
  for (const [t, c] of ARRAY_COLUMNS) {
    const previewQ = `
      WITH m(old_url, new_url) AS (VALUES ${valuesSql})
      SELECT COUNT(DISTINCT p.id)::int AS n FROM public."${t}" p
      JOIN LATERAL unnest(p."${c}") u(url) ON TRUE
      JOIN m ON m.old_url = u.url;
    `;
    const before = await sql(previewQ);
    const n = before[0].n;
    if (!APPLY) {
      console.log(`  ${t}.${c}: would update ${n} rows (array)`);
      totalUpdates += n;
      continue;
    }
    if (n === 0) { console.log(`  ${t}.${c}: 0 (skip)`); continue; }
    const upd = `
      WITH m(old_url, new_url) AS (VALUES ${valuesSql})
      UPDATE public."${t}" p
      SET "${c}" = sub.new_arr
      FROM (
        SELECT t.id, array_agg(COALESCE(m.new_url, u.url) ORDER BY u.ord) AS new_arr
        FROM public."${t}" t
        JOIN LATERAL unnest(t."${c}") WITH ORDINALITY u(url, ord) ON TRUE
        LEFT JOIN m ON m.old_url = u.url
        WHERE EXISTS (SELECT 1 FROM unnest(t."${c}") x WHERE x LIKE '%res.cloudinary.com%')
        GROUP BY t.id
      ) sub
      WHERE p.id = sub.id;
    `;
    await sql(upd);
    console.log(`  ${t}.${c}: ${n} rows updated (array)`);
    totalUpdates += n;
  }

  // Post-check: count remaining Cloudinary URLs anywhere.
  if (APPLY) {
    console.log('\nPost-rewrite scan: any Cloudinary URL left?');
    let leftover = 0;
    for (const [t, c] of PLAIN_URL_COLUMNS) {
      const r = await sql(`SELECT COUNT(*)::int AS n FROM public."${t}" WHERE "${c}" LIKE '%res.cloudinary.com%';`);
      if (r[0].n) { console.log(`  ${t}.${c}: ${r[0].n} REMAINING`); leftover += r[0].n; }
    }
    for (const [t, c] of ARRAY_COLUMNS) {
      const r = await sql(`SELECT COUNT(*)::int AS n FROM public."${t}" WHERE EXISTS (SELECT 1 FROM unnest("${c}") u WHERE u LIKE '%res.cloudinary.com%');`);
      if (r[0].n) { console.log(`  ${t}.${c}: ${r[0].n} ROWS WITH LEFTOVER URLS`); leftover += r[0].n; }
    }
    if (!leftover) console.log('  ✓ clean — no Cloudinary URLs left in any tracked column.');
  }

  console.log(`\nTotal ${APPLY ? 'updated' : 'planned'}: ${totalUpdates}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

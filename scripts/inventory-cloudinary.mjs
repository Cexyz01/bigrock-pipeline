// Read-only audit: count Cloudinary URLs across every column that could
// plausibly contain one. Writes a JSON report to backups/cloudinary_inventory_<ts>.json
//
// Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/inventory-cloudinary.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_REF = 'qdxpkjgwdgxyszclxykf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
async function runSql(q) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`);
  return r.json();
}

const LIKE = `'%res.cloudinary.com%'`;

// Plain text columns where the *whole value* is a single URL.
const URL_COLUMNS = [
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

// ARRAY-of-text columns where each element is a URL.
const ARRAY_COLUMNS = [
  ['task_wip_updates', 'images'],
  ['task_wip_updates', 'pinned_storyboard_urls'],
];

// Free-text columns that may EMBED a Cloudinary URL inside markdown.
const TEXT_BODY_COLUMNS = [
  ['comments', 'body'],
  ['chat_messages', 'body'],
  ['direct_messages', 'body'],
  ['super_notifications', 'message'],
  ['tasks', 'description'],
  ['tasks', 'review_description'],
  ['tasks', 'revision_comment'],
  ['notifications', 'body'],
];

// JSONB columns: cast to text and grep.
const JSONB_COLUMNS = [
  ['notifications', 'meta'],
  ['mini_games', 'game_state'],
  ['tasks', 'slide_layout'],
  ['pack_generated_packs', 'cards'],
];

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = { generated_at: new Date().toISOString(), columns: [] };
  let totalUrls = 0;

  console.log('=== Cloudinary URL inventory ===\n');

  // Plain URL columns: each non-null row is 1 URL (if it contains cloudinary)
  for (const [t, c] of URL_COLUMNS) {
    const rows = await runSql(
      `SELECT COUNT(*)::int AS n FROM public."${t}" WHERE "${c}" LIKE ${LIKE};`
    );
    const n = rows[0].n;
    out.columns.push({ table: t, column: c, kind: 'url', urls: n });
    totalUrls += n;
    console.log(`  ${t}.${c} (url)       ${n}`);
  }

  // ARRAY columns: unnest then count cloudinary URLs
  for (const [t, c] of ARRAY_COLUMNS) {
    const rows = await runSql(
      `SELECT COUNT(*)::int AS n FROM (
         SELECT unnest("${c}") AS u FROM public."${t}"
       ) s WHERE u LIKE ${LIKE};`
    );
    const n = rows[0].n;
    out.columns.push({ table: t, column: c, kind: 'array', urls: n });
    totalUrls += n;
    console.log(`  ${t}.${c} (array)     ${n}`);
  }

  // Text-body columns: count cloudinary URL occurrences via the
  // LENGTH - LENGTH(REPLACE) trick (counts the marker substring, not full
  // URLs — but res.cloudinary.com appears exactly once per URL).
  for (const [t, c] of TEXT_BODY_COLUMNS) {
    const rows = await runSql(
      `SELECT COALESCE(SUM((LENGTH("${c}") - LENGTH(REPLACE("${c}", 'res.cloudinary.com', ''))) / LENGTH('res.cloudinary.com')), 0)::int AS n
       FROM public."${t}" WHERE "${c}" LIKE ${LIKE};`
    );
    const n = rows[0].n;
    out.columns.push({ table: t, column: c, kind: 'embedded_text', urls: n });
    totalUrls += n;
    console.log(`  ${t}.${c} (text body) ${n}`);
  }

  // JSONB columns — same trick on the ::text serialization
  for (const [t, c] of JSONB_COLUMNS) {
    const rows = await runSql(
      `SELECT COALESCE(SUM((LENGTH("${c}"::text) - LENGTH(REPLACE("${c}"::text, 'res.cloudinary.com', ''))) / LENGTH('res.cloudinary.com')), 0)::int AS n
       FROM public."${t}" WHERE "${c}"::text LIKE ${LIKE};`
    );
    const n = rows[0].n;
    out.columns.push({ table: t, column: c, kind: 'jsonb', urls: n });
    totalUrls += n;
    console.log(`  ${t}.${c} (jsonb)     ${n}`);
  }

  // Distinct URL count across everything (so we know how many UNIQUE files
  // need migrating — many rows reuse the same Cloudinary URL).
  // For text bodies + JSONB, we need regexp_matches in a LATERAL subquery
  // to avoid the aggregate/set-returning conflict.
  // Text-body + JSONB columns all returned zero in the per-column scan above,
  // so the unique-URL summary only needs the URL and ARRAY columns. Keeping
  // the UNION compact also avoids tripping the Management API timeout.
  const allUrlsQuery = `
    WITH all_urls AS (
      ${URL_COLUMNS.map(([t, c]) => `SELECT "${c}" AS url FROM public."${t}" WHERE "${c}" LIKE ${LIKE}`).join('\n      UNION ALL\n      ')}
      UNION ALL
      ${ARRAY_COLUMNS.map(([t, c]) => `SELECT unnest("${c}") AS url FROM public."${t}"`).join('\n      UNION ALL\n      ')}
    )
    SELECT
      COUNT(*) FILTER (WHERE url IS NOT NULL AND url LIKE 'https://res.cloudinary.com/%') AS total_refs,
      COUNT(DISTINCT url) FILTER (WHERE url IS NOT NULL AND url LIKE 'https://res.cloudinary.com/%') AS unique_urls
    FROM all_urls;
  `;
  const summary = await runSql(allUrlsQuery);
  out.summary = {
    total_references: Number(summary[0].total_refs),
    unique_urls: Number(summary[0].unique_urls),
    sum_per_column: totalUrls,
  };

  console.log(`\n  total references across all columns: ${out.summary.total_references}`);
  console.log(`  unique Cloudinary URLs to migrate:    ${out.summary.unique_urls}`);

  // Sample 10 distinct URLs so we can sanity-check their format
  const samples = await runSql(`
    WITH all_urls AS (
      ${URL_COLUMNS.map(([t, c]) => `SELECT "${c}" AS url FROM public."${t}" WHERE "${c}" LIKE ${LIKE}`).join('\n      UNION ALL\n      ')}
      UNION ALL
      ${ARRAY_COLUMNS.map(([t, c]) => `SELECT unnest("${c}") FROM public."${t}"`).join('\n      UNION ALL\n      ')}
    )
    SELECT DISTINCT url FROM all_urls
    WHERE url LIKE 'https://res.cloudinary.com/%'
    ORDER BY url LIMIT 10;
  `);
  out.samples = samples.map(r => r.url);
  console.log('\n  sample URLs:');
  for (const s of samples.slice(0, 5)) console.log(`    ${s.url}`);

  await mkdir('backups', { recursive: true });
  const reportPath = join('backups', `cloudinary_inventory_${stamp}.json`);
  await writeFile(reportPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n  → report saved: ${reportPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

// Cloudinary -> R2 migration.
//
// Step 1 (this script): downloads every Cloudinary asset referenced in the
// DB and uploads it to R2 with a deterministic key. Writes a CSV mapping
// old_url -> new_url. Does NOT modify the DB.
//
// Step 2 (separate script): rewrites the DB columns using that CSV.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=... \
//   R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_ENDPOINT=... \
//   R2_BUCKET=... R2_PUBLIC_URL=... \
//   node scripts/migrate-cloudinary-to-r2.mjs [--apply]
//
// Without --apply this is a dry-run: lists URLs, doesn't download or upload.

import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// ── Env ─────────────────────────────────────────────────────────────
const PROJECT_REF = 'qdxpkjgwdgxyszclxykf';
const {
  SUPABASE_ACCESS_TOKEN,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_BUCKET,
  R2_PUBLIC_URL,
} = process.env;

if (!SUPABASE_ACCESS_TOKEN || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET || !R2_PUBLIC_URL) {
  console.error('Missing env. Need SUPABASE_ACCESS_TOKEN + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_ENDPOINT + R2_BUCKET + R2_PUBLIC_URL');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const PUBLIC_URL = R2_PUBLIC_URL.replace(/\/$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const SUPA = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
async function sql(q) {
  const r = await fetch(SUPA, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Distinct Cloudinary URLs from the DB ───────────────────────────
async function listAllUrls() {
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
  const ARRAY_COLUMNS = [
    ['task_wip_updates', 'images'],
    ['task_wip_updates', 'pinned_storyboard_urls'],
  ];
  const LIKE = `'%res.cloudinary.com%'`;
  const q = `
    WITH all_urls AS (
      ${URL_COLUMNS.map(([t, c]) => `SELECT "${c}" AS url FROM public."${t}" WHERE "${c}" LIKE ${LIKE}`).join('\n      UNION ALL\n      ')}
      UNION ALL
      ${ARRAY_COLUMNS.map(([t, c]) => `SELECT unnest("${c}") AS url FROM public."${t}"`).join('\n      UNION ALL\n      ')}
    )
    SELECT DISTINCT url FROM all_urls
    WHERE url IS NOT NULL AND url LIKE 'https://res.cloudinary.com/%'
    ORDER BY url;
  `;
  const rows = await sql(q);
  return rows.map(r => r.url);
}

// ── Key derivation ─────────────────────────────────────────────────
// Cloudinary URL anatomy:
//   https://res.cloudinary.com/<cloud>/<resource>/upload/[v<ver>/]<folder>/<id>.<ext>
//   https://res.cloudinary.com/<cloud>/<resource>/upload/<transform>/v<ver>/<folder>/<id>.<ext>
//
// We strip the cloud/resource/upload prefix and any /v<digits>/ version
// segment (and any transform segments). Whatever remains is used as the R2
// object key, prefixed with cloudinary/ so the bucket is tidy.
function urlToR2Key(url) {
  const u = new URL(url);
  // path: /<cloud>/<resource>/upload/.../v123/folder/id.ext
  const parts = u.pathname.split('/').filter(Boolean);
  // drop <cloud> <resource> upload
  let i = 0;
  if (parts[i]) i++;          // cloud
  if (parts[i]) i++;          // resource type (image/video/raw)
  if (parts[i] === 'upload' || parts[i] === 'authenticated' || parts[i] === 'private') i++;
  // drop any leading transform segments (anything before v<digits>)
  while (i < parts.length && !/^v\d+$/.test(parts[i])) {
    // safety: if there's no version at all (rare), break
    if (parts[i].includes('.')) break;
    i++;
  }
  if (i < parts.length && /^v\d+$/.test(parts[i])) i++;  // drop v<ver>
  const rest = parts.slice(i).join('/');
  return `cloudinary/${rest}`;
}

function extFromUrl(url) {
  const u = new URL(url);
  const last = u.pathname.split('/').pop() || '';
  const dot = last.lastIndexOf('.');
  return dot >= 0 ? last.slice(dot + 1).toLowerCase() : '';
}

const CT_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
  pdf: 'application/pdf',
};

// ── Existence + transfer helpers ──────────────────────────────────
async function r2Has(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return false;
    throw e;
  }
}

async function downloadBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { buf, contentType: r.headers.get('content-type') || null };
}

async function uploadToR2(key, buf, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buf,
    ContentType: contentType || 'application/octet-stream',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

// ── Main ──────────────────────────────────────────────────────────
function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function main() {
  const stamp = ts();
  await mkdir('backups', { recursive: true });
  const mapPath = join('backups', `cloudinary_to_r2_map_${stamp}.csv`);
  const errPath = join('backups', `cloudinary_to_r2_errors_${stamp}.json`);

  console.log(`Mode: ${APPLY ? 'APPLY (downloads + uploads)' : 'DRY-RUN (no network, no writes)'}`);
  console.log(`Listing Cloudinary URLs from DB...`);
  const urls = await listAllUrls();
  console.log(`  found ${urls.length} distinct URLs\n`);

  const rows = ['old_url,new_url,status,bytes,error'];
  const errors = [];
  let ok = 0, skipped = 0, failed = 0;
  let bytesTotal = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const key = urlToR2Key(url);
    const newUrl = `${PUBLIC_URL}/${key}`;
    const ext = extFromUrl(url);
    const ct = CT_BY_EXT[ext] || null;
    const tag = `[${i + 1}/${urls.length}]`;

    if (!APPLY) {
      console.log(`${tag} ${url}`);
      console.log(`     → ${newUrl}`);
      rows.push([url, newUrl, 'planned', '', ''].join(','));
      continue;
    }

    try {
      const exists = await r2Has(key);
      if (exists) {
        console.log(`${tag} SKIP (already in R2) ${key}`);
        rows.push([url, newUrl, 'skipped_exists', '', ''].join(','));
        skipped++;
        continue;
      }
      const { buf, contentType } = await downloadBuffer(url);
      await uploadToR2(key, buf, ct || contentType);
      bytesTotal += buf.length;
      ok++;
      console.log(`${tag} OK ${buf.length}B → ${key}`);
      rows.push([url, newUrl, 'uploaded', String(buf.length), ''].join(','));
    } catch (e) {
      failed++;
      const msg = String(e?.message || e).replace(/[\r\n,]+/g, ' ');
      errors.push({ url, key, error: msg });
      console.error(`${tag} FAIL ${url} :: ${msg}`);
      rows.push([url, newUrl, 'failed', '', JSON.stringify(msg)].join(','));
    }
  }

  await writeFile(mapPath, rows.join('\n'), 'utf8');
  console.log(`\nMap CSV: ${mapPath}`);

  if (errors.length) {
    await writeFile(errPath, JSON.stringify(errors, null, 2), 'utf8');
    console.log(`Errors:  ${errPath}`);
  }

  console.log(`\nSummary: planned=${urls.length} uploaded=${ok} skipped=${skipped} failed=${failed} bytes=${(bytesTotal / 1024 / 1024).toFixed(1)}MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// BACKFILL THUMBNAILS — one-time pass over the R2 bucket.
//
// For every existing raster original it generates the `<key>_t512.webp`
// sibling that the storyboard now paints first (see src/lib/thumbs.js). New
// uploads already create their own thumb on the client; this catches the
// historical images so the board is fast immediately, not just for new assets.
//
// Idempotent + resumable: thumbs that already exist are skipped, so you can
// re-run it any time (e.g. after adding more images).
//
// Usage (PowerShell):
//   $env:R2_ACCOUNT_ID="..."; $env:R2_ACCESS_KEY_ID="..."; `
//   $env:R2_SECRET_ACCESS_KEY="..."; $env:R2_BUCKET="bigrockhub-media"; `
//   node scripts/backfill-thumbs.mjs
//
// Deps: npm i -D @aws-sdk/client-s3 sharp
// ════════════════════════════════════════════════════════════════════

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET || 'bigrockhub-media'

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  console.error('Missing env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
  process.exit(1)
}

// Keep these in sync with src/lib/thumbs.js + the signer's THUMB_KEY_RE.
const THUMB_SUFFIX = '_t512.webp'
const THUMB_MAX_EDGE = 512
const RASTER_RE = /\.(jpe?g|png|webp|bmp|avif|tiff?)$/i
const PREFIX_RE = /^(concepts|outputs|timeline|wip|stickers|cards|chat|avatars)\//i
const CACHE_CONTROL = 'public, max-age=31536000, immutable'
const CONCURRENCY = 8

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
})

async function listAllKeys() {
  const keys = []
  let token
  do {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token, MaxKeys: 1000 }))
    for (const o of out.Contents || []) keys.push(o.Key)
    token = out.IsTruncated ? out.NextContinuationToken : undefined
  } while (token)
  return keys
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', c => chunks.push(c))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

async function makeThumb(key) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const input = await streamToBuffer(obj.Body)
  const webp = await sharp(input, { failOn: 'none' })
    .rotate() // honor EXIF orientation
    .resize({ width: THUMB_MAX_EDGE, height: THUMB_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer()
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${key}${THUMB_SUFFIX}`,
    Body: webp,
    ContentType: 'image/webp',
    CacheControl: CACHE_CONTROL,
  }))
  return webp.length
}

async function main() {
  console.log('Listing objects…')
  const all = await listAllKeys()
  const existing = new Set(all.filter(k => k.endsWith(THUMB_SUFFIX)))
  const targets = all.filter(k =>
    !k.endsWith(THUMB_SUFFIX) &&
    PREFIX_RE.test(k) &&
    RASTER_RE.test(k) &&
    !existing.has(`${k}${THUMB_SUFFIX}`)
  )
  console.log(`Total objects: ${all.length} | thumbs present: ${existing.size} | to generate: ${targets.length}`)

  let done = 0, failed = 0, bytes = 0
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async key => {
      try {
        bytes += await makeThumb(key)
        done++
      } catch (e) {
        failed++
        console.warn(`  ✗ ${key}: ${e.message || e}`)
      }
    }))
    process.stdout.write(`\r  ${done + failed}/${targets.length} (ok ${done}, fail ${failed})   `)
  }
  console.log(`\nDone. Generated ${done} thumbs (${(bytes / 1048576).toFixed(1)} MB), ${failed} failed.`)
}

main().catch(e => { console.error(e); process.exit(1) })

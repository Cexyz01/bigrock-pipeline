// Smoke test: verify R2 credentials by uploading a tiny file and
// reading it back via the public URL.
//
// Usage:
//   R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_ENDPOINT=... \
//     R2_BUCKET=... R2_PUBLIC_URL=... node scripts/r2-smoke-test.mjs

import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_BUCKET,
  R2_PUBLIC_URL,
} = process.env;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET || !R2_PUBLIC_URL) {
  console.error('Missing one of R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_URL');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const key = `_smoke/test-${Date.now()}.txt`;
const body = `BigRockHub R2 smoke test — ${new Date().toISOString()}`;

console.log(`→ PUT ${key} (${body.length} bytes)`);
await s3.send(new PutObjectCommand({
  Bucket: R2_BUCKET,
  Key: key,
  Body: body,
  ContentType: 'text/plain; charset=utf-8',
}));
console.log('  ok');

console.log(`→ HEAD ${key}`);
const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
console.log(`  size=${head.ContentLength} type=${head.ContentType} etag=${head.ETag}`);

const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
console.log(`→ GET (public) ${publicUrl}`);
const res = await fetch(publicUrl);
const txt = await res.text();
console.log(`  status=${res.status} ok=${res.ok} body=${JSON.stringify(txt)}`);
if (!res.ok || txt !== body) {
  console.error('  ✗ public read mismatch');
  process.exit(2);
}

console.log(`→ DELETE ${key}`);
await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
console.log('  ok');

console.log('\n✓ R2 smoke test passed — credentials and public access both work.');

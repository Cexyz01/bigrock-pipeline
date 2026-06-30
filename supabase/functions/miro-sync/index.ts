import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20"

// ══════════════════════════════════════════════════════════════
// CONFIG
//
// NOTE: this function is still named `miro-sync` for backwards
// compatibility (the name is baked into the client URLs and the
// deployed function), but Miro is gone — it's now a general-purpose
// backend for R2 upload signing, student pre-registration and WIP
// deletion. The `miro_wip_images` table it touches is likewise a
// legacy name for the storyboard rows table.
// ══════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""

// ── Cloudflare R2 (sole media backend — Cloudinary fully removed) ──
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || ""
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || ""
const R2_ENDPOINT = (Deno.env.get("R2_ENDPOINT") || "").replace(/\/$/, "")
const R2_BUCKET = Deno.env.get("R2_BUCKET") || ""
const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") || "").replace(/\/$/, "")

const r2 = R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
  ? new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    })
  : null

// ══════════════════════════════════════════════════════════════
// RESPONSE HELPERS
// ══════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function ok(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ══════════════════════════════════════════════════════════════
// R2 PRESIGNED UPLOAD — single endpoint for every new upload kind.
// Client posts { kind, ext, content_type, ...metadata }; we return a
// presigned PUT URL valid for 5 min plus the public URL the client
// should store in the DB once the upload completes.
// ══════════════════════════════════════════════════════════════

function randomId(len = 16): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let s = ""
  for (const b of bytes) s += b.toString(36).padStart(2, "0").slice(-2)
  return s.slice(0, len)
}

function safeExt(ext: string): string {
  return (ext || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 6) || "bin"
}

function r2KeyFor(kind: string, params: any, ext: string): string | null {
  const e = safeExt(ext)
  const id = randomId()
  switch (kind) {
    case "card":     return params.card_number != null ? `cards/${String(params.card_number).replace(/[^0-9a-zA-Z_-]/g, "")}/${id}.${e}` : null
    case "wip":      return params.task_id ? `wip/${params.task_id}/${id}.${e}` : null
    case "concept":  return params.shot_id ? `concepts/${params.shot_id}/${id}.${e}` : null
    case "output":   return params.shot_id ? `outputs/${params.shot_id}/${id}.${e}` : null
    case "timeline": return params.shot_id ? `timeline/${params.shot_id}/${id}.${e}` : null
    case "sticker":  return params.project_id ? `stickers/${params.project_id}/${id}.${e}` : null
    case "avatar":   return params.user_id ? `avatars/${params.user_id}/${id}.${e}` : null
    case "chat":     return `chat/${id}.${e}`
    default: return null
  }
}

async function handleR2SignUpload(params: any) {
  if (!r2 || !R2_BUCKET || !R2_ENDPOINT || !R2_PUBLIC_URL) return err("R2 not configured", 500)
  const { kind, ext, content_type } = params
  if (!kind) return err("Missing kind")
  const key = r2KeyFor(kind, params, ext || "")
  if (!key) return err(`Missing required field for kind=${kind}`)

  // Presigned PUT URL via AWS SigV4 (query-string signature, 5 min TTL).
  // Every header we sign here MUST be echoed verbatim by the client on the PUT,
  // otherwise R2 rejects the request with a SignatureDoesNotMatch error.
  //
  // We bake in a long, immutable Cache-Control: R2 keys are content-addressed
  // (random id per upload, never overwritten), so a stored object never changes
  // — the browser can cache it for a year and skip revalidation entirely. This
  // is what stops the storyboard from re-fetching every image on each visit.
  const CACHE_CONTROL = "public, max-age=31536000, immutable"
  const putHeaders: Record<string, string> = { "Cache-Control": CACHE_CONTROL }
  if (content_type) putHeaders["Content-Type"] = content_type
  const url = new URL(`${R2_ENDPOINT}/${R2_BUCKET}/${key}`)
  url.searchParams.set("X-Amz-Expires", "300")
  const signed = await r2.sign(
    new Request(url.toString(), { method: "PUT", headers: putHeaders }),
    { aws: { signQuery: true } },
  )
  return ok({
    upload_url: signed.url,
    public_url: `${R2_PUBLIC_URL}/${key}`,
    key,
    method: "PUT",
    headers: putHeaders,
  })
}

// ══════════════════════════════════════════════════════════════
// R2 THUMBNAIL UPLOAD — presigns a PUT to `<key>_t512.webp` so the client
// can store a small WebP sibling next to a raster original. Keep the suffix
// and prefix allowlist in sync with src/lib/thumbs.js + scripts/backfill-thumbs.mjs.
// ══════════════════════════════════════════════════════════════

const THUMB_SUFFIX = "_t512.webp"
const THUMB_KEY_RE = /^(concepts|outputs|timeline|wip|stickers|cards|chat|avatars)\/[^?#]+\.(jpe?g|png|webp|bmp|avif|tiff?)$/i

async function handleR2SignThumb(params: any) {
  if (!r2 || !R2_BUCKET || !R2_ENDPOINT || !R2_PUBLIC_URL) return err("R2 not configured", 500)
  const key = typeof params.key === "string" ? params.key : ""
  if (!key || key.includes("..") || key.startsWith("/")) return err("Invalid key")
  if (key.includes(THUMB_SUFFIX)) return err("Key is already a thumb")
  if (!THUMB_KEY_RE.test(key)) return err("Key is not an allowed raster object")

  const thumbKey = `${key}${THUMB_SUFFIX}`
  const CACHE_CONTROL = "public, max-age=31536000, immutable"
  const putHeaders: Record<string, string> = { "Cache-Control": CACHE_CONTROL, "Content-Type": "image/webp" }
  const url = new URL(`${R2_ENDPOINT}/${R2_BUCKET}/${thumbKey}`)
  url.searchParams.set("X-Amz-Expires", "300")
  const signed = await r2.sign(
    new Request(url.toString(), { method: "PUT", headers: putHeaders }),
    { aws: { signQuery: true } },
  )
  return ok({
    upload_url: signed.url,
    public_url: `${R2_PUBLIC_URL}/${thumbKey}`,
    key: thumbKey,
    method: "PUT",
    headers: putHeaders,
  })
}

// ══════════════════════════════════════════════════════════════
// R2 USAGE — scan the bucket via ListObjectsV2 and aggregate stats
// for the Manager page. No Cloudflare Analytics call yet (would need
// a separate API token); operations counts (Class A/B) are not
// reported. Storage breakdown by top-level prefix.
// ══════════════════════════════════════════════════════════════

// Minimal XML helpers — R2's S3 list endpoint always returns XML.
function xmlMatchAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g")
  const out: string[] = []
  let m
  while ((m = re.exec(xml)) !== null) out.push(m[1])
  return out
}
function xmlFirst(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
  const m = re.exec(xml)
  return m ? m[1] : null
}

async function handleR2Usage() {
  if (!r2 || !R2_BUCKET || !R2_ENDPOINT) return err("R2 not configured", 500)

  let totalBytes = 0
  let totalObjects = 0
  const byPrefix: Record<string, { bytes: number, count: number }> = {}
  let continuationToken: string | undefined = undefined
  let pages = 0

  // Hard cap to avoid runaway: 50 pages × 1000 = 50k objects.
  while (pages < 50) {
    pages++
    const url = new URL(`${R2_ENDPOINT}/${R2_BUCKET}`)
    url.searchParams.set("list-type", "2")
    url.searchParams.set("max-keys", "1000")
    if (continuationToken) url.searchParams.set("continuation-token", continuationToken)

    const signed = await r2.sign(new Request(url.toString(), { method: "GET" }))
    const res = await fetch(signed.url, { method: "GET", headers: signed.headers })
    if (!res.ok) {
      const body = await res.text()
      return err(`R2 list failed (${res.status}): ${body.slice(0, 300)}`, 500)
    }
    const xml = await res.text()

    // Each <Contents> block contains <Key>, <Size>, <LastModified>, <ETag>.
    const contents = xmlMatchAll(xml, "Contents")
    for (const block of contents) {
      const key = xmlFirst(block, "Key") || ""
      const sizeStr = xmlFirst(block, "Size") || "0"
      const size = parseInt(sizeStr, 10) || 0
      const prefix = key.split("/")[0] || "(root)"
      totalBytes += size
      totalObjects++
      if (!byPrefix[prefix]) byPrefix[prefix] = { bytes: 0, count: 0 }
      byPrefix[prefix].bytes += size
      byPrefix[prefix].count++
    }

    const truncated = (xmlFirst(xml, "IsTruncated") || "false").toLowerCase() === "true"
    if (!truncated) break
    continuationToken = xmlFirst(xml, "NextContinuationToken") || undefined
    if (!continuationToken) break
  }

  // R2 free-tier limits + per-GB cost beyond free tier.
  const FREE_GB = 10
  const COST_PER_GB = 0.015
  const usedGb = totalBytes / (1024 * 1024 * 1024)
  const pctFree = (usedGb / FREE_GB) * 100
  const billableGb = Math.max(0, usedGb - FREE_GB)
  const estMonthlyCost = +(billableGb * COST_PER_GB).toFixed(2)

  return ok({
    bucket: R2_BUCKET,
    total_bytes: totalBytes,
    total_objects: totalObjects,
    by_prefix: byPrefix,
    plan: "Free (10 GB)",
    free_tier_gb: FREE_GB,
    used_gb: +usedGb.toFixed(4),
    pct_free_tier: +pctFree.toFixed(2),
    billable_gb: +billableGb.toFixed(4),
    est_monthly_cost_usd: estMonthlyCost,
    last_updated: new Date().toISOString(),
    pages_scanned: pages,
  })
}

// ══════════════════════════════════════════════════════════════
// R2 BACKFILL CACHE — one-off: stamp a long immutable Cache-Control on
// every existing object so the browser stops re-fetching media on each
// page visit. Objects uploaded before the signer started signing
// Cache-Control have no cache header at all. We rewrite metadata in place
// via CopyObject (MetadataDirective=REPLACE) — bytes are untouched, the
// public URL is unchanged, only the response headers change.
//
// Processes one ListObjectsV2 page (≤1000 keys) per call with bounded
// concurrency, returning a continuation token so the caller can loop until
// done without hitting the function wall-clock limit.
// ══════════════════════════════════════════════════════════════

const R2_CACHE_CONTROL = "public, max-age=31536000, immutable"

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4",
  aac: "audio/aac", flac: "audio/flac",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  pdf: "application/pdf",
}
function mimeForKey(key: string): string {
  const ext = (key.split(".").pop() || "").toLowerCase()
  return EXT_MIME[ext] || "application/octet-stream"
}

async function handleR2BackfillCache(params: any) {
  if (!r2 || !R2_BUCKET || !R2_ENDPOINT) return err("R2 not configured", 500)
  // Light guard so this destructive-ish rewrite isn't triggered by accident.
  if (params.confirm !== "BACKFILL_CACHE_2026") return err("Missing confirm token", 403)

  const listUrl = new URL(`${R2_ENDPOINT}/${R2_BUCKET}`)
  listUrl.searchParams.set("list-type", "2")
  listUrl.searchParams.set("max-keys", "1000")
  if (params.start_token) listUrl.searchParams.set("continuation-token", params.start_token)
  if (params.prefix) listUrl.searchParams.set("prefix", params.prefix)

  const listSigned = await r2.sign(new Request(listUrl.toString(), { method: "GET" }))
  const listRes = await fetch(listSigned.url, { method: "GET", headers: listSigned.headers })
  if (!listRes.ok) {
    const body = await listRes.text()
    return err(`R2 list failed (${listRes.status}): ${body.slice(0, 300)}`, 500)
  }
  const xml = await listRes.text()
  const keys = xmlMatchAll(xml, "Contents")
    .map(block => xmlFirst(block, "Key") || "")
    .filter(Boolean)

  let updated = 0
  const errors: string[] = []

  // Rewrite one object's metadata in place via self-CopyObject.
  const rewrite = async (key: string) => {
    const dstUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`
    const copySource = `/${R2_BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`
    const signed = await r2.sign(new Request(dstUrl, {
      method: "PUT",
      headers: {
        "x-amz-copy-source": copySource,
        "x-amz-metadata-directive": "REPLACE",
        "Cache-Control": R2_CACHE_CONTROL,
        "Content-Type": mimeForKey(key),
      },
    }))
    const res = await fetch(signed.url, { method: "PUT", headers: signed.headers })
    if (res.ok) { updated++; return }
    const body = await res.text()
    errors.push(`${key}: ${res.status} ${body.slice(0, 120)}`)
  }

  // Bounded concurrency so a big page doesn't blow the wall-clock budget.
  const CONCURRENCY = 12
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    await Promise.all(keys.slice(i, i + CONCURRENCY).map(rewrite))
  }

  const truncated = (xmlFirst(xml, "IsTruncated") || "false").toLowerCase() === "true"
  const next_token = truncated ? (xmlFirst(xml, "NextContinuationToken") || null) : null

  return ok({
    page_keys: keys.length,
    updated,
    error_count: errors.length,
    errors: errors.slice(0, 20),
    done: !next_token,
    next_token,
  })
}

// Legacy Cloudinary signed-upload endpoint. All upload paths moved to R2 via
// handleR2SignUpload on 2026-05-27. This stub stays so any browser still
// running a stale Vercel bundle fails LOUDLY instead of silently writing to
// Cloudinary again (which is what created the two stray WIPs on 2026-05-27
// after the migration). Same stub serves every old action name.
function handleLegacyCloudinarySig(_supabase: any, _params: any) {
  return err("Cloudinary uploads removed — refresh the page to load the R2 build", 410)
}

// ══════════════════════════════════════════════════════════════
// PRE-REGISTER STUDENT — create an auth user + profile before they sign in
// via Google. When the real person later signs in with the same email,
// Supabase reuses the existing auth user, so all the pre-set assignments
// (project_members rows, project_role, etc.) automatically flow to them.
// ══════════════════════════════════════════════════════════════

async function handlePreregStudent(supabase: any, params: any, authHeader: string | null) {
  const { email, full_name } = params
  if (!email || !full_name) return err("email and full_name are required")
  const trimmedEmail = String(email).trim().toLowerCase()
  const trimmedName = String(full_name).trim()
  if (!trimmedEmail || !trimmedName) return err("email and full_name are required")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return err("Invalid email format")

  // Authorization: caller must have create_projects permission. We re-create
  // a Supabase client with the caller's JWT so RLS/auth.uid() works for the
  // permission check, then keep using the service-role client for writes.
  if (!authHeader) return err("Missing Authorization header", 401)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY ?? SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser()
  if (callerErr || !caller) return err("Invalid auth token", 401)
  const { data: hasPerm, error: permErr } = await supabase.rpc("has_permission", {
    user_id: caller.id,
    perm: "create_projects",
  })
  if (permErr) return err("Permission check failed: " + permErr.message, 500)
  if (!hasPerm) return err("Forbidden: requires create_projects permission", 403)

  // Check duplicate (Supabase admin.createUser would also fail but the error
  // is opaque — better to surface a friendly message).
  const { data: existing } = await supabase.from("profiles").select("id, email").eq("email", trimmedEmail).maybeSingle()
  if (existing) return err(`Esiste già un profilo con email ${trimmedEmail}`, 409)

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: trimmedEmail,
    email_confirm: true,
    user_metadata: { full_name: trimmedName },
  })
  if (createErr || !created?.user) {
    return err("Failed to create user: " + (createErr?.message || "unknown error"), 500)
  }

  // The handle_new_user trigger has already inserted the profile with role_id=studente.
  // Wait briefly then fetch + ensure full_name matches what the caller asked for.
  await sleep(150)
  const { data: profile } = await supabase
    .from("profiles")
    .update({ full_name: trimmedName })
    .eq("id", created.user.id)
    .select("*")
    .maybeSingle()
  return ok({ profile, user_id: created.user.id })
}

// ══════════════════════════════════════════════════════════════
// DELETE WIP UPDATE — gated by access_review (prof+) OR delete_tasks
// (producer+). Removes the WIP update + its storyboard rows. The
// underlying R2 objects are left in place (cheap; same keep-assets
// policy as the rest of the function).
// ══════════════════════════════════════════════════════════════

async function handleDeleteWipUpdate(supabase: any, params: any, authHeader: string | null) {
  const { wip_update_id } = params
  if (!wip_update_id) return err("Missing wip_update_id")
  if (!authHeader) return err("Missing Authorization header", 401)

  // Permission check — caller needs access_review (prof+) OR delete_tasks
  // (producer+). Super admins pass via has_permission automatically.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY ?? SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser()
  if (callerErr || !caller) return err("Invalid auth token", 401)
  const [reviewPerm, deletePerm] = await Promise.all([
    supabase.rpc("has_permission", { user_id: caller.id, perm: "access_review" }),
    supabase.rpc("has_permission", { user_id: caller.id, perm: "delete_tasks" }),
  ])
  if (reviewPerm.error && deletePerm.error) {
    return err("Permission check failed: " + (reviewPerm.error.message || deletePerm.error.message), 500)
  }
  if (!reviewPerm.data && !deletePerm.data) {
    return err("Forbidden: requires access_review or delete_tasks permission", 403)
  }

  // Read the WIP update to get its image/audio URLs + the task/user it belongs to.
  // We need task_id + user_id later to scope the miro_wip_images cleanup correctly
  // (the same URL might in theory exist for a different task/user — match
  // on the whole triple to be safe).
  const { data: wipRow, error: fetchErr } = await supabase
    .from("task_wip_updates")
    .select("id, images, task_id, user_id")
    .eq("id", wip_update_id)
    .maybeSingle()
  if (fetchErr) return err("DB read failed: " + fetchErr.message, 500)
  if (!wipRow) return err("WIP update not found", 404)

  // Comments first (no ON DELETE CASCADE assumed), then the WIP row itself.
  await supabase.from("wip_comments").delete().eq("wip_update_id", wip_update_id)
  const { error: delErr } = await supabase.from("task_wip_updates").delete().eq("id", wip_update_id)
  if (delErr) return err("DB delete failed: " + delErr.message, 500)

  // Cleanup orphaned storyboard rows. `miro_wip_images` mirrors the WIP image URLs
  // for the storyboard grid — if we don't remove the matching rows here, the grid
  // keeps rendering broken "?" tiles pointing to the (now-deleted) URLs.
  // Match on task_id + uploaded_by + image_url IN (list) so we only ever remove the
  // exact images that belonged to this WIP update, never another user's contributions
  // to the same task.
  let storyboardRowsDeleted = 0
  if (wipRow.task_id && wipRow.user_id && (wipRow.images || []).length > 0) {
    try {
      const { error: cleanErr, count } = await supabase
        .from("miro_wip_images")
        .delete({ count: "exact" })
        .eq("task_id", wipRow.task_id)
        .eq("uploaded_by", wipRow.user_id)
        .in("image_url", wipRow.images)
      if (cleanErr) {
        console.warn("[delete_wip_update] miro_wip_images cleanup failed:", cleanErr.message)
      } else {
        storyboardRowsDeleted = count || 0
      }
    } catch (e) {
      console.warn("[delete_wip_update] miro_wip_images cleanup threw:", e)
    }
  }

  return ok({
    success: true,
    asset_count: (wipRow.images || []).length,
    storyboard_rows_deleted: storyboardRowsDeleted,
  })
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()
    console.log(`[miro-sync] Action: ${action}`)

    // Service role for DB operations (per-caller auth is re-derived inside the
    // handlers that need it, from the request's Authorization header).
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    switch (action) {
      case "r2_sign_upload":    return await handleR2SignUpload(params)
      case "r2_sign_thumb":     return await handleR2SignThumb(params)
      case "r2_usage":          return await handleR2Usage()
      case "r2_backfill_cache": return await handleR2BackfillCache(params)
      case "get_card_upload_sig":
      case "get_wip_upload_sig":
      case "get_concept_upload_sig":
      case "get_output_upload_sig":
      case "get_timeline_upload_sig":
        return handleLegacyCloudinarySig(supabase, params)
      case "prereg_student":    return await handlePreregStudent(supabase, params, req.headers.get("Authorization"))
      case "delete_wip_update": return await handleDeleteWipUpdate(supabase, params, req.headers.get("Authorization"))
      default:                  return err(`Unknown action: ${action}`)
    }
  } catch (e) {
    console.error("[miro-sync] error:", e)
    return err(e.message || "Internal error", 500)
  }
})

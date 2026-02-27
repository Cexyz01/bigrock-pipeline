import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ══════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════

const MIRO_API = "https://api.miro.com/v2"
const BOARD_ID = Deno.env.get("MIRO_BOARD_ID")!
const MIRO_TOKEN = Deno.env.get("MIRO_ACCESS_TOKEN")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const CLD_CLOUD = Deno.env.get("CLOUDINARY_CLOUD_NAME") || ""
const CLD_KEY = Deno.env.get("CLOUDINARY_API_KEY") || ""
const CLD_SECRET = Deno.env.get("CLOUDINARY_API_SECRET") || ""

// ══════════════════════════════════════════════════════════════
// TABLE LAYOUT — Large Excel-like grid inside a Miro Frame
//
// ~10× wider, ~5× taller than before.
// Each department cell contains a sub-grid of tasks.
// Each task sub-cell can hold up to 4 images in a 2×2 mini-grid.
// Positions are RELATIVE to the frame's top-left corner.
// ══════════════════════════════════════════════════════════════

const FRAME_TITLE = "BIGROCK PIPELINE — Shot Tracker"

const PAD = 40
const GAP = 8
const COL_W = [500, 2200, 2200, 2200, 2200, 2200, 2200, 2200]
const HDR_H = 100
const ROW_H = 1000

const CELL_PAD = 30   // padding inside each department cell
const IMG_GAP = 10    // gap between task sub-cells and images

// Insert Cloudinary c_fit transformation into a Cloudinary URL.
// This makes Cloudinary serve the image ALREADY resized to fit within w×h.
// Miro then receives the image at the perfect size — no geometry needed.
// f_jpg forces JPEG output — Miro does NOT support AVIF/WebP uploads.
function cloudFitUrl(url: string, w: number, h: number): string {
  // Cloudinary URL: .../upload/v1234/...  →  .../upload/c_fit,w_X,h_Y,f_jpg/v1234/...
  if (url.includes("/upload/")) {
    return url.replace("/upload/", `/upload/c_fit,w_${Math.floor(w)},h_${Math.floor(h)},f_jpg/`)
  }
  // Non-Cloudinary URL: use Cloudinary fetch to transform any external image
  if (CLD_CLOUD) {
    return `https://res.cloudinary.com/${CLD_CLOUD}/image/fetch/c_fit,w_${Math.floor(w)},h_${Math.floor(h)},f_jpg/${url}`
  }
  return url
}

const COLS = ["Shot", "Reference", "Concept", "Modeling", "Texturing", "Rigging", "Animation", "Comp"]
const DEPTS = ["concept", "modeling", "texturing", "rigging", "animation", "compositing"]

// Header fill colors (vibrant)
const HDR_FILL = ["#6C5CE7", "#636E72", "#FF6B81", "#0984E3", "#FDCB6E", "#00B894", "#E84393", "#74B9FF"]
const HDR_TEXT = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#1a1a2e", "#ffffff", "#ffffff", "#ffffff"]
// Data cell fill colors (light pastels)
const CELL_FILL = ["#F8F7FF", "#F5F5F5", "#FFF0F3", "#EBF5FB", "#FFF9E6", "#E8F8F5", "#FDEDEC", "#EBF5FB"]

// Column center X (relative to frame top-left)
function colX(i: number): number {
  let x = PAD
  for (let c = 0; c < i; c++) x += COL_W[c] + GAP
  return x + COL_W[i] / 2
}

function hdrY(): number { return PAD + HDR_H / 2 }

function rowY(r: number): number {
  return PAD + HDR_H + GAP + ROW_H / 2 + r * (ROW_H + GAP)
}

function frameW(): number {
  return PAD * 2 + COL_W.reduce((a, b) => a + b, 0) + GAP * (COL_W.length - 1)
}

function frameH(n: number): number {
  if (n <= 0) return PAD * 2 + HDR_H
  return PAD + HDR_H + GAP + n * ROW_H + (n - 1) * GAP + PAD
}

function deptCol(dept: string): number {
  const i = DEPTS.indexOf(dept)
  return i >= 0 ? i + 2 : -1
}

// ══════════════════════════════════════════════════════════════
// SUB-GRID LAYOUT ALGORITHMS
// ══════════════════════════════════════════════════════════════

// How many columns/rows to arrange N tasks in a department cell
function calcTaskGrid(n: number): { cols: number; rows: number } {
  if (n <= 0) return { cols: 0, rows: 0 }
  if (n === 1) return { cols: 1, rows: 1 }
  if (n === 2) return { cols: 2, rows: 1 }
  if (n <= 4) return { cols: 2, rows: 2 }
  if (n <= 6) return { cols: 3, rows: 2 }
  if (n <= 9) return { cols: 3, rows: 3 }
  if (n <= 12) return { cols: 4, rows: 3 }
  const cols = Math.ceil(Math.sqrt(n))
  return { cols, rows: Math.ceil(n / cols) }
}

// How to arrange up to 4 images inside a task sub-cell
function calcImageGrid(n: number): { cols: number; rows: number } {
  if (n <= 0) return { cols: 0, rows: 0 }
  if (n === 1) return { cols: 1, rows: 1 }
  if (n === 2) return { cols: 2, rows: 1 }
  return { cols: 2, rows: 2 } // 3 or 4
}

// ══════════════════════════════════════════════════════════════
// MIRO API HELPERS
// ══════════════════════════════════════════════════════════════

const boardUrl = `${MIRO_API}/boards/${BOARD_ID}`

async function miroGet(path: string) {
  const res = await fetch(`${boardUrl}${path}`, {
    headers: { "Authorization": `Bearer ${MIRO_TOKEN}` },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Miro GET ${path}: ${res.status} ${t}`)
  }
  return res.json()
}

async function miroPost(path: string, body: any) {
  const bodyStr = JSON.stringify(body)
  console.log(`[miro] POST ${path} — ${bodyStr.substring(0, 120)}`)
  const res = await fetch(`${boardUrl}${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${MIRO_TOKEN}`, "Content-Type": "application/json" },
    body: bodyStr,
  })
  if (!res.ok) {
    const t = await res.text()
    console.error(`[miro] POST ${path} FAILED: ${res.status} ${t}`)
    throw new Error(`Miro ${res.status}: ${t}`)
  }
  return res.json()
}

async function miroPatch(path: string, body: any) {
  const res = await fetch(`${boardUrl}${path}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${MIRO_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Miro PATCH ${res.status}: ${t}`)
  }
  return res.json()
}

// Upload image as FILE to Miro (multipart form-data) with retry.
// Sends actual image bytes — more reliable than URL-based creation.
async function miroPostImage(
  imageUrl: string, metadata: any, maxRetries = 3,
): Promise<any> {
  // Fetch the image binary from Cloudinary/Supabase
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Fetch image failed: ${imgRes.status}`)
  const imgBytes = await imgRes.arrayBuffer()

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const fd = new FormData()
    fd.append("resource", new Blob([imgBytes]), "image.jpg")
    fd.append("data", JSON.stringify(metadata))

    console.log(`[miro] POST /images (file upload, ${imgBytes.byteLength} bytes, attempt ${attempt + 1})`)
    const res = await fetch(`${boardUrl}/images`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${MIRO_TOKEN}` },
      body: fd,
    })

    if (res.ok) return res.json()

    const t = await res.text()
    console.error(`[miro] POST /images FAILED (attempt ${attempt + 1}): ${res.status} ${t}`)

    // Retry on rate limit (429) or server errors (5xx)
    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries - 1) {
      const delay = res.status === 429 ? 3000 : 1000 * (attempt + 1)
      console.log(`[miro] Retrying in ${delay}ms...`)
      await sleep(delay)
      continue
    }

    throw new Error(`Miro file upload ${res.status}: ${t}`)
  }
  throw new Error("miroPostImage: max retries exceeded")
}

async function miroDelete(itemId: string): Promise<boolean> {
  try {
    const res = await fetch(`${boardUrl}/items/${itemId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${MIRO_TOKEN}` },
    })
    return res.ok || res.status === 404
  } catch (_e) { return false }
}

async function findOurFrame(): Promise<string | null> {
  try {
    const data = await miroGet("/items?type=frame&limit=50")
    const frame = data.data?.find((item: any) =>
      item.data?.title?.includes("BIGROCK PIPELINE")
    )
    return frame?.id || null
  } catch (_e) { return null }
}

async function deleteFrameAndChildren(frameId: string): Promise<void> {
  try {
    let cursor: string | null = null
    const childIds: string[] = []
    do {
      const url = `/items?parent_item_id=${frameId}&limit=50${cursor ? `&cursor=${cursor}` : ""}`
      const data = await miroGet(url)
      for (const item of data.data || []) childIds.push(item.id)
      cursor = data.cursor || null
    } while (cursor)

    console.log(`[miro] Deleting ${childIds.length} children + frame ${frameId}`)
    await parallelLimit(childIds.map(id => () => miroDelete(id)), 5)
  } catch (e) {
    console.warn("[miro] Error deleting children:", e)
  }
  await miroDelete(frameId)
}

// Run async tasks with concurrency limit
async function parallelLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

// Create a cell shape inside a frame
async function createCell(
  frameId: string, x: number, y: number, w: number, h: number,
  fill: string, text: string, textColor = "#1a1a2e", fontSize = "14",
): Promise<string> {
  const item = await miroPost("/shapes", {
    data: { content: text, shape: "rectangle" },
    position: { x, y, origin: "center" },
    geometry: { width: w, height: h },
    style: {
      fillColor: fill, color: textColor, fontSize,
      fontFamily: "open_sans", textAlign: "center", textAlignVertical: "middle",
      borderWidth: "1.0", borderOpacity: "0.15", borderColor: "#CBD5E1",
    },
    parent: { id: frameId },
  })
  return item.id
}

// ══════════════════════════════════════════════════════════════
// PLACE CELL IMAGES — Sub-grid layout for one department cell
//
// Queries all tasks for shot+dept, arranges them in a grid,
// places up to 4 images per task in a 2×2 mini-grid.
// ══════════════════════════════════════════════════════════════

async function placeCellImages(
  frameId: string, shotId: string, department: string,
  rowIndex: number, colIndex: number, supabase: any,
): Promise<void> {
  // 1. Delete existing Miro items for this cell
  const { data: existingItems } = await supabase
    .from("miro_wip_images").select("id, miro_item_id")
    .eq("shot_id", shotId).eq("department", department)
    .not("miro_item_id", "is", null)

  if (existingItems?.length) {
    await parallelLimit(
      existingItems
        .filter((i: any) => i.miro_item_id && i.miro_item_id !== "pending")
        .map((i: any) => () => miroDelete(i.miro_item_id)),
      5,
    )
  }

  // 2. Get tasks for this shot+dept — only review/approved show on Miro
  const { data: allTasks } = await supabase
    .from("tasks").select("id, title, status")
    .eq("shot_id", shotId).eq("department", department)
    .in("status", ["review", "approved"])
    .order("created_at")

  const tasks = allTasks || []
  if (!tasks.length) return

  // 3. Get all images for these visible tasks (with dimensions)
  const taskIds = tasks.map((t: any) => t.id)
  const { data: allImages } = await supabase
    .from("miro_wip_images").select("id, task_id, image_url, image_order, img_width, img_height")
    .eq("shot_id", shotId).eq("department", department)
    .in("task_id", taskIds)
    .not("image_url", "is", null)
    .order("image_order")

  const imagesByTask: Record<string, any[]> = {}
  for (const img of allImages || []) {
    if (!img.task_id) continue // skip orphaned images
    if (!imagesByTask[img.task_id]) imagesByTask[img.task_id] = []
    imagesByTask[img.task_id].push(img)
  }

  // 4. Calculate task grid — only count tasks that actually have images
  const tasksWithImages = tasks.filter((t: any) => imagesByTask[t.id]?.length > 0)
  const grid = calcTaskGrid(tasksWithImages.length)
  if (grid.cols === 0) return

  const cellW = COL_W[colIndex]
  const cellH = ROW_H
  const innerW = cellW - 2 * CELL_PAD
  const innerH = cellH - 2 * CELL_PAD
  const taskW = (innerW - (grid.cols - 1) * IMG_GAP) / grid.cols
  const taskH = (innerH - (grid.rows - 1) * IMG_GAP) / grid.rows

  // Inner area origin (top-left of usable area within the cell)
  const innerX0 = colX(colIndex) - cellW / 2 + CELL_PAD
  const innerY0 = rowY(rowIndex) - cellH / 2 + CELL_PAD

  // 5. Place images for each task
  const placements: (() => Promise<void>)[] = []

  for (let t = 0; t < tasksWithImages.length; t++) {
    const task = tasksWithImages[t]
    const gi = t % grid.cols
    const gj = Math.floor(t / grid.cols)

    const taskCX = innerX0 + gi * (taskW + IMG_GAP) + taskW / 2
    const taskCY = innerY0 + gj * (taskH + IMG_GAP) + taskH / 2

    const taskImgs = (imagesByTask[task.id] || []).slice(0, 4)
    if (taskImgs.length === 0) continue

    const imgGrid = calcImageGrid(taskImgs.length)
    const imgAreaW = taskW - 8
    const imgAreaH = taskH - 8
    const slotW = (imgAreaW - (imgGrid.cols - 1) * 6) / imgGrid.cols
    const slotH = (imgAreaH - (imgGrid.rows - 1) * 6) / imgGrid.rows

    const imgX0 = taskCX - imgAreaW / 2
    const imgY0 = taskCY - imgAreaH / 2

    for (let m = 0; m < taskImgs.length; m++) {
      const img = taskImgs[m]
      const mi = m % imgGrid.cols
      const mj = Math.floor(m / imgGrid.cols)

      const imgCX = imgX0 + mi * (slotW + 6) + slotW / 2
      const imgCY = imgY0 + mj * (slotH + 6) + slotH / 2

      // Pre-resize via Cloudinary, then upload to Miro WITHOUT geometry
      const fittedUrl = cloudFitUrl(img.image_url, slotW * 0.95, slotH * 0.95)

      placements.push(async () => {
        try {
          const miroItem = await miroPostImage(fittedUrl, {
            position: { x: imgCX, y: imgCY, origin: "center" },
            parent: { id: frameId },
          })
          await supabase.from("miro_wip_images")
            .update({ miro_item_id: miroItem.id })
            .eq("id", img.id)
        } catch (e) {
          console.warn(`[placeCellImages] Image failed:`, e)
        }
      })
    }
  }

  if (placements.length > 0) {
    console.log(`[placeCellImages] Placing ${placements.length} images for ${department}`)
    // Run sequentially with small delay to avoid Miro rate limits
    for (const fn of placements) {
      await fn()
      await sleep(150)
    }
  }
}

// ══════════════════════════════════════════════════════════════
// CLOUDINARY
// ══════════════════════════════════════════════════════════════

async function sha1(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(msg))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
}

interface CloudResult { url: string; width: number; height: number }

async function cloudUpload(base64: string, folder: string): Promise<CloudResult | null> {
  if (!CLD_CLOUD || !CLD_KEY || !CLD_SECRET) return null
  try {
    const ts = Math.floor(Date.now() / 1000).toString()
    const sig = await sha1(`folder=${folder}&timestamp=${ts}${CLD_SECRET}`)
    const fd = new FormData()
    fd.append("file", base64)
    fd.append("folder", folder)
    fd.append("timestamp", ts)
    fd.append("api_key", CLD_KEY)
    fd.append("signature", sig)
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLD_CLOUD}/image/upload`, { method: "POST", body: fd })
    if (!res.ok) { console.error("[cloudinary]", res.status, await res.text()); return null }
    const json = await res.json()
    return { url: json.secure_url || "", width: json.width || 0, height: json.height || 0 }
  } catch (e) { console.error("[cloudinary] error:", e); return null }
}

async function cloudDeletePrefix(prefix: string): Promise<void> {
  if (!CLD_CLOUD || !CLD_KEY || !CLD_SECRET) return
  try {
    const auth = btoa(`${CLD_KEY}:${CLD_SECRET}`)
    await fetch(
      `https://api.cloudinary.com/v1_1/${CLD_CLOUD}/resources/image/upload?prefix=${encodeURIComponent(prefix)}&type=upload`,
      { method: "DELETE", headers: { "Authorization": `Basic ${auth}` } },
    )
  } catch (_e) { /* ignore */ }
}

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
// FULL SYNC — Nuclear rebuild of the entire Miro table
// ══════════════════════════════════════════════════════════════

async function handleFullSync(supabase: any) {
  console.log("[full_sync] ═══ Starting ═══")

  // 0. Cleanup orphaned miro_wip_images (task_id IS NULL or task no longer exists)
  const { data: orphaned } = await supabase
    .from("miro_wip_images").select("id, task_id")
    .is("task_id", null)
  if (orphaned?.length) {
    console.log(`[full_sync] Cleaning ${orphaned.length} orphaned miro_wip_images`)
    await supabase.from("miro_wip_images").delete().is("task_id", null)
  }

  // Also remove images whose task no longer exists
  const { data: allWipImages } = await supabase
    .from("miro_wip_images").select("id, task_id")
    .not("task_id", "is", null)
  if (allWipImages?.length) {
    const uniqueTaskIds = [...new Set(allWipImages.map((i: any) => i.task_id))]
    const { data: existingTasks } = await supabase
      .from("tasks").select("id").in("id", uniqueTaskIds)
    const existingIds = new Set((existingTasks || []).map((t: any) => t.id))
    const staleIds = uniqueTaskIds.filter((id: string) => !existingIds.has(id))
    if (staleIds.length) {
      console.log(`[full_sync] Removing ${staleIds.length} stale task references`)
      await supabase.from("miro_wip_images").delete().in("task_id", staleIds)
    }
  }

  // 1. Delete existing frame + children
  const oldFrame = await findOurFrame()
  if (oldFrame) {
    await deleteFrameAndChildren(oldFrame)
    await sleep(500)
  }

  // 2. Get all shots
  const { data: shots, error: shotsErr } = await supabase
    .from("shots").select("id, code, sequence, sort_order, concept_image_url, ref_cloud_url, ref_img_width, ref_img_height")
    .order("sequence").order("sort_order").order("code")
  if (shotsErr) throw new Error(`DB: ${shotsErr.message}`)
  const n = shots?.length || 0
  console.log(`[full_sync] ${n} shots`)

  // 3. Create frame
  const fw = frameW()
  const fh = frameH(n)
  const frame = await miroPost("/frames", {
    data: { title: FRAME_TITLE, format: "custom", type: "freeform" },
    position: { x: fw / 2, y: fh / 2, origin: "center" },
    geometry: { width: fw, height: fh },
    style: { fillColor: "#ffffff" },
  })
  const frameId = frame.id
  console.log(`[full_sync] Frame: ${frameId} (${fw}×${fh})`)
  await sleep(500)

  // 4. Header cells
  for (let i = 0; i < COLS.length; i++) {
    await createCell(frameId, colX(i), hdrY(), COL_W[i], HDR_H,
      HDR_FILL[i], `<strong>${COLS[i]}</strong>`, HDR_TEXT[i], "28")
  }

  // 5. Clear and rebuild miro_shot_rows
  await supabase.from("miro_shot_rows").delete().not("id", "is", null)

  for (let r = 0; r < n; r++) {
    const shot = shots[r]
    const y = rowY(r)

    // Shot name cell
    const cellId = await createCell(frameId, colX(0), y, COL_W[0], ROW_H,
      CELL_FILL[0], `<strong>${shot.code}</strong>`, "#1a1a2e", "36")

    // Column cells (1..7)
    for (let c = 1; c < COLS.length; c++) {
      await createCell(frameId, colX(c), y, COL_W[c], ROW_H,
        CELL_FILL[c], "", "#94A3B8", "14")
    }

    // Save to DB
    await supabase.from("miro_shot_rows").insert({
      shot_id: shot.id, row_index: r, frame_id: frameId, shot_code_item_id: cellId,
    })

    // Reference image — pre-resize via Cloudinary, upload to Miro without geometry
    const refUrl = shot.ref_cloud_url || shot.concept_image_url
    if (refUrl) {
      try {
        const maxW = COL_W[1] - 2 * CELL_PAD   // 2140
        const maxH = ROW_H - 2 * CELL_PAD       // 940
        const fittedUrl = cloudFitUrl(refUrl, maxW, maxH)
        await miroPostImage(fittedUrl, {
          position: { x: colX(1), y, origin: "center" },
          parent: { id: frameId },
        })
      } catch (e) {
        console.warn(`[full_sync] Ref img ${shot.code}:`, e)
      }
    }

    // Department images via sub-grid
    for (let d = 0; d < DEPTS.length; d++) {
      await placeCellImages(frameId, shot.id, DEPTS[d], r, d + 2, supabase)
    }

    console.log(`[full_sync] Row ${r}: ${shot.code}`)
  }

  console.log("[full_sync] ═══ Done ═══")
  return ok({ success: true, shots: n, frame_id: frameId })
}

// ══════════════════════════════════════════════════════════════
// CREATE SHOT ROW — Incremental
// ══════════════════════════════════════════════════════════════

async function handleCreateShotRow(supabase: any, params: any) {
  const { shot_id, shot_code } = params
  if (!shot_id || !shot_code) return err("shot_id and shot_code required")

  const { data: existing } = await supabase
    .from("miro_shot_rows").select("id").eq("shot_id", shot_id).single()
  if (existing) return err("Shot already synced", 409)

  const { data: rows } = await supabase
    .from("miro_shot_rows").select("row_index")
    .order("row_index", { ascending: false }).limit(1)
  const rowIndex = rows?.length ? rows[0].row_index + 1 : 0
  console.log(`[create] ${shot_code} → row ${rowIndex}`)

  let frameId = await findOurFrame()

  if (!frameId) {
    console.log("[create] No frame, creating...")
    const fw = frameW()
    const fh = frameH(1)
    const frame = await miroPost("/frames", {
      data: { title: FRAME_TITLE, format: "custom", type: "freeform" },
      position: { x: fw / 2, y: fh / 2, origin: "center" },
      geometry: { width: fw, height: fh },
      style: { fillColor: "#ffffff" },
    })
    frameId = frame.id
    await sleep(500)
    for (let i = 0; i < COLS.length; i++) {
      await createCell(frameId, colX(i), hdrY(), COL_W[i], HDR_H,
        HDR_FILL[i], `<strong>${COLS[i]}</strong>`, HDR_TEXT[i], "28")
    }
  } else {
    const numRows = rowIndex + 1
    const newH = frameH(numRows)
    const fw = frameW()
    try {
      await miroPatch(`/frames/${frameId}`, {
        geometry: { width: fw, height: newH },
        position: { x: fw / 2, y: newH / 2, origin: "center" },
      })
    } catch (e) {
      console.warn("[create] Frame resize failed, full_sync:", e)
      return await handleFullSync(supabase)
    }
  }

  const y = rowY(rowIndex)
  const cellId = await createCell(frameId, colX(0), y, COL_W[0], ROW_H,
    CELL_FILL[0], `<strong>${shot_code}</strong>`, "#1a1a2e", "36")

  for (let c = 1; c < COLS.length; c++) {
    await createCell(frameId, colX(c), y, COL_W[c], ROW_H,
      CELL_FILL[c], "", "#94A3B8", "14")
  }

  const { error: dbErr } = await supabase.from("miro_shot_rows").insert({
    shot_id, row_index: rowIndex, frame_id: frameId, shot_code_item_id: cellId,
  })
  if (dbErr) return err(dbErr.message, 500)

  return ok({ success: true, row_index: rowIndex, frame_id: frameId })
}

// ══════════════════════════════════════════════════════════════
// DELETE SHOT ROW — Cleanup + full_sync
// ══════════════════════════════════════════════════════════════

async function handleDeleteShotRow(supabase: any, params: any) {
  const { shot_id } = params
  if (!shot_id) return err("shot_id required")
  await cloudDeletePrefix(`bigrock-wip/${shot_id}`)
  await supabase.from("miro_wip_images").delete().eq("shot_id", shot_id)
  await supabase.from("miro_shot_rows").delete().eq("shot_id", shot_id)
  return await handleFullSync(supabase)
}

// ══════════════════════════════════════════════════════════════
// DELETE TASK IMAGES — Remove Miro items + Cloudinary for a task
// ══════════════════════════════════════════════════════════════

async function handleDeleteTaskImages(supabase: any, params: any) {
  const { task_id } = params
  if (!task_id) return err("task_id required")

  // 1. Get task info (need shot_id + department for cell re-layout)
  const { data: task } = await supabase
    .from("tasks").select("shot_id, department").eq("id", task_id).single()

  // 2. Delete Miro items for this task's images
  const { data: miroImages } = await supabase
    .from("miro_wip_images").select("id, miro_item_id")
    .eq("task_id", task_id)
    .not("miro_item_id", "is", null)

  if (miroImages?.length) {
    await parallelLimit(
      miroImages
        .filter((i: any) => i.miro_item_id && i.miro_item_id !== "pending")
        .map((i: any) => () => miroDelete(i.miro_item_id)),
      5,
    )
  }

  // 3. Delete miro_wip_images DB rows for this task
  await supabase.from("miro_wip_images").delete().eq("task_id", task_id)

  // 4. Delete Cloudinary assets for WIP updates (bigrock-wip-updates/{task_id})
  await cloudDeletePrefix(`bigrock-wip-updates/${task_id}`)

  // 5. Delete Cloudinary assets for Miro images if task has shot+department
  if (task?.shot_id && task?.department) {
    // Note: we can't delete just this task's Miro cloud images without affecting other tasks
    // in the same shot/dept, so we skip this. The Miro items are already deleted above.
  }

  // 6. Re-layout the Miro cell if task had a shot
  if (task?.shot_id && task?.department) {
    const frameId = await findOurFrame()
    if (frameId) {
      const ci = deptCol(task.department)
      const { data: shotRow } = await supabase
        .from("miro_shot_rows").select("row_index").eq("shot_id", task.shot_id).single()
      if (shotRow && ci >= 0) {
        await placeCellImages(frameId, task.shot_id, task.department, shotRow.row_index, ci, supabase)
      }
    }
  }

  return ok({ success: true, miro_items_deleted: miroImages?.length || 0 })
}

// ══════════════════════════════════════════════════════════════
// UPLOAD REFERENCE — Cloudinary → Miro (incremental, full cell)
// ══════════════════════════════════════════════════════════════

async function handleUploadReference(supabase: any, params: any) {
  const { shot_id, image_base64 } = params
  if (!shot_id || !image_base64) return err("shot_id and image_base64 required")

  const upload = await cloudUpload(image_base64, `bigrock-wip/${shot_id}/reference`)
  if (!upload) return err("Cloudinary upload failed", 500)

  // Save Cloudinary URL + dimensions to shots table for future full_sync
  await supabase.from("shots").update({
    ref_cloud_url: upload.url,
    ref_img_width: upload.width,
    ref_img_height: upload.height,
  }).eq("id", shot_id)

  const frameId = await findOurFrame()
  if (!frameId) return await handleFullSync(supabase)

  const { data: shotRow } = await supabase
    .from("miro_shot_rows").select("row_index").eq("shot_id", shot_id).single()
  if (!shotRow) return err("Shot not synced", 404)

  // Pre-resize via Cloudinary, upload to Miro WITHOUT geometry
  const maxW = COL_W[1] - 2 * CELL_PAD   // 2140
  const maxH = ROW_H - 2 * CELL_PAD       // 940
  const fittedUrl = cloudFitUrl(upload.url, maxW, maxH)

  const img = await miroPostImage(fittedUrl, {
    position: { x: colX(1), y: rowY(shotRow.row_index), origin: "center" },
    parent: { id: frameId },
  })

  return ok({ success: true, miro_item_id: img.id, image_url: upload.url })
}

// ══════════════════════════════════════════════════════════════
// UPLOAD WIP IMAGE (single) — Cloudinary → DB → re-layout cell
// ══════════════════════════════════════════════════════════════

async function handleUploadWipImage(supabase: any, params: any) {
  const { shot_id, department, task_id, image_base64, uploaded_by } = params
  if (!shot_id || !department || !image_base64) return err("shot_id, department, image_base64 required")

  const ci = deptCol(department)
  if (ci < 0) return err(`Invalid department: ${department}`)

  // ── DEDUP: Remove existing miro_wip_images for this task ──
  if (task_id) {
    const { data: existing } = await supabase
      .from("miro_wip_images").select("id, miro_item_id")
      .eq("task_id", task_id)
    if (existing?.length) {
      console.log(`[upload_wip_image] Dedup: removing ${existing.length} old images for task ${task_id}`)
      const toDelete = existing.filter((i: any) => i.miro_item_id && i.miro_item_id !== "pending")
      if (toDelete.length) {
        await parallelLimit(toDelete.map((i: any) => () => miroDelete(i.miro_item_id)), 5)
      }
      await supabase.from("miro_wip_images").delete().eq("task_id", task_id)
    }
  }

  const upload = await cloudUpload(image_base64, `bigrock-wip/${shot_id}/${department}`)
  if (!upload) return err("Cloudinary upload failed", 500)

  await supabase.from("miro_wip_images").insert({
    shot_id, task_id: task_id || null, department,
    miro_item_id: "pending", uploaded_by: uploaded_by || null,
    image_url: upload.url, image_order: 0,
    img_width: upload.width, img_height: upload.height,
  })

  // Re-layout this cell
  const frameId = await findOurFrame()
  if (!frameId) return await handleFullSync(supabase)

  const { data: shotRow } = await supabase
    .from("miro_shot_rows").select("row_index").eq("shot_id", shot_id).single()
  if (!shotRow) return err("Shot not synced", 404)

  await placeCellImages(frameId, shot_id, department, shotRow.row_index, ci, supabase)

  return ok({ success: true, image_url: upload.url, images_placed: true })
}

// ══════════════════════════════════════════════════════════════
// UPLOAD WIP IMAGES (batch) — multiple images at once
// ══════════════════════════════════════════════════════════════

async function handleUploadWipImages(supabase: any, params: any) {
  const { shot_id, department, task_id, images_base64, uploaded_by } = params
  if (!shot_id || !department || !images_base64?.length) {
    return err("shot_id, department, images_base64[] required")
  }

  const ci = deptCol(department)
  if (ci < 0) return err(`Invalid department: ${department}`)

  // ── DEDUP: Remove existing miro_wip_images for this task ──
  // Prevents duplicates when "Invia per Review" is called multiple times
  if (task_id) {
    const { data: existing } = await supabase
      .from("miro_wip_images").select("id, miro_item_id")
      .eq("task_id", task_id)
    if (existing?.length) {
      console.log(`[upload_wip_images] Dedup: removing ${existing.length} old images for task ${task_id}`)
      // Delete their Miro items first
      const toDelete = existing.filter((i: any) => i.miro_item_id && i.miro_item_id !== "pending")
      if (toDelete.length) {
        await parallelLimit(toDelete.map((i: any) => () => miroDelete(i.miro_item_id)), 5)
      }
      // Delete DB rows
      await supabase.from("miro_wip_images").delete().eq("task_id", task_id)
    }
  }

  // Upload all to Cloudinary
  const uploads: CloudResult[] = []
  for (const b64 of images_base64) {
    const upload = await cloudUpload(b64, `bigrock-wip/${shot_id}/${department}`)
    if (upload) uploads.push(upload)
  }
  if (uploads.length === 0) return err("All uploads failed", 500)

  // Insert all with dimensions (start from order 0 since we cleared old ones)
  let nextOrder = 0
  for (const upload of uploads) {
    await supabase.from("miro_wip_images").insert({
      shot_id, task_id: task_id || null, department,
      miro_item_id: "pending", uploaded_by: uploaded_by || null,
      image_url: upload.url, image_order: nextOrder++,
      img_width: upload.width, img_height: upload.height,
    })
  }

  // Re-layout this cell
  const frameId = await findOurFrame()
  if (!frameId) return await handleFullSync(supabase)

  const { data: shotRow } = await supabase
    .from("miro_shot_rows").select("row_index").eq("shot_id", shot_id).single()
  if (!shotRow) return err("Shot not synced", 404)

  await placeCellImages(frameId, shot_id, department, shotRow.row_index, ci, supabase)

  return ok({ success: true, images_uploaded: uploads.length })
}

// ══════════════════════════════════════════════════════════════
// CLEANUP — Wipe all data from DB (uses service role, bypasses RLS)
// ══════════════════════════════════════════════════════════════

async function handleCleanup(supabase: any) {
  console.log("[cleanup] ═══ Starting ═══")

  // 1. Delete Miro frame and all children
  const frameId = await findOurFrame()
  if (frameId) {
    await deleteFrameAndChildren(frameId)
    await sleep(500)
  }

  // 2. Delete all rows from dependent tables first (foreign key order)
  const tables = ["miro_wip_images", "miro_shot_rows", "comments", "tasks", "shots"]
  const results: Record<string, number> = {}
  for (const table of tables) {
    const { data, error } = await supabase.from(table).delete().not("id", "is", null)
    results[table] = error ? -1 : (data?.length ?? 0)
    console.log(`[cleanup] ${table}: ${error ? "ERROR " + error.message : "OK"}`)
  }

  // 3. Delete Cloudinary assets
  await cloudDeletePrefix("bigrock-wip")

  console.log("[cleanup] ═══ Done ═══")
  return ok({ success: true, deleted: results })
}

// ══════════════════════════════════════════════════════════════
// CARD IMAGE UPLOAD — Generate signed Cloudinary upload params
// ══════════════════════════════════════════════════════════════

async function handleGetCardUploadSig(_supabase: any, params: any) {
  const { card_number } = params
  if (card_number == null || card_number === "") return err("Missing card_number")
  if (!CLD_CLOUD || !CLD_KEY || !CLD_SECRET) return err("Cloudinary not configured", 500)

  const folder = "bigrock-cards"
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = await sha1(`folder=${folder}&timestamp=${ts}${CLD_SECRET}`)

  return ok({
    cloud_name: CLD_CLOUD,
    api_key: CLD_KEY,
    timestamp: ts,
    signature: sig,
    folder,
  })
}

// ══════════════════════════════════════════════════════════════
// WIP UPDATE IMAGE UPLOAD — Signed Cloudinary params (no Miro)
// ══════════════════════════════════════════════════════════════

async function handleGetWipUploadSig(_supabase: any, params: any) {
  const { task_id } = params
  if (!task_id) return err("Missing task_id")
  if (!CLD_CLOUD || !CLD_KEY || !CLD_SECRET) return err("Cloudinary not configured", 500)

  const folder = `bigrock-wip-updates/${task_id}`
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = await sha1(`folder=${folder}&timestamp=${ts}${CLD_SECRET}`)

  return ok({
    cloud_name: CLD_CLOUD,
    api_key: CLD_KEY,
    timestamp: ts,
    signature: sig,
    folder,
  })
}

// ══════════════════════════════════════════════════════════════
// FIX SYNC — Incremental repair (only fix cells with missing images)
// ══════════════════════════════════════════════════════════════

async function handleFixSync(supabase: any) {
  console.log("[fix_sync] ═══ Starting ═══")

  const frameId = await findOurFrame()
  if (!frameId) {
    console.log("[fix_sync] No frame found, falling back to full_sync")
    return await handleFullSync(supabase)
  }

  // Get all shot rows
  const { data: shotRows } = await supabase
    .from("miro_shot_rows").select("shot_id, row_index")
    .order("row_index")

  if (!shotRows?.length) {
    console.log("[fix_sync] No shot rows, falling back to full_sync")
    return await handleFullSync(supabase)
  }

  let cellsChecked = 0
  let cellsFixed = 0
  let imagesFixed = 0

  for (const sr of shotRows) {
    for (let d = 0; d < DEPTS.length; d++) {
      const dept = DEPTS[d]
      const ci = d + 2

      // Get visible tasks (review/approved)
      const { data: tasks } = await supabase
        .from("tasks").select("id")
        .eq("shot_id", sr.shot_id).eq("department", dept)
        .in("status", ["review", "approved"])

      if (!tasks?.length) continue

      const taskIds = tasks.map((t: any) => t.id)

      // Get miro_wip_images for these tasks
      const { data: images } = await supabase
        .from("miro_wip_images").select("id, miro_item_id, image_url")
        .eq("shot_id", sr.shot_id).eq("department", dept)
        .in("task_id", taskIds)
        .not("image_url", "is", null)

      if (!images?.length) continue
      cellsChecked++

      // Check which images are missing from Miro (pending or not placed)
      const missingCount = images.filter((img: any) =>
        !img.miro_item_id || img.miro_item_id === "pending"
      ).length

      if (missingCount > 0) {
        console.log(`[fix_sync] Cell ${dept} shot_row ${sr.row_index}: ${missingCount}/${images.length} images missing — re-laying out`)
        await placeCellImages(frameId, sr.shot_id, dept, sr.row_index, ci, supabase)
        cellsFixed++
        imagesFixed += missingCount
        await sleep(200) // Small delay between cells to avoid rate limits
      }
    }
  }

  console.log(`[fix_sync] ═══ Done ═══ Checked ${cellsChecked} cells, fixed ${cellsFixed} cells, ${imagesFixed} images`)
  return ok({ success: true, cells_checked: cellsChecked, cells_fixed: cellsFixed, images_fixed: imagesFixed })
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

    // Auth is verified by Supabase relay (verify_jwt default=true)
    // Use service role for DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    switch (action) {
      case "full_sync":         return await handleFullSync(supabase)
      case "fix_sync":          return await handleFixSync(supabase)
      case "create_shot_row":   return await handleCreateShotRow(supabase, params)
      case "delete_shot_row":   return await handleDeleteShotRow(supabase, params)
      case "delete_task_images": return await handleDeleteTaskImages(supabase, params)
      case "upload_wip_image":  return await handleUploadWipImage(supabase, params)
      case "upload_wip_images": return await handleUploadWipImages(supabase, params)
      case "upload_reference":  return await handleUploadReference(supabase, params)
      case "init_board":        return await handleFullSync(supabase)
      case "cleanup":           return await handleCleanup(supabase)
      case "get_card_upload_sig": return await handleGetCardUploadSig(supabase, params)
      case "get_wip_upload_sig": return await handleGetWipUploadSig(supabase, params)
      default:                  return err(`Unknown action: ${action}`)
    }
  } catch (e) {
    console.error("[miro-sync] error:", e)
    return err(e.message || "Internal error", 500)
  }
})

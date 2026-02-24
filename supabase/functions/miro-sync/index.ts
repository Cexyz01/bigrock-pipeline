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
// TABLE LAYOUT — Frame + Shapes (Excel-like grid)
//
// The board has ONE frame titled "BIGROCK PIPELINE".
// Inside: header row (colored shapes) + data rows (pastel shapes).
// Images are placed ON TOP of the cell shapes.
// Positions are RELATIVE to the frame's top-left corner.
// ══════════════════════════════════════════════════════════════

const FRAME_TITLE = "BIGROCK PIPELINE — Shot Tracker"
const PAD = 20
const GAP = 4
const COL_W = [160, 220, 220, 220, 220, 220, 220, 220]
const HDR_H = 50
const ROW_H = 200

const COLS = ["Shot", "Reference", "Concept", "Modeling", "Texturing", "Rigging", "Animation", "Comp"]
const DEPTS = ["concept", "modeling", "texturing", "rigging", "animation", "compositing"]

// Header fill colors (vibrant)
const HDR_FILL = ["#6C5CE7", "#636E72", "#FF6B81", "#0984E3", "#FDCB6E", "#00B894", "#E84393", "#74B9FF"]
// Header text colors
const HDR_TEXT = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#1a1a2e", "#ffffff", "#ffffff", "#ffffff"]
// Data cell fill colors (light pastels)
const CELL_FILL = ["#F8F7FF", "#F5F5F5", "#FFF0F3", "#EBF5FB", "#FFF9E6", "#E8F8F5", "#FDEDEC", "#EBF5FB"]

// Column center X (relative to frame top-left)
function colX(i: number): number {
  let x = PAD
  for (let c = 0; c < i; c++) x += COL_W[c] + GAP
  return x + COL_W[i] / 2
}

// Header center Y
function hdrY(): number { return PAD + HDR_H / 2 }

// Data row center Y (0-indexed)
function rowY(r: number): number {
  return PAD + HDR_H + GAP + ROW_H / 2 + r * (ROW_H + GAP)
}

// Total frame width
function frameW(): number {
  return PAD * 2 + COL_W.reduce((a, b) => a + b, 0) + GAP * (COL_W.length - 1)
}

// Total frame height for N data rows
function frameH(n: number): number {
  if (n <= 0) return PAD * 2 + HDR_H
  return PAD + HDR_H + GAP + n * ROW_H + (n - 1) * GAP + PAD
}

// Department name → column index (2..7)
function deptCol(dept: string): number {
  const i = DEPTS.indexOf(dept)
  return i >= 0 ? i + 2 : -1
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
  console.log(`[miro] POST ${path} — ${bodyStr.substring(0, 150)}`)
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
    console.error(`[miro] PATCH ${path} FAILED: ${res.status} ${t}`)
    throw new Error(`Miro PATCH ${res.status}: ${t}`)
  }
  return res.json()
}

async function miroDelete(itemId: string): Promise<boolean> {
  try {
    const res = await fetch(`${boardUrl}/items/${itemId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${MIRO_TOKEN}` },
    })
    return res.ok || res.status === 404
  } catch { return false }
}

// Find our frame by title on the board
async function findOurFrame(): Promise<string | null> {
  try {
    const data = await miroGet("/items?type=frame&limit=50")
    const frame = data.data?.find((item: any) =>
      item.data?.title?.includes("BIGROCK PIPELINE")
    )
    return frame?.id || null
  } catch (err) {
    console.warn("[miro] Failed to query frames:", err)
    return null
  }
}

// Delete a frame AND all its children (frame delete does NOT cascade!)
async function deleteFrameAndChildren(frameId: string): Promise<void> {
  // 1. Get all children of the frame
  try {
    let cursor: string | null = null
    const childIds: string[] = []
    do {
      const url = `/items?parent_item_id=${frameId}&limit=50${cursor ? `&cursor=${cursor}` : ""}`
      const data = await miroGet(url)
      for (const item of data.data || []) {
        childIds.push(item.id)
      }
      cursor = data.cursor || null
    } while (cursor)

    console.log(`[miro] Deleting ${childIds.length} children of frame ${frameId}`)

    // 2. Delete all children
    for (const id of childIds) {
      await miroDelete(id)
    }
  } catch (err) {
    console.warn("[miro] Error fetching frame children:", err)
  }

  // 3. Delete the frame itself
  await miroDelete(frameId)
  console.log(`[miro] Frame ${frameId} + children deleted`)
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
      fillColor: fill,
      color: textColor,
      fontSize,
      fontFamily: "open_sans",
      textAlign: "center",
      textAlignVertical: "middle",
      borderWidth: "1.0",
      borderOpacity: "0.15",
      borderColor: "#CBD5E1",
    },
    parent: { id: frameId },
  })
  return item.id
}

// ══════════════════════════════════════════════════════════════
// CLOUDINARY
// ══════════════════════════════════════════════════════════════

async function sha1(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(msg))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
}

async function cloudUpload(base64: string, folder: string): Promise<string | null> {
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
    if (!res.ok) { console.error("[cloudinary] upload:", res.status, await res.text()); return null }
    return (await res.json()).secure_url || null
  } catch (err) { console.error("[cloudinary] error:", err); return null }
}

async function cloudDeletePrefix(prefix: string): Promise<void> {
  if (!CLD_CLOUD || !CLD_KEY || !CLD_SECRET) return
  try {
    const auth = btoa(`${CLD_KEY}:${CLD_SECRET}`)
    await fetch(
      `https://api.cloudinary.com/v1_1/${CLD_CLOUD}/resources/image/upload?prefix=${encodeURIComponent(prefix)}&type=upload`,
      { method: "DELETE", headers: { "Authorization": `Basic ${auth}` } },
    )
  } catch {}
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

// ══════════════════════════════════════════════════════════════
// FULL SYNC — Nuclear rebuild of the entire Miro table
//
// 1. Delete existing frame (cascade deletes all children)
// 2. Query all shots from DB
// 3. Create frame → header → rows → images
// ══════════════════════════════════════════════════════════════

async function handleFullSync(supabase: any) {
  console.log("[full_sync] ═══ Starting full sync ═══")

  // 1. Delete existing frame + ALL its children
  const oldFrame = await findOurFrame()
  if (oldFrame) {
    console.log("[full_sync] Deleting old frame + children:", oldFrame)
    await deleteFrameAndChildren(oldFrame)
    await sleep(500)
  }

  // 2. Get all shots ordered by sequence + sort_order
  const { data: shots, error: shotsErr } = await supabase
    .from("shots").select("id, code, sequence, sort_order, concept_image_url")
    .order("sequence").order("sort_order").order("code")

  if (shotsErr) throw new Error(`DB shots query failed: ${shotsErr.message}`)
  const n = shots?.length || 0
  console.log(`[full_sync] Found ${n} shots`)

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
  console.log(`[full_sync] Frame created: ${frameId} (${fw}×${fh})`)

  await sleep(500)

  // 4. Create header cells
  for (let i = 0; i < COLS.length; i++) {
    await createCell(frameId, colX(i), hdrY(), COL_W[i], HDR_H,
      HDR_FILL[i], `<strong>${COLS[i]}</strong>`, HDR_TEXT[i], "14")
  }
  console.log("[full_sync] Header row created")

  // 5. Clear old miro_shot_rows and rebuild
  await supabase.from("miro_shot_rows").delete().not("id", "is", null)

  for (let r = 0; r < n; r++) {
    const shot = shots[r]
    const y = rowY(r)

    // Shot name cell
    const cellId = await createCell(frameId, colX(0), y, COL_W[0], ROW_H,
      CELL_FILL[0], `<strong>${shot.code}</strong>`, "#1a1a2e", "16")

    // Column cells (1..7)
    for (let c = 1; c < COLS.length; c++) {
      await createCell(frameId, colX(c), y, COL_W[c], ROW_H,
        CELL_FILL[c], "", "#94A3B8", "11")
    }

    // Save to DB
    await supabase.from("miro_shot_rows").insert({
      shot_id: shot.id,
      row_index: r,
      frame_id: frameId,
      shot_code_item_id: cellId,
    })

    // Reference image
    if (shot.concept_image_url) {
      try {
        await miroPost("/images", {
          data: { url: shot.concept_image_url },
          position: { x: colX(1), y, origin: "center" },
          geometry: { width: COL_W[1] - 20 },
          parent: { id: frameId },
        })
      } catch (e) {
        console.warn(`[full_sync] Reference img failed for ${shot.code}:`, e)
      }
    }

    console.log(`[full_sync] Row ${r}: ${shot.code}`)
  }

  // 6. Re-place WIP images from DB (using Cloudinary URLs)
  const { data: wipImgs } = await supabase
    .from("miro_wip_images").select("id, shot_id, department, image_url")
    .not("image_url", "is", null)

  if (wipImgs?.length) {
    const shotRowMap: Record<string, number> = {}
    shots.forEach((s: any, i: number) => { shotRowMap[s.id] = i })

    for (const wip of wipImgs) {
      const ri = shotRowMap[wip.shot_id]
      if (ri === undefined) continue
      const ci = deptCol(wip.department)
      if (ci < 0) continue
      try {
        const img = await miroPost("/images", {
          data: { url: wip.image_url },
          position: { x: colX(ci), y: rowY(ri), origin: "center" },
          geometry: { width: COL_W[ci] - 20 },
          parent: { id: frameId },
        })
        await supabase.from("miro_wip_images").update({ miro_item_id: img.id }).eq("id", wip.id)
      } catch (e) {
        console.warn(`[full_sync] WIP img failed:`, e)
      }
    }
  }

  console.log("[full_sync] ═══ Done ═══")
  return ok({ success: true, shots: n, frame_id: frameId })
}

// ══════════════════════════════════════════════════════════════
// CREATE SHOT ROW — Incremental add (fast, ~10 API calls)
//
// If no frame exists yet → creates frame + headers + row.
// If frame exists → expands frame + adds row.
// ══════════════════════════════════════════════════════════════

async function handleCreateShotRow(supabase: any, params: any) {
  const { shot_id, shot_code } = params
  if (!shot_id || !shot_code) return err("shot_id and shot_code required")

  // Already synced?
  const { data: existing } = await supabase
    .from("miro_shot_rows").select("id").eq("shot_id", shot_id).single()
  if (existing) return err("Shot already synced", 409)

  // Next row index
  const { data: rows } = await supabase
    .from("miro_shot_rows").select("row_index")
    .order("row_index", { ascending: false }).limit(1)
  const rowIndex = rows?.length ? rows[0].row_index + 1 : 0
  console.log(`[create] Shot ${shot_code} → row ${rowIndex}`)

  // Find or create frame
  let frameId = await findOurFrame()

  if (!frameId) {
    // No frame → create frame + headers
    console.log("[create] No frame found, creating...")
    const fw = frameW()
    const fh = frameH(1) // 1 row
    const frame = await miroPost("/frames", {
      data: { title: FRAME_TITLE, format: "custom", type: "freeform" },
      position: { x: fw / 2, y: fh / 2, origin: "center" },
      geometry: { width: fw, height: fh },
      style: { fillColor: "#ffffff" },
    })
    frameId = frame.id
    await sleep(500)

    // Create headers
    for (let i = 0; i < COLS.length; i++) {
      await createCell(frameId, colX(i), hdrY(), COL_W[i], HDR_H,
        HDR_FILL[i], `<strong>${COLS[i]}</strong>`, HDR_TEXT[i], "14")
    }
    console.log("[create] Frame + headers created")
  } else {
    // Frame exists → expand height
    const numRows = rowIndex + 1
    const newH = frameH(numRows)
    const fw = frameW()
    console.log(`[create] Expanding frame to ${fw}×${newH} for ${numRows} rows`)
    try {
      await miroPatch(`/frames/${frameId}`, {
        geometry: { width: fw, height: newH },
        position: { x: fw / 2, y: newH / 2, origin: "center" },
      })
    } catch (e) {
      console.warn("[create] Frame resize failed, doing full_sync:", e)
      return await handleFullSync(supabase)
    }
  }

  // Create cells for this row
  const y = rowY(rowIndex)
  const cellId = await createCell(frameId, colX(0), y, COL_W[0], ROW_H,
    CELL_FILL[0], `<strong>${shot_code}</strong>`, "#1a1a2e", "16")

  for (let c = 1; c < COLS.length; c++) {
    await createCell(frameId, colX(c), y, COL_W[c], ROW_H,
      CELL_FILL[c], "", "#94A3B8", "11")
  }

  // Save to DB
  const { error: dbErr } = await supabase.from("miro_shot_rows").insert({
    shot_id, row_index: rowIndex, frame_id: frameId, shot_code_item_id: cellId,
  })
  if (dbErr) {
    console.error("[create] DB insert error:", dbErr)
    return err(dbErr.message, 500)
  }

  console.log(`[create] Row created: ${shot_code} at row ${rowIndex}`)
  return ok({ success: true, row_index: rowIndex, frame_id: frameId })
}

// ══════════════════════════════════════════════════════════════
// DELETE SHOT ROW — Cleanup + full_sync to re-compact
// ══════════════════════════════════════════════════════════════

async function handleDeleteShotRow(supabase: any, params: any) {
  const { shot_id } = params
  if (!shot_id) return err("shot_id required")

  console.log(`[delete] Deleting shot ${shot_id}`)

  // Cleanup Cloudinary
  await cloudDeletePrefix(`bigrock-wip/${shot_id}`)

  // Delete from DB (cascade may have already done this)
  await supabase.from("miro_wip_images").delete().eq("shot_id", shot_id)
  await supabase.from("miro_shot_rows").delete().eq("shot_id", shot_id)

  // Full sync to rebuild the table compactly
  return await handleFullSync(supabase)
}

// ══════════════════════════════════════════════════════════════
// UPLOAD REFERENCE — Cloudinary → Miro (incremental)
// ══════════════════════════════════════════════════════════════

async function handleUploadReference(supabase: any, params: any) {
  const { shot_id, image_base64 } = params
  if (!shot_id || !image_base64) return err("shot_id and image_base64 required")

  // Upload to Cloudinary
  const url = await cloudUpload(image_base64, `bigrock-wip/${shot_id}/reference`)
  if (!url) return err("Cloudinary upload failed", 500)

  // Find frame
  const frameId = await findOurFrame()
  if (!frameId) {
    console.warn("[upload_ref] No frame, triggering full_sync")
    return await handleFullSync(supabase)
  }

  // Find row
  const { data: shotRow } = await supabase
    .from("miro_shot_rows").select("row_index").eq("shot_id", shot_id).single()
  if (!shotRow) return err("Shot not synced to Miro", 404)

  // Place image on top of the Reference cell
  const img = await miroPost("/images", {
    data: { url },
    position: { x: colX(1), y: rowY(shotRow.row_index), origin: "center" },
    geometry: { width: COL_W[1] - 20 },
    parent: { id: frameId },
  })

  return ok({ success: true, miro_item_id: img.id, image_url: url })
}

// ══════════════════════════════════════════════════════════════
// UPLOAD WIP IMAGE — Cloudinary → Miro (incremental)
// ══════════════════════════════════════════════════════════════

async function handleUploadWipImage(supabase: any, params: any) {
  const { shot_id, department, task_id, image_base64, uploaded_by } = params
  if (!shot_id || !department || !image_base64) return err("shot_id, department, image_base64 required")

  const ci = deptCol(department)
  if (ci < 0) return err(`Invalid department: ${department}`)

  // Upload to Cloudinary
  const url = await cloudUpload(image_base64, `bigrock-wip/${shot_id}/${department}`)
  if (!url) return err("Cloudinary upload failed", 500)

  // Find frame
  const frameId = await findOurFrame()
  if (!frameId) return await handleFullSync(supabase)

  // Find row
  const { data: shotRow } = await supabase
    .from("miro_shot_rows").select("row_index").eq("shot_id", shot_id).single()
  if (!shotRow) return err("Shot not synced to Miro", 404)

  // Offset if multiple images in same cell
  const { count } = await supabase
    .from("miro_wip_images").select("id", { count: "exact", head: true })
    .eq("shot_id", shot_id).eq("department", department)
  const offset = (count || 0) * 25

  // Place image
  const img = await miroPost("/images", {
    data: { url },
    position: {
      x: colX(ci) + offset,
      y: rowY(shotRow.row_index) + offset,
      origin: "center",
    },
    geometry: { width: COL_W[ci] - 30 },
    parent: { id: frameId },
  })

  // Save to DB
  const { data: record } = await supabase.from("miro_wip_images").insert({
    shot_id,
    task_id: task_id || null,
    department,
    miro_item_id: img.id,
    uploaded_by: uploaded_by || null,
    image_url: url,
  }).select().single()

  return ok({ success: true, miro_item_id: img.id, image_url: url, record })
}

// ══════════════════════════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════════════════════════

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()
    console.log(`[miro-sync] Action: ${action}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Auth check
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return err("Unauthorized", 401)
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return err("Unauthorized", 401)

    switch (action) {
      case "full_sync":        return await handleFullSync(supabase)
      case "create_shot_row":  return await handleCreateShotRow(supabase, params)
      case "delete_shot_row":  return await handleDeleteShotRow(supabase, params)
      case "upload_wip_image": return await handleUploadWipImage(supabase, params)
      case "upload_reference": return await handleUploadReference(supabase, params)
      case "init_board":       return await handleFullSync(supabase) // init = full sync
      default:                 return err(`Unknown action: ${action}`)
    }
  } catch (e) {
    console.error("[miro-sync] Unhandled error:", e)
    return err(e.message || "Internal error", 500)
  }
})

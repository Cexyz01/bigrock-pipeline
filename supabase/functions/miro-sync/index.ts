import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── Config ──
const MIRO_API = "https://api.miro.com/v2"
const BOARD_ID = Deno.env.get("MIRO_BOARD_ID")!
const MIRO_TOKEN = Deno.env.get("MIRO_ACCESS_TOKEN")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Cloudinary — for persistent image backup + URL for Miro
const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME") || ""
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY") || ""
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET") || ""

// ══════════════════════════════════════════════════
// MIRO BOARD LAYOUT — 2× Scale
// Uses shapes (NOT frames) so items stay visible on top
// ══════════════════════════════════════════════════

const BASE_X = 0
const BASE_Y = 0
const TITLE_HEIGHT = 200
const HEADER_HEIGHT = 160
const ROW_HEIGHT = 600
const ROW_GAP = 100
const COL_WIDTH = 600
const COL_GAP = 80
const SHOT_COL_WIDTH = 400

const COL_X = [
  0,
  SHOT_COL_WIDTH + COL_GAP,                              // 480
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 1,  // 1160
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 2,  // 1840
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 3,  // 2520
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 4,  // 3200
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 5,  // 3880
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 6,  // 4560
]

const COL_LABELS = ["Shot", "Reference", "Concept", "Modeling", "Texturing", "Rigging", "Animation", "Comp"]
const DEPT_ORDER = ["concept", "modeling", "texturing", "rigging", "animation", "compositing"]

const DEPT_STICKY_COLORS: Record<string, string> = {
  concept: "light_pink",
  modeling: "dark_blue",
  texturing: "yellow",
  rigging: "light_green",
  animation: "pink",
  compositing: "light_blue",
}

const HEADER_STICKY_COLORS = ["gray", "gray", "light_pink", "dark_blue", "yellow", "light_green", "pink", "light_blue"]

const TOTAL_WIDTH = COL_X[7] + COL_WIDTH

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── Helpers ──

function getRowY(rowIndex: number): number {
  return BASE_Y + TITLE_HEIGHT + HEADER_HEIGHT + ROW_GAP + rowIndex * (ROW_HEIGHT + ROW_GAP)
}

function getDeptColIndex(department: string): number {
  const idx = DEPT_ORDER.indexOf(department)
  return idx >= 0 ? idx + 2 : -1
}

async function miroPost(path: string, body: any) {
  const res = await fetch(`${MIRO_API}/boards/${BOARD_ID}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MIRO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Miro API ${res.status}: ${text}`)
  }
  return res.json()
}

async function miroDelete(itemId: string): Promise<boolean> {
  try {
    const res = await fetch(`${MIRO_API}/boards/${BOARD_ID}/items/${itemId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${MIRO_TOKEN}` },
    })
    return res.ok || res.status === 404
  } catch (err) {
    console.warn(`Failed to delete Miro item ${itemId}:`, err)
    return false
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// ── Cloudinary Helpers ──

async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

async function uploadToCloudinary(imageBase64: string, folder: string): Promise<string | null> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn("Cloudinary not configured, skipping upload")
    return null
  }
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`
    const signature = await sha1(paramsToSign + CLOUDINARY_API_SECRET)

    const formData = new FormData()
    formData.append("file", imageBase64)
    formData.append("folder", folder)
    formData.append("timestamp", timestamp)
    formData.append("api_key", CLOUDINARY_API_KEY)
    formData.append("signature", signature)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    )
    if (!res.ok) {
      const text = await res.text()
      console.error("Cloudinary upload failed:", res.status, text)
      return null
    }
    const json = await res.json()
    return json.secure_url || null
  } catch (err) {
    console.error("Cloudinary upload error:", err)
    return null
  }
}

async function deleteCloudinaryByPrefix(prefix: string): Promise<boolean> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return false
  try {
    const auth = btoa(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`)
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image/upload?prefix=${encodeURIComponent(prefix)}&type=upload`,
      { method: "DELETE", headers: { "Authorization": `Basic ${auth}` } }
    )
    return res.ok
  } catch (err) {
    console.warn("Cloudinary delete error:", err)
    return false
  }
}

// ══════════════════════════════════════════════════
// ACTION: Init Board
// ══════════════════════════════════════════════════

async function handleInitBoard() {
  const centerX = BASE_X + TOTAL_WIDTH / 2

  await miroPost("/texts", {
    data: { content: `<strong>BIGROCK PIPELINE</strong>` },
    position: { x: centerX, y: BASE_Y + 50, origin: "center" },
    geometry: { width: 1600 },
    style: { fontSize: "64", textAlign: "center", color: "#6C5CE7" },
  })

  await miroPost("/texts", {
    data: { content: "Storyboard & WIP Tracker" },
    position: { x: centerX, y: BASE_Y + 120, origin: "center" },
    geometry: { width: 1600 },
    style: { fontSize: "32", textAlign: "center", color: "#94A3B8" },
  })

  await miroPost("/shapes", {
    data: { shape: "rectangle" },
    position: { x: centerX, y: BASE_Y + TITLE_HEIGHT - 20, origin: "center" },
    geometry: { width: TOTAL_WIDTH - 100, height: 3 },
    style: { fillColor: "#E2E8F0", borderWidth: "0", borderOpacity: "0" },
  })

  const headerY = BASE_Y + TITLE_HEIGHT + HEADER_HEIGHT / 2
  for (let i = 0; i < COL_LABELS.length; i++) {
    const colWidth = i === 0 ? SHOT_COL_WIDTH : COL_WIDTH
    const colCenterX = BASE_X + COL_X[i] + colWidth / 2
    await miroPost("/sticky_notes", {
      data: { content: `<strong>${COL_LABELS[i]}</strong>`, shape: "square" },
      position: { x: colCenterX, y: headerY, origin: "center" },
      geometry: { width: colWidth - 30 },
      style: { fillColor: HEADER_STICKY_COLORS[i], textAlign: "center", textAlignVertical: "middle" },
    })
  }

  return jsonResponse({ success: true, message: "Board initialized" })
}

// ══════════════════════════════════════════════════
// ACTION: Create Shot Row — uses SHAPE (not frame) for bg
// ══════════════════════════════════════════════════

async function handleCreateShotRow(supabase: any, params: any) {
  const { shot_id, shot_code } = params
  if (!shot_id || !shot_code) return jsonResponse({ error: "shot_id and shot_code required" }, 400)

  const { data: existing } = await supabase
    .from("miro_shot_rows").select("id").eq("shot_id", shot_id).single()
  if (existing) return jsonResponse({ error: "Shot already synced", row: existing }, 409)

  const { data: rows } = await supabase
    .from("miro_shot_rows").select("row_index")
    .order("row_index", { ascending: false }).limit(1)
  const rowIndex = rows && rows.length > 0 ? rows[0].row_index + 1 : 0

  const y = getRowY(rowIndex)
  const centerX = BASE_X + TOTAL_WIDTH / 2

  // ── 1. Background shape (white rectangle, no title shown) ──
  const bg = await miroPost("/shapes", {
    data: { shape: "round_rectangle" },
    position: { x: centerX, y: y + ROW_HEIGHT / 2, origin: "center" },
    geometry: { width: TOTAL_WIDTH + 60, height: ROW_HEIGHT },
    style: { fillColor: "#FFFFFF", borderColor: "#E2E8F0", borderWidth: "2", borderOpacity: "1.0" },
  })

  // ── 2. Shot code text ──
  const shotText = await miroPost("/texts", {
    data: { content: `<strong>${shot_code}</strong>` },
    position: { x: BASE_X + COL_X[0] + SHOT_COL_WIDTH / 2, y: y + ROW_HEIGHT / 2, origin: "center" },
    geometry: { width: SHOT_COL_WIDTH - 30 },
    style: { fontSize: "48", textAlign: "center", color: "#1a1a2e" },
  })

  // ── 3. Purple accent bar ──
  await miroPost("/shapes", {
    data: { shape: "rectangle" },
    position: { x: BASE_X + COL_X[0] + 20, y: y + ROW_HEIGHT / 2, origin: "center" },
    geometry: { width: 8, height: 140 },
    style: { fillColor: "#6C5CE7", borderWidth: "0", borderOpacity: "0" },
  })

  // ── 4. Reference placeholder ──
  await miroPost("/sticky_notes", {
    data: { content: "Reference", shape: "square" },
    position: { x: BASE_X + COL_X[1] + COL_WIDTH / 2, y: y + ROW_HEIGHT / 2, origin: "center" },
    geometry: { width: COL_WIDTH - 40 },
    style: { fillColor: "gray", textAlign: "center", textAlignVertical: "middle" },
  })

  // ── 5. Department placeholders ──
  for (let i = 2; i < COL_LABELS.length; i++) {
    const deptId = DEPT_ORDER[i - 2]
    await miroPost("/sticky_notes", {
      data: { content: COL_LABELS[i], shape: "square" },
      position: { x: BASE_X + COL_X[i] + COL_WIDTH / 2, y: y + ROW_HEIGHT / 2, origin: "center" },
      geometry: { width: COL_WIDTH - 40 },
      style: { fillColor: DEPT_STICKY_COLORS[deptId] || "gray", textAlign: "center", textAlignVertical: "middle" },
    })
  }

  // ── 6. Save to DB (frame_id stores the bg shape ID) ──
  const { data: row, error } = await supabase.from("miro_shot_rows").insert({
    shot_id,
    row_index: rowIndex,
    frame_id: bg.id,
    shot_code_item_id: shotText.id,
  }).select().single()

  if (error) return jsonResponse({ error: error.message }, 500)
  return jsonResponse({ success: true, row })
}

// ══════════════════════════════════════════════════
// ACTION: Delete Shot Row
// ══════════════════════════════════════════════════

async function handleDeleteShotRow(supabase: any, params: any) {
  const { shot_id } = params
  if (!shot_id) return jsonResponse({ error: "shot_id required" }, 400)

  const { data: shotRow } = await supabase
    .from("miro_shot_rows").select("id, frame_id, shot_code_item_id")
    .eq("shot_id", shot_id).single()

  if (!shotRow) return jsonResponse({ success: true, message: "Not synced" })

  const { data: wipImages } = await supabase
    .from("miro_wip_images").select("miro_item_id").eq("shot_id", shot_id)

  const deletes: Promise<boolean>[] = []
  if (shotRow.frame_id) deletes.push(miroDelete(shotRow.frame_id))
  if (shotRow.shot_code_item_id) deletes.push(miroDelete(shotRow.shot_code_item_id))
  if (wipImages) {
    for (const img of wipImages) {
      if (img.miro_item_id) deletes.push(miroDelete(img.miro_item_id))
    }
  }
  await Promise.all(deletes)

  await deleteCloudinaryByPrefix(`bigrock-wip/${shot_id}`)
  await supabase.from("miro_wip_images").delete().eq("shot_id", shot_id)
  await supabase.from("miro_shot_rows").delete().eq("shot_id", shot_id)

  return jsonResponse({ success: true })
}

// ══════════════════════════════════════════════════
// ACTION: Upload Reference — Cloudinary first, then Miro URL
// ══════════════════════════════════════════════════

async function handleUploadReference(supabase: any, params: any) {
  const { shot_id, image_base64 } = params
  if (!shot_id || !image_base64) {
    return jsonResponse({ error: "shot_id and image_base64 required" }, 400)
  }

  const { data: shotRow } = await supabase
    .from("miro_shot_rows").select("row_index")
    .eq("shot_id", shot_id).single()
  if (!shotRow) return jsonResponse({ error: "Shot not synced to Miro yet" }, 404)

  // Upload to Cloudinary first to get a proper HTTPS URL
  const cloudinaryUrl = await uploadToCloudinary(image_base64, `bigrock-wip/${shot_id}/reference`)
  if (!cloudinaryUrl) {
    return jsonResponse({ error: "Failed to upload image to Cloudinary" }, 500)
  }

  const y = getRowY(shotRow.row_index)
  const x = BASE_X + COL_X[1] + COL_WIDTH / 2
  const imgY = y + ROW_HEIGHT / 2

  // Use Cloudinary HTTPS URL for Miro (Miro doesn't accept base64)
  const image = await miroPost("/images", {
    data: { url: cloudinaryUrl },
    position: { x, y: imgY, origin: "center" },
    geometry: { width: COL_WIDTH - 60 },
  })

  return jsonResponse({ success: true, miro_item_id: image.id, image_url: cloudinaryUrl })
}

// ══════════════════════════════════════════════════
// ACTION: Upload WIP Image — Cloudinary first, then Miro URL
// ══════════════════════════════════════════════════

async function handleUploadWipImage(supabase: any, params: any) {
  const { shot_id, department, task_id, image_base64, uploaded_by } = params
  if (!shot_id || !department || !image_base64) {
    return jsonResponse({ error: "shot_id, department, and image_base64 required" }, 400)
  }

  const colIndex = getDeptColIndex(department)
  if (colIndex < 0) return jsonResponse({ error: `Invalid department: ${department}` }, 400)

  const { data: shotRow } = await supabase
    .from("miro_shot_rows").select("row_index")
    .eq("shot_id", shot_id).single()
  if (!shotRow) return jsonResponse({ error: "Shot not synced to Miro yet" }, 404)

  const { count } = await supabase
    .from("miro_wip_images").select("id", { count: "exact", head: true })
    .eq("shot_id", shot_id).eq("department", department)
  const offset = (count || 0) * 40

  const y = getRowY(shotRow.row_index)
  const x = BASE_X + COL_X[colIndex] + COL_WIDTH / 2 + offset
  const imgY = y + ROW_HEIGHT / 2 + offset

  // Upload to Cloudinary first to get a proper HTTPS URL
  const cloudinaryFolder = `bigrock-wip/${shot_id}/${department}`
  const cloudinaryUrl = await uploadToCloudinary(image_base64, cloudinaryFolder)
  if (!cloudinaryUrl) {
    return jsonResponse({ error: "Failed to upload image to Cloudinary" }, 500)
  }

  // Use Cloudinary URL for Miro
  const image = await miroPost("/images", {
    data: { url: cloudinaryUrl },
    position: { x, y: imgY, origin: "center" },
    geometry: { width: 520 },
  })

  const { data: record, error } = await supabase.from("miro_wip_images").insert({
    shot_id,
    task_id: task_id || null,
    department,
    miro_item_id: image.id,
    uploaded_by: uploaded_by || null,
    image_url: cloudinaryUrl,
  }).select().single()

  if (error) return jsonResponse({ error: error.message }, 500)
  return jsonResponse({ success: true, miro_item_id: image.id, image_url: cloudinaryUrl, record })
}

// ══════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401)
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401)

    switch (action) {
      case "create_shot_row": return await handleCreateShotRow(supabase, params)
      case "delete_shot_row": return await handleDeleteShotRow(supabase, params)
      case "upload_wip_image": return await handleUploadWipImage(supabase, params)
      case "upload_reference": return await handleUploadReference(supabase, params)
      case "init_board": return await handleInitBoard()
      default: return jsonResponse({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error("miro-sync error:", err)
    return jsonResponse({ error: err.message || "Internal error" }, 500)
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── Config ──
const MIRO_API = "https://api.miro.com/v2"
const BOARD_ID = Deno.env.get("MIRO_BOARD_ID")!
const MIRO_TOKEN = Deno.env.get("MIRO_ACCESS_TOKEN")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// ── Miro Board Layout Constants ──
const BASE_X = 0
const BASE_Y = 0
const HEADER_HEIGHT = 80
const ROW_HEIGHT = 300
const ROW_GAP = 50
const COL_WIDTH = 300
const COL_GAP = 40

// Column X positions (left edge of each column)
const COL_X = [
  0,                          // Col 0: Shot Code
  200 + COL_GAP,              // Col 1: Reference
  200 + COL_GAP + (COL_WIDTH + COL_GAP) * 1, // Col 2: Concept
  200 + COL_GAP + (COL_WIDTH + COL_GAP) * 2, // Col 3: Modeling
  200 + COL_GAP + (COL_WIDTH + COL_GAP) * 3, // Col 4: Texturing
  200 + COL_GAP + (COL_WIDTH + COL_GAP) * 4, // Col 5: Rigging
  200 + COL_GAP + (COL_WIDTH + COL_GAP) * 5, // Col 6: Animation
  200 + COL_GAP + (COL_WIDTH + COL_GAP) * 6, // Col 7: Compositing
]
const COL_LABELS = ["Shot", "Reference", "Concept", "Modeling", "Texturing", "Rigging", "Animation", "Comp"]
const DEPT_ORDER = ["concept", "modeling", "texturing", "rigging", "animation", "compositing"]

const TOTAL_WIDTH = COL_X[7] + COL_WIDTH

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── Helpers ──
function getRowY(rowIndex: number): number {
  return BASE_Y + HEADER_HEIGHT + ROW_GAP + rowIndex * (ROW_HEIGHT + ROW_GAP)
}

function getDeptColIndex(department: string): number {
  const idx = DEPT_ORDER.indexOf(department)
  return idx >= 0 ? idx + 2 : -1 // +2 because cols 0,1 are code and reference
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

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

// ── Action: Create Shot Row ──
async function handleCreateShotRow(supabase: any, params: any) {
  const { shot_id, shot_code } = params
  if (!shot_id || !shot_code) return jsonResponse({ error: "shot_id and shot_code required" }, 400)

  // Check if already synced
  const { data: existing } = await supabase
    .from("miro_shot_rows")
    .select("id")
    .eq("shot_id", shot_id)
    .single()
  if (existing) return jsonResponse({ error: "Shot already synced", row: existing }, 409)

  // Get next row index
  const { data: rows } = await supabase
    .from("miro_shot_rows")
    .select("row_index")
    .order("row_index", { ascending: false })
    .limit(1)
  const rowIndex = rows && rows.length > 0 ? rows[0].row_index + 1 : 0

  const y = getRowY(rowIndex)

  // 1. Create row frame
  const frame = await miroPost("/frames", {
    data: { title: shot_code, format: "custom" },
    geometry: { width: TOTAL_WIDTH + 40, height: ROW_HEIGHT },
    position: { x: BASE_X + TOTAL_WIDTH / 2, y: y + ROW_HEIGHT / 2, origin: "center" },
    style: { fillColor: "#F8FAFC" },
  })

  // 2. Create shot code text
  const shotText = await miroPost("/texts", {
    data: { content: `<strong>${shot_code}</strong>` },
    position: { x: BASE_X + COL_X[0] + 100, y: y + ROW_HEIGHT / 2, origin: "center" },
    geometry: { width: 180 },
    style: { fontSize: "24", textAlign: "center", color: "#1a1a2e" },
  })

  // 3. Create department placeholder sticky notes
  for (let i = 0; i < COL_LABELS.length; i++) {
    if (i <= 1) continue // skip shot code and reference columns (no placeholder needed beyond text)
    await miroPost("/sticky_notes", {
      data: { content: COL_LABELS[i], shape: "square" },
      position: { x: BASE_X + COL_X[i] + COL_WIDTH / 2, y: y + ROW_HEIGHT / 2, origin: "center" },
      geometry: { width: COL_WIDTH - 20 },
      style: { fillColor: "#E8ECF1", textAlign: "center", textAlignVertical: "middle" },
    })
  }

  // 4. Save to database
  const { data: row, error } = await supabase.from("miro_shot_rows").insert({
    shot_id,
    row_index: rowIndex,
    frame_id: frame.id,
    shot_code_item_id: shotText.id,
  }).select().single()

  if (error) return jsonResponse({ error: error.message }, 500)

  return jsonResponse({ success: true, row })
}

// ── Action: Upload WIP Image ──
async function handleUploadWipImage(supabase: any, params: any) {
  const { shot_id, department, task_id, image_base64, uploaded_by } = params
  if (!shot_id || !department || !image_base64) {
    return jsonResponse({ error: "shot_id, department, and image_base64 required" }, 400)
  }

  const colIndex = getDeptColIndex(department)
  if (colIndex < 0) return jsonResponse({ error: `Invalid department: ${department}` }, 400)

  // Find shot row
  const { data: shotRow } = await supabase
    .from("miro_shot_rows")
    .select("row_index, frame_id")
    .eq("shot_id", shot_id)
    .single()
  if (!shotRow) return jsonResponse({ error: "Shot not synced to Miro yet" }, 404)

  // Count existing images in this slot for stacking offset
  const { count } = await supabase
    .from("miro_wip_images")
    .select("id", { count: "exact", head: true })
    .eq("shot_id", shot_id)
    .eq("department", department)
  const offset = (count || 0) * 20

  const y = getRowY(shotRow.row_index)
  const x = BASE_X + COL_X[colIndex] + COL_WIDTH / 2 + offset
  const imgY = y + ROW_HEIGHT / 2 + offset

  // Upload image to Miro
  const image = await miroPost("/images", {
    data: { url: image_base64 },
    position: { x, y: imgY, origin: "center" },
    geometry: { width: 260 },
  })

  // Save tracking record
  const { data: record, error } = await supabase.from("miro_wip_images").insert({
    shot_id,
    task_id: task_id || null,
    department,
    miro_item_id: image.id,
    uploaded_by: uploaded_by || null,
  }).select().single()

  if (error) return jsonResponse({ error: error.message }, 500)

  return jsonResponse({ success: true, miro_item_id: image.id, record })
}

// ── Action: Init Board Header ──
async function handleInitBoard() {
  // Create header labels
  const y = BASE_Y + HEADER_HEIGHT / 2
  for (let i = 0; i < COL_LABELS.length; i++) {
    await miroPost("/texts", {
      data: { content: `<strong>${COL_LABELS[i]}</strong>` },
      position: { x: BASE_X + COL_X[i] + (i === 0 ? 100 : COL_WIDTH / 2), y, origin: "center" },
      geometry: { width: i === 0 ? 180 : COL_WIDTH },
      style: { fontSize: "18", textAlign: "center", color: "#6C5CE7" },
    })
  }
  return jsonResponse({ success: true, message: "Board headers created" })
}

// ── Main Handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { action, ...params } = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401)
    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401)

    switch (action) {
      case "create_shot_row":
        return await handleCreateShotRow(supabase, params)
      case "upload_wip_image":
        return await handleUploadWipImage(supabase, params)
      case "init_board":
        return await handleInitBoard()
      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error("miro-sync error:", err)
    return jsonResponse({ error: err.message || "Internal error" }, 500)
  }
})

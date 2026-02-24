import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ── Config ──
const MIRO_API = "https://api.miro.com/v2"
const BOARD_ID = Deno.env.get("MIRO_BOARD_ID")!
const MIRO_TOKEN = Deno.env.get("MIRO_ACCESS_TOKEN")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Cloudinary — for persistent image backup (review page)
const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME") || ""
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY") || ""
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET") || ""

// ══════════════════════════════════════════════════
// MIRO BOARD LAYOUT — 3× Scale for comfortable zoom
// Design matches BigRock Pipeline site style
// Accent: #6C5CE7 · Dark: #1a1a2e · Muted: #64748B
// ══════════════════════════════════════════════════

const BASE_X = 0
const BASE_Y = 0
const TITLE_HEIGHT = 300       // Space for board title banner
const HEADER_HEIGHT = 240      // Header row height (80 × 3)
const ROW_HEIGHT = 900         // Shot row height (300 × 3)
const ROW_GAP = 150            // Gap between rows (50 × 3)
const COL_WIDTH = 900          // Department column width (300 × 3)
const COL_GAP = 120            // Gap between columns (40 × 3)
const SHOT_COL_WIDTH = 600     // Shot code column width (200 × 3)

// Column X positions (left edge of each column)
const COL_X = [
  0,                                                       // Col 0: Shot Code
  SHOT_COL_WIDTH + COL_GAP,                                 // Col 1: Reference
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 1,    // Col 2: Concept
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 2,    // Col 3: Modeling
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 3,    // Col 4: Texturing
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 4,    // Col 5: Rigging
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 5,    // Col 6: Animation
  SHOT_COL_WIDTH + COL_GAP + (COL_WIDTH + COL_GAP) * 6,    // Col 7: Compositing
]

const COL_LABELS = ["Shot", "Reference", "Concept", "Modeling", "Texturing", "Rigging", "Animation", "Comp"]
const DEPT_ORDER = ["concept", "modeling", "texturing", "rigging", "animation", "compositing"]

// Department sticky note colors — matches site department colors
const DEPT_STICKY_COLORS: Record<string, string> = {
  concept: "light_pink",       // #E879F9 → light_pink
  modeling: "dark_blue",       // #A78BFA → dark_blue (closest to purple-blue)
  texturing: "yellow",         // #F59E0B → yellow
  rigging: "light_green",      // #34D399 → light_green
  animation: "pink",           // #F87171 → pink
  compositing: "light_blue",   // #60A5FA → light_blue
}

// Header sticky colors per column index (0=Shot, 1=Ref, 2+=departments)
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
  return idx >= 0 ? idx + 2 : -1 // +2 because cols 0,1 are Shot Code and Reference
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

// ── Cloudinary Upload ──
// Signed upload: SHA-1(sorted_params + api_secret)

async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

async function uploadToCloudinary(imageBase64: string, folder: string): Promise<string | null> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn("Cloudinary not configured, skipping backup upload")
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

// ══════════════════════════════════════════════════
// ACTION: Init Board — Creates title banner + header row
// ══════════════════════════════════════════════════

async function handleInitBoard() {
  const centerX = BASE_X + TOTAL_WIDTH / 2

  // ── 1. Title Banner ──
  // Large "BIGROCK PIPELINE" title
  await miroPost("/texts", {
    data: { content: `<strong>BIGROCK PIPELINE</strong>` },
    position: { x: centerX, y: BASE_Y + 80, origin: "center" },
    geometry: { width: 2400 },
    style: { fontSize: "96", textAlign: "center", color: "#6C5CE7" },
  })

  // Subtitle
  await miroPost("/texts", {
    data: { content: "Storyboard & WIP Tracker" },
    position: { x: centerX, y: BASE_Y + 180, origin: "center" },
    geometry: { width: 2400 },
    style: { fontSize: "48", textAlign: "center", color: "#94A3B8" },
  })

  // ── 2. Separator line (thin frame) ──
  await miroPost("/shapes", {
    data: { shape: "rectangle" },
    position: { x: centerX, y: BASE_Y + TITLE_HEIGHT - 30, origin: "center" },
    geometry: { width: TOTAL_WIDTH - 200, height: 4 },
    style: { fillColor: "#E2E8F0", borderWidth: "0", borderOpacity: "0" },
  })

  // ── 3. Header Row — Sticky notes as column headers ──
  const headerY = BASE_Y + TITLE_HEIGHT + HEADER_HEIGHT / 2

  for (let i = 0; i < COL_LABELS.length; i++) {
    const colWidth = i === 0 ? SHOT_COL_WIDTH : COL_WIDTH
    const colCenterX = BASE_X + COL_X[i] + colWidth / 2

    // Header sticky note with department color
    await miroPost("/sticky_notes", {
      data: { content: `<strong>${COL_LABELS[i]}</strong>`, shape: "square" },
      position: { x: colCenterX, y: headerY, origin: "center" },
      geometry: { width: colWidth - 40 },
      style: { fillColor: HEADER_STICKY_COLORS[i], textAlign: "center", textAlignVertical: "middle" },
    })
  }

  return jsonResponse({ success: true, message: "Board initialized with title and headers" })
}

// ══════════════════════════════════════════════════
// ACTION: Create Shot Row — Creates a row on Miro for a shot
// ══════════════════════════════════════════════════

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
  const centerX = BASE_X + TOTAL_WIDTH / 2

  // ── 1. Row Frame — Light background container ──
  const frame = await miroPost("/frames", {
    data: { title: shot_code, format: "custom" },
    geometry: { width: TOTAL_WIDTH + 80, height: ROW_HEIGHT },
    position: { x: centerX, y: y + ROW_HEIGHT / 2, origin: "center" },
    style: { fillColor: "#FFFFFF" },
  })

  // ── 2. Shot Code — Bold accent text on the left ──
  const shotText = await miroPost("/texts", {
    data: { content: `<strong>${shot_code}</strong>` },
    position: { x: BASE_X + COL_X[0] + SHOT_COL_WIDTH / 2, y: y + ROW_HEIGHT / 2, origin: "center" },
    geometry: { width: SHOT_COL_WIDTH - 40 },
    style: { fontSize: "72", textAlign: "center", color: "#1a1a2e" },
  })

  // ── 3. Shot Code accent indicator — small purple bar ──
  await miroPost("/shapes", {
    data: { shape: "rectangle" },
    position: { x: BASE_X + COL_X[0] + 30, y: y + ROW_HEIGHT / 2, origin: "center" },
    geometry: { width: 12, height: 200 },
    style: { fillColor: "#6C5CE7", borderWidth: "0", borderOpacity: "0" },
  })

  // ── 4. Department placeholder sticky notes ──
  for (let i = 2; i < COL_LABELS.length; i++) {
    const deptId = DEPT_ORDER[i - 2]
    const stickyColor = DEPT_STICKY_COLORS[deptId] || "gray"

    await miroPost("/sticky_notes", {
      data: { content: `${COL_LABELS[i]}\n\nWIP images will appear here`, shape: "square" },
      position: { x: BASE_X + COL_X[i] + COL_WIDTH / 2, y: y + ROW_HEIGHT / 2, origin: "center" },
      geometry: { width: COL_WIDTH - 60 },
      style: { fillColor: stickyColor, textAlign: "center", textAlignVertical: "middle" },
    })
  }

  // ── 5. Reference column placeholder ──
  await miroPost("/sticky_notes", {
    data: { content: "Reference\n\nDrop reference image here", shape: "square" },
    position: { x: BASE_X + COL_X[1] + COL_WIDTH / 2, y: y + ROW_HEIGHT / 2, origin: "center" },
    geometry: { width: COL_WIDTH - 60 },
    style: { fillColor: "gray", textAlign: "center", textAlignVertical: "middle" },
  })

  // ── 6. Save to database ──
  const { data: row, error } = await supabase.from("miro_shot_rows").insert({
    shot_id,
    row_index: rowIndex,
    frame_id: frame.id,
    shot_code_item_id: shotText.id,
  }).select().single()

  if (error) return jsonResponse({ error: error.message }, 500)

  return jsonResponse({ success: true, row })
}

// ══════════════════════════════════════════════════
// ACTION: Upload WIP Image — Places image in the correct cell
// ══════════════════════════════════════════════════

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
  const offset = (count || 0) * 60  // 20 × 3 = 60px offset per stacked image

  const y = getRowY(shotRow.row_index)
  const x = BASE_X + COL_X[colIndex] + COL_WIDTH / 2 + offset
  const imgY = y + ROW_HEIGHT / 2 + offset

  // Upload to Miro + Cloudinary in parallel
  const cloudinaryFolder = `bigrock-wip/${shot_id}/${department}`
  const [image, cloudinaryUrl] = await Promise.all([
    // Miro — 780px wide (260 × 3)
    miroPost("/images", {
      data: { url: image_base64 },
      position: { x, y: imgY, origin: "center" },
      geometry: { width: 780 },
    }),
    // Cloudinary — persistent backup for review page
    uploadToCloudinary(image_base64, cloudinaryFolder),
  ])

  // Save tracking record (with Cloudinary URL if available)
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

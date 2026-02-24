// =============================================
// MIRO SYNC — Helper functions for Miro Edge Function
// =============================================

import { supabase } from './supabase'

const FUNCTION_NAME = 'miro-sync'

async function callMiroSync(payload) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { data: null, error: 'Not authenticated' }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { data: null, error: json.error || `Miro sync failed (${res.status})` }
  return { data: json, error: null }
}

// Create a shot row on the Miro board
export async function createMiroShotRow(shotId, shotCode) {
  return callMiroSync({
    action: 'create_shot_row',
    shot_id: shotId,
    shot_code: shotCode,
  })
}

// Upload a WIP image to the correct Miro cell
export async function uploadWipImageToMiro(shotId, department, taskId, imageBase64, uploadedBy) {
  return callMiroSync({
    action: 'upload_wip_image',
    shot_id: shotId,
    department,
    task_id: taskId,
    image_base64: imageBase64,
    uploaded_by: uploadedBy,
  })
}

// Initialize board headers (one-time, staff only)
export async function initMiroBoard() {
  return callMiroSync({ action: 'init_board' })
}

// Convert a File to base64 data URL string
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

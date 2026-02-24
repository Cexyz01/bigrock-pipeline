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

// Delete a shot row from Miro + Cloudinary
export async function deleteMiroShotRow(shotId) {
  return callMiroSync({
    action: 'delete_shot_row',
    shot_id: shotId,
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

// Upload multiple WIP images to the correct Miro cell (batch)
export async function uploadWipImagesToMiro(shotId, department, taskId, imagesBase64, uploadedBy) {
  return callMiroSync({
    action: 'upload_wip_images',
    shot_id: shotId,
    department,
    task_id: taskId,
    images_base64: imagesBase64,
    uploaded_by: uploadedBy,
  })
}

// Upload a reference image to the Reference column on Miro
export async function uploadReferenceToMiro(shotId, imageBase64) {
  return callMiroSync({
    action: 'upload_reference',
    shot_id: shotId,
    image_base64: imageBase64,
  })
}

// Full sync — rebuilds the entire Miro table from scratch
export async function fullSyncMiro() {
  return callMiroSync({ action: 'full_sync' })
}

// Initialize board (same as full sync)
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

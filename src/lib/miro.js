// =============================================
// MIRO SYNC — Helper functions for Miro Edge Function
// =============================================

import { supabase } from './supabase'

const FUNCTION_NAME = 'miro-sync'

async function callMiroSync(payload) {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: payload,
  })
  if (error) {
    // error.message may contain the response body or status
    const msg = typeof error === 'string' ? error : (error.message || error.context?.message || 'Unknown error')
    return { data: null, error: msg }
  }
  return { data, error: null }
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

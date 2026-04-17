// =============================================
// MIRO SYNC — Helper functions for Miro Edge Function
// =============================================

import { supabase } from './supabase'

const FUNCTION_NAME = 'miro-sync'

async function callMiroSync(payload) {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: payload,
  })
  if (error) return { data: null, error: error.message || 'Miro sync failed' }
  return { data, error: null }
}

// Create a new Miro board for a project (admin only)
export async function createMiroBoard(projectId, projectName) {
  return callMiroSync({
    action: 'create_board',
    project_id: projectId,
    project_name: projectName,
  })
}

// Create a shot row on the Miro board
export async function createMiroShotRow(shotId, shotCode, boardId) {
  return callMiroSync({
    action: 'create_shot_row',
    shot_id: shotId,
    shot_code: shotCode,
    ...(boardId && { board_id: boardId }),
  })
}

// Delete a shot row from Miro + Cloudinary
export async function deleteMiroShotRow(shotId, boardId) {
  return callMiroSync({
    action: 'delete_shot_row',
    shot_id: shotId,
    ...(boardId && { board_id: boardId }),
  })
}

// Upload a WIP image to the correct Miro cell
export async function uploadWipImageToMiro(shotId, department, taskId, imageBase64, uploadedBy, boardId) {
  return callMiroSync({
    action: 'upload_wip_image',
    shot_id: shotId,
    department,
    task_id: taskId,
    image_base64: imageBase64,
    uploaded_by: uploadedBy,
    ...(boardId && { board_id: boardId }),
  })
}

// Upload multiple WIP images to the correct Miro cell (batch)
export async function uploadWipImagesToMiro(shotId, department, taskId, imagesBase64, uploadedBy, boardId) {
  return callMiroSync({
    action: 'upload_wip_images',
    shot_id: shotId,
    department,
    task_id: taskId,
    images_base64: imagesBase64,
    uploaded_by: uploadedBy,
    ...(boardId && { board_id: boardId }),
  })
}

// Delete all Miro images + Cloudinary assets for a task
export async function deleteTaskMiroImages(taskId, boardId) {
  return callMiroSync({
    action: 'delete_task_images',
    task_id: taskId,
    ...(boardId && { board_id: boardId }),
  })
}

// Upload a reference image to the Reference column on Miro
export async function uploadReferenceToMiro(shotId, imageBase64, boardId) {
  return callMiroSync({
    action: 'upload_reference',
    shot_id: shotId,
    image_base64: imageBase64,
    ...(boardId && { board_id: boardId }),
  })
}

// Full sync — rebuilds the entire Miro table from scratch
export async function fullSyncMiro(boardId) {
  return callMiroSync({ action: 'full_sync', ...(boardId && { board_id: boardId }) })
}

// Fix sync — incremental repair (only fix cells with missing images)
export async function fixSyncMiro(boardId) {
  return callMiroSync({ action: 'fix_sync', ...(boardId && { board_id: boardId }) })
}

// Initialize board (same as full sync)
export async function initMiroBoard(boardId) {
  return callMiroSync({ action: 'init_board', ...(boardId && { board_id: boardId }) })
}

// Cleanup — wipe all data (shots, tasks, images, Miro board, Cloudinary)
export async function cleanupAll(boardId) {
  return callMiroSync({ action: 'cleanup', ...(boardId && { board_id: boardId }) })
}

// Get Cloudinary signed upload params for WIP images (same auth as all other edge calls)
export async function getWipUploadSig(taskId) {
  return callMiroSync({
    action: 'get_wip_upload_sig',
    task_id: taskId,
  })
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

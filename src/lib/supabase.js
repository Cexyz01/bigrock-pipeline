import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth ──

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: { hd: 'bigrock.it' }, // restrict to bigrock domain
      redirectTo: window.location.origin,
    },
  })
  return { data, error }
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ── Profiles ──

export async function getProfile(userId) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return data
}

export async function getAllProfiles() {
  const { data } = await supabase.from('profiles').select('*').order('full_name')
  return data || []
}

export async function updateProfileRole(userId, role, department) {
  const updates = { role }
  if (department !== undefined) updates.department = department
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  return { data, error }
}

// ── Shots ──

export async function getShots() {
  const { data } = await supabase.from('shots').select('*').order('sort_order').order('code')
  return data || []
}

export async function createShot(shot) {
  const { data, error } = await supabase.from('shots').insert(shot).select().single()
  return { data, error }
}

export async function updateShot(id, updates) {
  const { data, error } = await supabase.from('shots').update(updates).eq('id', id).select().single()
  return { data, error }
}

export async function deleteShot(id) {
  return supabase.from('shots').delete().eq('id', id)
}

// ── Tasks ──

export async function getTasks(filters = {}) {
  let query = supabase.from('tasks').select(`
    *,
    assigned_user:profiles!tasks_assigned_to_fkey(id, full_name, email, department),
    creator:profiles!tasks_created_by_fkey(id, full_name),
    shot:shots(id, code, sequence)
  `).order('created_at', { ascending: false })

  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
  if (filters.department) query = query.eq('department', filters.department)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.shot_id) query = query.eq('shot_id', filters.shot_id)

  const { data } = await query
  return data || []
}

export async function createTask(task) {
  const { data, error } = await supabase.from('tasks').insert(task).select().single()
  return { data, error }
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
  return { data, error }
}

export async function deleteTask(id) {
  return supabase.from('tasks').delete().eq('id', id)
}

// ── Comments ──

export async function getComments(taskId) {
  const { data } = await supabase.from('comments')
    .select('*, author:profiles(id, full_name, role)')
    .eq('task_id', taskId)
    .order('created_at')
  return data || []
}

export async function addComment(taskId, authorId, body) {
  const { data, error } = await supabase.from('comments')
    .insert({ task_id: taskId, author_id: authorId, body })
    .select('*, author:profiles(id, full_name, role)')
    .single()
  return { data, error }
}

// ── Calendar ──

export async function getCalendarEvents() {
  const { data } = await supabase.from('calendar_events').select('*').order('event_date').order('event_time')
  return data || []
}

export async function createCalendarEvent(event) {
  const { data, error } = await supabase.from('calendar_events').insert(event).select().single()
  return { data, error }
}

export async function updateCalendarEvent(id, updates) {
  const { data, error } = await supabase.from('calendar_events').update(updates).eq('id', id).select().single()
  return { data, error }
}

export async function deleteCalendarEvent(id) {
  return supabase.from('calendar_events').delete().eq('id', id)
}

// ── Notifications ──

export async function getNotifications(userId) {
  const { data } = await supabase.from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

export async function markNotificationRead(id) {
  return supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function markAllNotificationsRead(userId) {
  return supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
}

export async function sendNotification(userId, type, title, body, linkType, linkId) {
  return supabase.from('notifications').insert({
    user_id: userId, type, title, body, link_type: linkType, link_id: linkId
  })
}

// ── Storage ──

export async function uploadConceptImage(shotId, file) {
  const ext = file.name.split('.').pop()
  const path = `${shotId}.${ext}`
  const { data, error } = await supabase.storage.from('shot-concepts').upload(path, file, { upsert: true })
  if (error) return { url: null, error }
  const { data: urlData } = supabase.storage.from('shot-concepts').getPublicUrl(path)
  return { url: urlData.publicUrl, error: null }
}

// ── Realtime subscriptions ──

export function subscribeToTable(table, callback) {
  return supabase
    .channel(`${table}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe()
}

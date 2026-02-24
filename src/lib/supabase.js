import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth ──

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: { hd: 'bigrock.it' },
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

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  return { data, error }
}

// ── Avatar Upload ──

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}.${ext}`
  const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) return { url: null, error }
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  return { url: urlData.publicUrl, error: null }
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
    assigned_user:profiles!tasks_assigned_to_fkey(id, full_name, email, department, mood_emoji, avatar_url),
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
    .select('*, author:profiles(id, full_name, role, avatar_url)')
    .eq('task_id', taskId)
    .order('created_at')
  return data || []
}

export async function addComment(taskId, authorId, body) {
  const { data, error } = await supabase.from('comments')
    .insert({ task_id: taskId, author_id: authorId, body })
    .select('*, author:profiles(id, full_name, role, avatar_url)')
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

// ── Chat ──

export async function getChatMessages(channel, limit = 100) {
  const { data } = await supabase.from('chat_messages')
    .select('*, author:profiles(id, full_name, avatar_url, role, mood_emoji)')
    .eq('channel', channel)
    .order('created_at', { ascending: true })
    .limit(limit)
  return data || []
}

export async function sendChatMessage(channel, authorId, body) {
  const { data, error } = await supabase.from('chat_messages')
    .insert({ channel, author_id: authorId, body })
    .select('*, author:profiles(id, full_name, avatar_url, role, mood_emoji)')
    .single()
  return { data, error }
}

// ── Direct Messages ──

export async function getDMConversations(userId) {
  // Fetch all DMs involving this user, with profile data for both sides
  const { data } = await supabase.from('direct_messages')
    .select('*, sender:profiles!direct_messages_sender_id_fkey(id, full_name, avatar_url, role, mood_emoji), recipient:profiles!direct_messages_recipient_id_fkey(id, full_name, avatar_url, role, mood_emoji)')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (!data) return []
  // Group by other user, keep latest message + unread count
  const convMap = {}
  for (const msg of data) {
    const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id
    if (!convMap[otherId]) {
      const other = msg.sender_id === userId ? msg.recipient : msg.sender
      convMap[otherId] = { user: other, lastMessage: msg, unread: 0 }
    }
    if (!msg.read && msg.recipient_id === userId) convMap[otherId].unread++
  }
  return Object.values(convMap).sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at))
}

export async function getDMMessages(userId, otherUserId, limit = 100) {
  const { data } = await supabase.from('direct_messages')
    .select('*, sender:profiles!direct_messages_sender_id_fkey(id, full_name, avatar_url, role, mood_emoji)')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`)
    .order('created_at', { ascending: true })
    .limit(limit)
  return data || []
}

export async function sendDM(senderId, recipientId, body) {
  const { data, error } = await supabase.from('direct_messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, body })
    .select('*, sender:profiles!direct_messages_sender_id_fkey(id, full_name, avatar_url, role, mood_emoji)')
    .single()
  return { data, error }
}

export async function markDMsRead(userId, otherUserId) {
  return supabase.from('direct_messages')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('sender_id', otherUserId)
    .eq('read', false)
}

export function subscribeToDMs(userId, callback) {
  return supabase
    .channel(`dm-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'direct_messages',
      filter: `recipient_id=eq.${userId}`,
    }, callback)
    .subscribe()
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

export function subscribeToNotifications(userId, callback) {
  return supabase
    .channel('notif-toast')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, callback)
    .subscribe()
}

export function subscribeToChatChannel(channel, callback) {
  return supabase
    .channel(`chat-${channel}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `channel=eq.${channel}`,
    }, callback)
    .subscribe()
}

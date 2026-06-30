import { createClient } from '@supabase/supabase-js'
import TRIVIA_QUESTIONS from './triviaQuestions'
import { generateThumbBlob } from './thumbs'

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

// One-shot flag consumed by App.jsx's onAuthStateChange handler so it can
// tell a user-initiated sign-out (which should just route to LoginPage)
// apart from an involuntary one (which should trigger recovery).
let _intentionalSignOut = false
export function consumeIntentionalSignOut() {
  const v = _intentionalSignOut
  _intentionalSignOut = false
  return v
}
export async function signOut() {
  _intentionalSignOut = true
  // Drop the persisted page so the next user on this browser starts on
  // Overview rather than a (possibly permission-gated) leftover view.
  try { localStorage.removeItem('bigrock_current_view') } catch {}
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ── Profiles ──

export async function getProfile(userId) {
  const { data } = await supabase.from('profiles').select('*, role_data:roles(*)').eq('id', userId).single()
  if (data && data.role_data) {
    data.role_permissions = data.role_data.permissions || {}
    data.role_name = data.role_data.name
    data.role_slug = data.role_data.slug
  } else if (data) {
    data.role_permissions = {}
    data.role_name = data.role || 'Studente'
    data.role_slug = data.role || 'studente'
  }
  return data
}

export async function getAllProfiles() {
  const { data } = await supabase.from('profiles').select('*, role_data:roles(*)').order('full_name')
  return (data || []).map(p => {
    if (p.role_data) {
      p.role_permissions = p.role_data.permissions || {}
      p.role_name = p.role_data.name
      p.role_slug = p.role_data.slug
    } else {
      p.role_permissions = {}
      p.role_name = p.role || 'Studente'
      p.role_slug = p.role || 'studente'
    }
    return p
  })
}

export async function updateProfileRole(userId, role, department) {
  // Prevent changing a super_admin's role
  const { data: existing } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (existing?.role === 'super_admin') {
    return { data: null, error: { message: 'The Super Admin role cannot be changed' } }
  }
  const updates = { role }
  if (department !== undefined) updates.department = department
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  // If RLS blocked the update, data is null without an explicit error
  if (!data && !error) {
    return { data: null, error: { message: 'Permission denied — make sure the admin_update_profiles RLS policy exists' } }
  }
  return { data, error }
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  return { data, error }
}

// ── Last Seen Tracking ──

export async function updateLastSeen(userId, currentView) {
  return supabase.from('profiles')
    .update({ last_seen_at: new Date().toISOString(), last_seen_view: currentView || null })
    .eq('id', userId)
}

export async function getRecentlyActiveUsers(limit = 10) {
  const { data, error } = await supabase.from('profiles')
    .select('id, full_name, avatar_url, role, last_seen_at, last_seen_view')
    .not('last_seen_at', 'is', null)
    .order('last_seen_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}

// ── Avatar Upload ──

export async function uploadAvatar(userId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}.${ext}`
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      upsert: true,
      contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      cacheControl: '3600',
    })
    if (!error) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const bust = `?v=${Date.now()}`
      return { url: (urlData?.publicUrl || '') + bust, error: null }
    }
    lastError = error
    console.warn(`[uploadAvatar] attempt ${attempt} failed:`, error)
    if (attempt < 3) await new Promise(r => setTimeout(r, 400 * attempt))
  }
  return { url: null, error: lastError }
}

export async function updateProfileFlag(userId, flag, value) {
  const { data, error } = await supabase.from('profiles').update({ [flag]: value }).eq('id', userId).select().single()
  return { data, error }
}

// ── Super Notifications ──

export async function getUnseenSuperNotifications(userId) {
  const { data } = await supabase.from('super_notifications')
    .select('*, sender:profiles!super_notifications_sender_id_fkey(id, full_name, avatar_url)')
    .eq('target_user_id', userId)
    .eq('seen', false)
    .order('created_at', { ascending: false })
  return data || []
}

// Pre-register a student account before their first Google login. The edge
// function calls auth.admin.createUser so the auth.users row exists
// immediately; the profile trigger then creates a Studente profile that can
// be assigned to projects right away. When the real person logs in via Google
// with the same email, Supabase reuses the existing auth user.
export async function preregStudent(email, fullName) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/miro-sync`
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { data: null, error: { message: 'Not signed in' } }
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'prereg_student', email, full_name: fullName }),
    })
  } catch (e) {
    return { data: null, error: { message: 'Network error: ' + (e.message || String(e)) } }
  }
  let json
  try { json = await res.json() } catch (_) {
    return { data: null, error: { message: `Edge function status ${res.status} — invalid JSON` } }
  }
  if (!res.ok) return { data: null, error: { message: json.error || `Status ${res.status}` } }
  return { data: json, error: null }
}

export async function sendSuperNotification(targetUserId, senderId, message) {
  // Goes through a SECURITY DEFINER RPC that does the permission check inline
  // and inserts on behalf of the caller — avoids fighting with RLS policies
  // and surfaces a clear error if the session is missing/expired.
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    if (!refreshed?.session?.access_token) {
      return { data: null, error: { message: 'Sessione scaduta — esci e rientra con Google.' } }
    }
  }
  const { data, error } = await supabase.rpc('send_super_notification', {
    p_target_user_id: targetUserId,
    p_message: message,
  })
  if (error) {
    if (error.message?.includes('not_authenticated')) {
      return { data: null, error: { message: 'Sessione non valida — esci e rientra con Google.' } }
    }
    if (error.message?.includes('insufficient_permissions')) {
      return { data: null, error: { message: 'Non hai i permessi per inviare super notifiche.' } }
    }
  }
  return { data, error }
}

export async function markSuperNotificationSeen(id) {
  return supabase.from('super_notifications').update({ seen: true }).eq('id', id)
}

// ── Projects ──

export async function getProjects() {
  const { data } = await supabase.from('projects').select('*').order('created_at')
  return data || []
}

export async function getUserProjects(userId) {
  const { data } = await supabase.from('project_members')
    .select('project:projects(*)')
    .eq('user_id', userId)
    .order('assigned_at')
  return (data || []).map(d => d.project).filter(Boolean)
}

export async function createProject(project) {
  const { data, error } = await supabase.from('projects').insert(project).select().single()
  return { data, error }
}

export async function updateProject(id, updates) {
  const { data, error } = await supabase.from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  return { data, error }
}

export async function deleteProject(id) {
  return supabase.from('projects').delete().eq('id', id)
}

// ── Project Members ──

export async function getProjectMembers(projectId) {
  const { data, error } = await supabase.from('project_members')
    .select('*, user:profiles!project_members_user_id_fkey(id, full_name, email, avatar_url, role, department, mood_emoji)')
    .eq('project_id', projectId)
    .order('assigned_at')
  if (error) console.error('[getProjectMembers] error:', error)
  return data || []
}

export async function addProjectMember(projectId, userId, assignedBy) {
  // Try insert first, ignore conflict if already exists
  const { data, error } = await supabase.from('project_members')
    .insert({ project_id: projectId, user_id: userId, assigned_by: assignedBy })
    .select().single()
  // If already exists (unique constraint 23505 or HTTP 409), that's fine
  if (error && (error.code === '23505' || error.message?.includes('409'))) return { data: null, error: null }
  return { data, error }
}

export async function removeProjectMember(projectId, userId) {
  return supabase.from('project_members').delete()
    .eq('project_id', projectId).eq('user_id', userId)
}

export async function updateProjectMember(projectId, userId, updates) {
  const { data, error } = await supabase.from('project_members')
    .update(updates)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .select('*, user:profiles!project_members_user_id_fkey(id, full_name, email, avatar_url, role, department, mood_emoji)')
    .single()
  return { data, error }
}

// ── Shots ──

export async function getShots(projectId) {
  let query = supabase.from('shots').select('*').order('sort_order').order('code')
  if (projectId) query = query.eq('project_id', projectId)
  const { data } = await query
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

// ── Assets ──

export async function getAssets(projectId) {
  let query = supabase.from('assets').select('*').order('sort_order').order('name')
  if (projectId) query = query.eq('project_id', projectId)
  const { data } = await query
  return data || []
}

export async function createAsset(asset) {
  const { data, error } = await supabase.from('assets').insert(asset).select().single()
  return { data, error }
}

export async function updateAsset(id, updates) {
  const { data, error } = await supabase.from('assets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  return { data, error }
}

export async function deleteAsset(id) {
  return supabase.from('assets').delete().eq('id', id)
}

// ── Tasks ──

export async function getTasks(filters = {}) {
  let query = supabase.from('tasks').select(`
    *,
    assignees:task_assignees(user:profiles(id, full_name, email, department, mood_emoji, avatar_url)),
    creator:profiles!tasks_created_by_fkey(id, full_name),
    shot:shots(id, code, sequence),
    asset:assets(id, name),
    wip_updates:task_wip_updates(count)
  `).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })

  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.department) query = query.eq('department', filters.department)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.shot_id) query = query.eq('shot_id', filters.shot_id)
  if (filters.asset_id) query = query.eq('asset_id', filters.asset_id)

  const { data } = await query
  return data || []
}

export async function createTask(task) {
  const { assignee_ids, ...payload } = task
  const { data, error } = await supabase.from('tasks').insert(payload).select().single()
  if (!error && data && assignee_ids?.length) {
    await supabase.from('task_assignees').insert(
      assignee_ids.map(uid => ({ task_id: data.id, user_id: uid }))
    )
  }
  return { data, error }
}

export async function setTaskAssignees(taskId, userIds) {
  await supabase.from('task_assignees').delete().eq('task_id', taskId)
  if (userIds?.length) {
    const rows = userIds.map(uid => ({ task_id: taskId, user_id: uid }))
    return supabase.from('task_assignees').insert(rows)
  }
  return { data: [], error: null }
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single()
  // When a task is approved, set the storyboard default: the latest WIP per
  // uploader is auto-pinned. Users can still toggle stars freely afterwards.
  // Storyboard reads ONLY from pinned_storyboard_urls (migration 065).
  if (!error && updates.status === 'approved') {
    try { await autoPinLatestWipForTask(id) } catch { /* non-fatal */ }
  }
  return { data, error }
}

export async function deleteTask(id) {
  return supabase.from('tasks').delete().eq('id', id)
}

// ── Gantt items ──

export async function getGanttItems(projectId) {
  if (!projectId) return []
  const { data } = await supabase.from('gantt_items')
    .select('*, creator:profiles!gantt_items_created_by_fkey(id, full_name)')
    .eq('project_id', projectId)
    .order('lane').order('sort_order').order('start_date')
  return data || []
}

export async function createGanttItem(item) {
  const { data, error } = await supabase.from('gantt_items').insert(item).select().single()
  return { data, error }
}

export async function updateGanttItem(id, updates) {
  const { data, error } = await supabase.from('gantt_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  return { data, error }
}

export async function deleteGanttItem(id) {
  return supabase.from('gantt_items').delete().eq('id', id)
}

export async function getGanttLanes(projectId) {
  if (!projectId) return []
  const { data } = await supabase.from('gantt_lanes')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order').order('created_at')
  return data || []
}

export async function createGanttLane(lane) {
  const { data, error } = await supabase.from('gantt_lanes').insert(lane).select().single()
  return { data, error }
}

export async function updateGanttLane(id, updates) {
  const { data, error } = await supabase.from('gantt_lanes').update(updates).eq('id', id).select().single()
  return { data, error }
}

export async function deleteGanttLane(id) {
  return supabase.from('gantt_lanes').delete().eq('id', id)
}

// ── Project pauses (Planning timeline compression) ──

export async function getProjectPauses(projectId) {
  if (!projectId) return []
  const { data } = await supabase.from('project_pauses')
    .select('*')
    .eq('project_id', projectId)
    .order('start_date')
  return data || []
}

export async function createProjectPause(pause) {
  const { data, error } = await supabase.from('project_pauses').insert(pause).select().single()
  return { data, error }
}

export async function deleteProjectPause(id) {
  return supabase.from('project_pauses').delete().eq('id', id)
}

// ── WIP Images ──

export async function getStoryboardImages(projectId) {
  // Single source of truth (migration 065): the storyboard shows ONLY images
  // whose WIP update has them in `pinned_storyboard_urls`. Approving a task
  // auto-pins the latest WIP per uploader (see updateTask); users can toggle
  // additional stars from the task detail modal.
  //
  // Policy (2026-05-27): only tasks in 'approved' (Done) status surface here.
  // Tasks in 'review' may have pins set from the approval auto-pin path or
  // from a previous Done cycle, but until the task is actually approved we
  // hide them — the storyboard is supposed to reflect what's signed off, not
  // what's still being judged.
  const { data: pins } = await supabase
    .from('task_wip_updates')
    .select('id, pinned_storyboard_urls, task:tasks(id, shot_id, asset_id, department, status)')
    .not('pinned_storyboard_urls', 'eq', '{}')

  const out = []
  const seen = new Set()
  let synthId = 0
  for (const row of (pins || [])) {
    const task = row.task
    if (!task) continue
    if (task.status !== 'approved') continue
    const pinnedList = Array.isArray(row.pinned_storyboard_urls) ? row.pinned_storyboard_urls : []
    for (const url of pinnedList) {
      if (!url || seen.has(url)) continue
      seen.add(url)
      out.push({
        id: `pin-${row.id}-${synthId++}`,
        shot_id: task.shot_id || null,
        asset_id: task.asset_id || null,
        task_id: task.id,
        department: task.department,
        image_url: url,
        image_order: 0,
        img_width: null,
        img_height: null,
        created_at: null,
        _pinned: true,
      })
    }
  }
  return out
}

// Auto-pin the latest WIP update per uploader for a given task. Idempotent:
// re-running merges into existing pins without removing anything the user may
// have already added or removed by hand.
export async function autoPinLatestWipForTask(taskId) {
  const { data: updates, error } = await supabase
    .from('task_wip_updates')
    .select('id, user_id, images, pinned_storyboard_urls, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
  if (error || !Array.isArray(updates) || updates.length === 0) return { error: error || null }

  const seenUser = new Set()
  const latest = []
  for (const u of updates) {
    if (!u.user_id || seenUser.has(u.user_id)) continue
    seenUser.add(u.user_id)
    latest.push(u)
  }

  for (const u of latest) {
    const imgs = Array.isArray(u.images) ? u.images.filter(Boolean) : []
    if (imgs.length === 0) continue
    const pins = Array.isArray(u.pinned_storyboard_urls) ? u.pinned_storyboard_urls : []
    const merged = Array.from(new Set([...pins, ...imgs]))
    if (merged.length === pins.length) continue
    await supabase.from('task_wip_updates')
      .update({ pinned_storyboard_urls: merged })
      .eq('id', u.id)
  }
  return { error: null }
}

export async function getTaskWipImages(taskId) {
  const { data } = await supabase.from('miro_wip_images')
    .select('id, image_url, image_order, created_at')
    .eq('task_id', taskId)
    .not('image_url', 'is', null)
    .order('image_order')
  return data || []
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

export async function getCalendarEvents(projectId) {
  let query = supabase.from('calendar_events').select('*').order('event_date').order('event_time')
  if (projectId) query = query.eq('project_id', projectId)
  const { data } = await query
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

export async function sendNotification(userId, type, title, body, linkType, linkId, projectId, meta) {
  const row = { user_id: userId, type, title, body, link_type: linkType, link_id: linkId }
  if (projectId) row.project_id = projectId
  if (meta) row.meta = meta
  return supabase.from('notifications').insert(row)
}

// ── Chat ──

export async function getChatMessages(channel, projectId, limit = 100) {
  if (!projectId) return []
  const { data } = await supabase.from('chat_messages')
    .select('*, author:profiles(id, full_name, avatar_url, role, mood_emoji)')
    .eq('channel', channel)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(limit)
  return data || []
}

export async function sendChatMessage(channel, authorId, body, projectId, attachments = []) {
  if (!projectId) return { data: null, error: new Error('Missing projectId') }
  const { data, error } = await supabase.from('chat_messages')
    .insert({ channel, author_id: authorId, body, project_id: projectId, attachments })
    .select('*, author:profiles(id, full_name, avatar_url, role, mood_emoji)')
    .single()
  return { data, error }
}

// Toggle the calling user's reaction on a channel message. WhatsApp semantics:
// one reaction per user — re-tapping the same emoji removes it, tapping a
// different one moves the user. Returns { data: <new reactions jsonb>, error }.
// The DB function is atomic (row lock) and derives the user from auth.uid(),
// so concurrent reactions don't clobber each other.
export async function toggleChatReaction(messageId, emoji) {
  return supabase.rpc('toggle_chat_reaction', { p_message_id: messageId, p_emoji: emoji })
}

export async function toggleDmReaction(messageId, emoji) {
  return supabase.rpc('toggle_dm_reaction', { p_message_id: messageId, p_emoji: emoji })
}

// Chat file attachments — any type, up to 100MB. Stored on R2 (kind="chat").
export async function uploadChatFile(file) {
  if (file && file.size > 100 * 1024 * 1024) return { url: null, error: { message: 'File troppo grande (max 100MB)' } }
  return r2Upload('chat', file, {})
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

export async function sendDM(senderId, recipientId, body, attachments = []) {
  const { data, error } = await supabase.from('direct_messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, body, attachments })
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

export async function getDMUnreadCount(userId) {
  const { count } = await supabase.from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false)
  return count || 0
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

// ── App Settings ──

export async function getProjectStartDate() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'project_start_date').single()
  return data?.value || ''
}

export async function setProjectStartDate(date) {
  const { data, error } = await supabase.from('app_settings')
    .upsert({ key: 'project_start_date', value: date || '', updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single()
  return { data, error }
}

export async function getProjectEndDate() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'project_end_date').single()
  return data?.value || ''
}

export async function setProjectEndDate(date) {
  const { data, error } = await supabase.from('app_settings')
    .upsert({ key: 'project_end_date', value: date || '', updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single()
  return { data, error }
}

// ── Storage ──

// ── R2 upload helper (single code path for every upload kind) ──
//
// Asks the Edge Function for a presigned PUT URL, then uploads the file
// directly to Cloudflare R2. Returns the public URL the caller should
// persist to the DB. Retries once on transient network errors.
// Returns a valid Bearer header for calling the miro-sync Edge Function.
//
// `getSession()` returns the locally cached session WITHOUT refreshing it, and
// Supabase's auto-refresh runs on a background timer that browsers throttle in
// inactive tabs. So after a tab has been idle the stored access_token can be
// expired; sending it makes the Functions gateway (verify_jwt) reject the call
// with 401 before our signer even runs — which is exactly why an upload fails
// until the user hits F5 (a reload re-inits the client and refreshes the token).
// Refresh proactively when the token is missing or within 60s of expiry; pass
// force=true to refresh unconditionally (used to retry a 401).
async function getEdgeAuthHeader(force = false) {
  let { data: { session } } = await supabase.auth.getSession()
  const nearExpiry = !session?.expires_at || (session.expires_at * 1000 - Date.now()) < 60_000
  if (session && (force || nearExpiry)) {
    const { data, error } = await supabase.auth.refreshSession()
    if (!error && data?.session) session = data.session
  }
  return `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`
}

async function r2Upload(kind, file, meta) {
  if (!file || !file.size) return { url: null, error: { message: 'No file selected' } }

  const ext = (file.name?.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const contentType = file.type || 'application/octet-stream'

  const sigUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/miro-sync`

  // ── 1. Get a presigned PUT URL from the signer ──
  // Uploads are workflow-critical (feedback_uploads_must_succeed), so we ride
  // out TRANSIENT failures instead of surfacing them: a flaky network (fetch
  // throws), an edge cold-start 5xx, or an expired token (401 → force-refresh
  // and retry). Only a genuine client error (4xx other than 401) fails fast,
  // since retrying that would never succeed. Backoff is bounded well under the
  // presigned URL's 5-min TTL.
  const SIG_DELAYS = [400, 1200, 3000]
  let sigJson = null
  let sigErr = { message: 'Signer unavailable' }
  for (let attempt = 0; attempt <= SIG_DELAYS.length; attempt++) {
    const authHeader = await getEdgeAuthHeader(attempt > 0) // force token refresh on any retry
    let sigRes
    try {
      sigRes = await fetch(sigUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, 'Authorization': authHeader },
        body: JSON.stringify({ action: 'r2_sign_upload', kind, ext, content_type: contentType, ...meta }),
      })
    } catch (e) {
      sigErr = { message: 'Network error contacting signer: ' + (e.message || String(e)) }
      if (attempt < SIG_DELAYS.length) { await sleep(SIG_DELAYS[attempt]); continue }
      return { url: null, error: sigErr }
    }
    // 401 (stale token) and 5xx (edge hiccup) are transient → back off + retry.
    if ((sigRes.status === 401 || sigRes.status >= 500) && attempt < SIG_DELAYS.length) {
      sigErr = { message: `Signer error (${sigRes.status})` }
      await sleep(SIG_DELAYS[attempt]); continue
    }
    try { sigJson = await sigRes.json() } catch (_) {
      sigErr = { message: `Signer responded with status ${sigRes.status} but invalid JSON` }
      if (attempt < SIG_DELAYS.length) { await sleep(SIG_DELAYS[attempt]); continue }
      return { url: null, error: sigErr }
    }
    if (!sigRes.ok || !sigJson?.upload_url || !sigJson?.public_url) {
      return { url: null, error: { message: sigJson?.error || `Signer error (${sigRes.status})` } }
    }
    break // got a valid signature
  }
  if (!sigJson?.upload_url) return { url: null, error: sigErr }

  // ── 2. PUT the bytes to R2 ──
  // Same resilience: retry network blips + transient server statuses with
  // backoff; bail out on a non-retryable 4xx. The PUT headers MUST match
  // exactly what the signer signed (it signs Cache-Control too) — echo the
  // signer's `headers` verbatim, falling back to Content-Type for older
  // signer responses that didn't return a headers map.
  const putHeaders = sigJson.headers && Object.keys(sigJson.headers).length
    ? sigJson.headers
    : { 'Content-Type': contentType }
  const PUT_DELAYS = [500, 1500, 4000]
  let lastErr = null
  for (let attempt = 0; attempt <= PUT_DELAYS.length; attempt++) {
    try {
      const putRes = await fetch(sigJson.upload_url, {
        method: 'PUT',
        headers: putHeaders,
        body: file,
      })
      if (putRes.ok) {
        // Best-effort thumbnail sibling (`<key>_t512.webp`). Lets the storyboard
        // paint a tiny low-res version instantly and only fetch the full-res
        // original when the user zooms in. Never blocks or fails the upload —
        // if anything goes wrong the board just falls back to the original.
        try {
          const thumb = await generateThumbBlob(file)
          if (thumb && sigJson.key) await uploadThumbForKey(sigJson.key, thumb)
        } catch { /* ignore — thumb is an optimization, not a requirement */ }
        return { url: sigJson.public_url, error: null }
      }
      lastErr = { message: `R2 PUT failed with status ${putRes.status}` }
      // 4xx (except 408 timeout / 429 rate-limit) won't fix itself on retry.
      if (putRes.status < 500 && putRes.status !== 408 && putRes.status !== 429) break
    } catch (e) {
      lastErr = { message: 'R2 PUT network error: ' + (e.message || String(e)) }
    }
    if (attempt < PUT_DELAYS.length) await sleep(PUT_DELAYS[attempt])
  }
  return { url: null, error: lastErr || { message: 'R2 upload failed' } }
}

// Small backoff helper for the upload retry loops.
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Upload a generated thumbnail to `<key>_t512.webp`. Best-effort: every failure
// path is swallowed because the board falls back to the original if the thumb
// is missing. The signer (`r2_sign_thumb`) validates the key + suffix server-side.
async function uploadThumbForKey(key, blob) {
  try {
    const sigUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/miro-sync`
    const authHeader = await getEdgeAuthHeader(false)
    const sigRes = await fetch(sigUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, 'Authorization': authHeader },
      body: JSON.stringify({ action: 'r2_sign_thumb', key }),
    })
    const j = await sigRes.json().catch(() => null)
    if (!sigRes.ok || !j?.upload_url) return
    await fetch(j.upload_url, {
      method: 'PUT',
      headers: j.headers || { 'Content-Type': 'image/webp' },
      body: blob,
    })
  } catch { /* ignore — thumb is an optimization, not a requirement */ }
}

export async function uploadConceptImage(shotId, file) {
  if (file && file.size > 10 * 1024 * 1024) return { url: null, error: { message: 'File too large (max 10MB)' } }
  return r2Upload('concept', file, { shot_id: shotId })
}

export async function uploadOutputImage(shotId, file) {
  if (file && file.size > 30 * 1024 * 1024) return { url: null, error: { message: 'File too large (max 30MB)' } }
  return r2Upload('output', file, { shot_id: shotId })
}

export async function uploadTimelineFile(shotId, file) {
  if (file && file.size > 20 * 1024 * 1024) return { url: null, error: { message: 'File too large (max 20MB)' } }
  return r2Upload('timeline', file, { shot_id: shotId })
}

export async function uploadWipFile(taskId, file) {
  if (file) {
    const isVideo = file.type?.startsWith('video/')
    const cap = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > cap) {
      const mb = isVideo ? 100 : 10
      return { url: null, error: { message: `File too large (max ${mb}MB)` } }
    }
  }
  return r2Upload('wip', file, { task_id: taskId })
}

// Get R2 bucket usage stats for the Manager page (scans the bucket and
// aggregates total bytes / object count / per-prefix breakdown server-side).
export async function getR2Usage() {
  const { data, error } = await supabase.functions.invoke('miro-sync', {
    body: { action: 'r2_usage' },
  })
  if (error) return { data: null, error: error.message || 'R2 usage failed' }
  return { data, error: null }
}

// ── Realtime subscriptions ──

export function subscribeToTable(table, callback, filter) {
  const config = { event: '*', schema: 'public', table }
  if (filter) config.filter = filter
  return supabase
    .channel(`${table}-changes${filter ? '-' + filter : ''}`)
    .on('postgres_changes', config, callback)
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

// ── Pack Admin Stats ──

export async function getRecentRareFinds(cardNumbers, limit = 20) {
  if (!cardNumbers?.length) return []
  const { data } = await supabase.from('pack_user_cards')
    .select('card_number, copy_number, obtained_at, user:profiles(id, full_name, avatar_url)')
    .in('card_number', cardNumbers)
    .order('obtained_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function getUserCardStats() {
  const { data } = await supabase.from('pack_user_cards')
    .select('card_number, user_id')
  return data || []
}

export async function getTopCollectors(limit = 10) {
  const { data } = await supabase.from('pack_user_cards')
    .select('user_id, user:profiles(id, full_name, avatar_url)')
  if (!data) return []
  const counts = {}
  for (const r of data) {
    if (!counts[r.user_id]) counts[r.user_id] = { ...r.user, count: 0 }
    counts[r.user_id].count++
  }
  return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, limit)
}

// ── Collection Count (for debug/conditions) ──

export async function getCollectionCount() {
  const { count } = await supabase.from('pack_user_cards')
    .select('*', { count: 'exact', head: true })
  return count || 0
}

// ── Pack Cards ──

export async function getPackCards() {
  const { data } = await supabase.from('pack_cards').select('*').order('number')
  return data || []
}

export async function getPackCardsByType(packType) {
  const { data } = await supabase.from('pack_cards').select('*').eq('pack_type', packType).order('number')
  return data || []
}

export async function getUserCards(userId) {
  const { data } = await supabase.from('pack_user_cards').select('*').eq('user_id', userId).order('card_number').order('obtained_at')
  return data || []
}

export async function grantCard(userId, cardNumber, obtainedVia = 'reward', copyNumber = null) {
  const row = { user_id: userId, card_number: cardNumber, obtained_via: obtainedVia }
  if (copyNumber != null) {
    row.copy_number = copyNumber
  } else {
    // Auto-assign next available copy_number for this user+card
    const { data: existing } = await supabase.from('pack_user_cards')
      .select('copy_number')
      .eq('user_id', userId)
      .eq('card_number', cardNumber)
      .order('copy_number', { ascending: false })
      .limit(1)
    row.copy_number = existing?.length > 0 ? (existing[0].copy_number + 1) : 0
  }
  const { data, error } = await supabase.from('pack_user_cards').insert(row).select().single()
  return { data, error }
}

export async function revokeCard(userId, cardNumber) {
  return supabase.from('pack_user_cards').delete().eq('user_id', userId).eq('card_number', cardNumber)
}

export async function updatePackCard(cardNumber, updates) {
  const { data, error } = await supabase.from('pack_cards').update(updates).eq('number', cardNumber).select().single()
  return { data, error }
}

export async function uploadCardImage(cardNumber, file) {
  if (cardNumber == null || cardNumber < 0) return { url: null, error: { message: 'Invalid card number' } }
  if (file && file.size > 10 * 1024 * 1024) return { url: null, error: { message: 'File too large (max 10MB)' } }
  const { url, error } = await r2Upload('card', file, { card_number: cardNumber })
  if (error) return { url, error }
  const { error: dbErr } = await supabase.from('pack_cards').update({ image_url: url }).eq('number', cardNumber)
  if (dbErr) return { url, error: { message: 'Image uploaded but DB save error: ' + dbErr.message } }
  return { url, error: null }
}

// ── Pack Generation Config ──

export async function getPackConfig() {
  const { data } = await supabase.from('pack_generation_config').select('*').eq('id', 1).single()
  return data
}

export async function savePackConfig(config) {
  const { data, error } = await supabase.from('pack_generation_config')
    .update({ ...config, updated_at: new Date().toISOString() })
    .eq('id', 1).select().single()
  return { data, error }
}

// ── Generated Packs ──

export async function getPackStats() {
  const [total, assigned, opened] = await Promise.all([
    supabase.from('pack_generated_packs').select('*', { count: 'exact', head: true }),
    supabase.from('pack_generated_packs').select('*', { count: 'exact', head: true }).not('assigned_to', 'is', null),
    supabase.from('pack_generated_packs').select('*', { count: 'exact', head: true }).eq('opened', true),
  ])
  return {
    total: total.count || 0,
    assigned: assigned.count || 0,
    opened: opened.count || 0,
  }
}

export async function getPackStatsByType(packType) {
  const [total, assigned, opened] = await Promise.all([
    supabase.from('pack_generated_packs').select('*', { count: 'exact', head: true }).eq('pack_type', packType),
    supabase.from('pack_generated_packs').select('*', { count: 'exact', head: true }).eq('pack_type', packType).not('assigned_to', 'is', null),
    supabase.from('pack_generated_packs').select('*', { count: 'exact', head: true }).eq('pack_type', packType).eq('opened', true),
  ])
  return {
    total: total.count || 0,
    assigned: assigned.count || 0,
    opened: opened.count || 0,
  }
}

export async function getPacksRemaining() {
  // Count unassigned packs per type
  const types = ['red', 'green', 'blue']
  const results = await Promise.all(
    types.map(t => supabase.from('pack_generated_packs').select('*', { count: 'exact', head: true }).eq('pack_type', t).is('assigned_to', null))
  )
  return { red: results[0].count || 0, green: results[1].count || 0, blue: results[2].count || 0 }
}

export async function insertGeneratedPacks(packs) {
  const BATCH = 500
  for (let i = 0; i < packs.length; i += BATCH) {
    const batch = packs.slice(i, i + BATCH)
    const { error } = await supabase.from('pack_generated_packs').insert(batch)
    if (error) return { error, inserted: i }
  }
  return { error: null, inserted: packs.length }
}

export async function deleteAllGeneratedPacks() {
  return supabase.from('pack_generated_packs').delete().gte('pack_number', 1)
}

export async function deleteGeneratedPacksByType(packType) {
  return supabase.from('pack_generated_packs').delete().eq('pack_type', packType).gte('pack_number', 1)
}

export async function getUserPacks(userId) {
  const { data } = await supabase.from('pack_generated_packs')
    .select('*')
    .eq('assigned_to', userId)
    .order('pack_number')
  return data || []
}

// ── Pack User Timers ──

export async function getUserTimer(userId) {
  const { data } = await supabase.from('pack_user_timers').select('*').eq('user_id', userId).single()
  return data
}

export async function upsertUserTimer(userId, updates) {
  const { data, error } = await supabase.from('pack_user_timers')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
    .select().single()
  return { data, error }
}

// ── Pack Opening ──

export async function claimAndOpenPack(userId, packType) {
  // 1. Find an unassigned pack
  const { data: pack, error: findErr } = await supabase
    .from('pack_generated_packs')
    .select('*')
    .eq('pack_type', packType)
    .is('assigned_to', null)
    .limit(1)
    .single()
  if (findErr || !pack) return { error: findErr || { message: 'No packs available' } }

  // 2. Claim it (race-safe: check assigned_to is still null)
  const { data: claimed, error: claimErr } = await supabase
    .from('pack_generated_packs')
    .update({ assigned_to: userId, opened: true, opened_at: new Date().toISOString() })
    .eq('id', pack.id)
    .is('assigned_to', null)
    .select()
    .single()
  if (claimErr || !claimed) return { error: claimErr || { message: 'Pack already taken, try again' } }

  // 3. Insert cards into user collection (ignore duplicates)
  const cards = claimed.cards || []
  for (const entry of cards) {
    await supabase.from('pack_user_cards')
      .upsert(
        { user_id: userId, card_number: entry.card, copy_number: entry.copy, obtained_via: 'pack' },
        { onConflict: 'user_id,card_number,copy_number', ignoreDuplicates: true }
      )
  }

  // 4. Decrement available packs in timer
  //    Only reset last_pack_at when user was at MAX (3/3)
  //    Otherwise keep the timer running where it was
  const timer = await getUserTimer(userId)
  if (timer) {
    const interval = 60 * 60 * 1000 // 60 min per pack
    const elapsed = Date.now() - new Date(timer.last_pack_at).getTime()
    const earned = Math.floor(elapsed / interval)
    const currentTotal = Math.min(3, (timer.available_packs || 0) + earned)
    const newTotal = Math.max(0, currentTotal - 1)

    if (currentTotal >= 3) {
      // Was at MAX — reset timer, countdown starts fresh from 60:00
      await upsertUserTimer(userId, { available_packs: newTotal, last_pack_at: new Date().toISOString() })
    } else {
      // Timer was running — "consume" earned packs by advancing last_pack_at
      // so the countdown keeps ticking from where it was
      const newLastPackAt = new Date(new Date(timer.last_pack_at).getTime() + earned * interval).toISOString()
      await upsertUserTimer(userId, { available_packs: newTotal, last_pack_at: newLastPackAt })
    }
  }

  return { data: claimed, error: null }
}

// ── Maintenance Mode ──

export async function getMaintenanceMode() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'maintenance_mode').maybeSingle()
  return data?.value === 'on'
}

export async function setMaintenanceMode(on) {
  const { data, error } = await supabase.from('app_settings')
    .upsert({ key: 'maintenance_mode', value: on ? 'on' : 'off', updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select().single()
  return { data, error }
}

// ── TCG Game State ──

export async function getTcgGameActive() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'tcg_game_active').maybeSingle()
  return data?.value === 'true'
}

export async function setTcgGameActive(active) {
  const { data, error } = await supabase.from('app_settings')
    .upsert({ key: 'tcg_game_active', value: active ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select().single()
  return { data, error }
}

export async function grantPackReward(userId, count) {
  const active = await getTcgGameActive()
  if (!active) return { granted: false, count }
  const timer = await getUserTimer(userId)
  const currentPacks = timer?.available_packs || 0
  await upsertUserTimer(userId, {
    available_packs: currentPacks + count,
    ...(timer ? {} : { last_pack_at: new Date().toISOString() }),
  })
  return { granted: true, count }
}

export async function resetAllUserCards() {
  const { error } = await supabase.from('pack_user_cards').delete().gte('card_number', 0)
  return { error }
}

export async function resetAllUserTimers() {
  const { error } = await supabase.from('pack_user_timers').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  return { error }
}

export async function resetAllOpenedPacks() {
  const { error } = await supabase.from('pack_generated_packs')
    .update({ assigned_to: null, opened: false, opened_at: null })
    .gte('pack_number', 1)
  return { error }
}

export async function resetAllTradeTokens() {
  const { error } = await supabase.from('pack_trade_tokens')
    .update({ tokens: 0, last_regenerated_at: new Date().toISOString() })
    .neq('user_id', '00000000-0000-0000-0000-000000000000')
  return { error }
}

// ── WIP Updates ──

export async function getAllWipUpdates() {
  const { data } = await supabase.from('task_wip_updates')
    .select('*, author:profiles(id, full_name, avatar_url, role), task:tasks(id, title, status, department)')
    .order('created_at', { ascending: false })
  return data || []
}

export async function getWipUpdates(taskId) {
  const { data } = await supabase.from('task_wip_updates')
    .select('*, author:profiles(id, full_name, avatar_url, role)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function createWipUpdate(taskId, userId, note, imageUrls) {
  const { data, error } = await supabase.from('task_wip_updates')
    .insert({
      task_id: taskId,
      user_id: userId,
      note: note || null,
      images: imageUrls || [],
    })
    .select('*, author:profiles(id, full_name, avatar_url, role)')
    .single()
  return { data, error }
}

// Toggle "Show in Storyboard" pin on a single image URL inside a WIP update.
// RLS (migration 064) allows the WIP author OR any staff to update.
export async function toggleWipStoryboardPin(wipUpdateId, imageUrl, pinned) {
  const { data: current, error: readErr } = await supabase.from('task_wip_updates')
    .select('pinned_storyboard_urls')
    .eq('id', wipUpdateId)
    .single()
  if (readErr) return { data: null, error: readErr }
  const existing = Array.isArray(current?.pinned_storyboard_urls) ? current.pinned_storyboard_urls : []
  const next = pinned
    ? (existing.includes(imageUrl) ? existing : [...existing, imageUrl])
    : existing.filter(u => u !== imageUrl)
  const { data, error } = await supabase.from('task_wip_updates')
    .update({ pinned_storyboard_urls: next })
    .eq('id', wipUpdateId)
    .select('id, pinned_storyboard_urls')
    .single()
  return { data, error }
}

// Delete a WIP update (admin/producer only). Goes through the edge function
// so we can purge the Cloudinary assets in the same transaction — students
// occasionally post by accident and we don't want orphaned files burning
// our Cloudinary quota.
export async function deleteWipUpdate(wipUpdateId) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/miro-sync`
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { data: null, error: { message: 'Not signed in' } }
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'delete_wip_update', wip_update_id: wipUpdateId }),
    })
  } catch (e) {
    return { data: null, error: { message: 'Network error: ' + (e.message || String(e)) } }
  }
  let json
  try { json = await res.json() } catch (_) {
    return { data: null, error: { message: `Edge function status ${res.status} — invalid JSON` } }
  }
  if (!res.ok) return { data: null, error: { message: json.error || `Status ${res.status}` } }
  return { data: json, error: null }
}

// ── WIP Comments (per-WIP feedback from staff) ──

export async function getWipComments(wipUpdateIds) {
  if (!wipUpdateIds || wipUpdateIds.length === 0) return []
  const { data } = await supabase.from('wip_comments')
    .select('*, author:profiles(id, full_name, avatar_url, role)')
    .in('wip_update_id', wipUpdateIds)
    .order('created_at', { ascending: true })
  return data || []
}

export async function addWipComment(wipUpdateId, authorId, body) {
  const { data, error } = await supabase.from('wip_comments')
    .insert({ wip_update_id: wipUpdateId, author_id: authorId, body })
    .select('*, author:profiles(id, full_name, avatar_url, role)')
    .single()
  return { data, error }
}

// Delete a single WIP comment. RLS (migration 062) allows the comment's
// author OR any non-studente profile to delete.
export async function deleteWipComment(commentId) {
  const { error } = await supabase.from('wip_comments').delete().eq('id', commentId)
  return { error }
}

// Upload a WIP image to R2 (same pattern as uploadCardImage)
export async function uploadWipImage(taskId, file) {
  if (file && file.size > 4 * 1024 * 1024) return { url: null, error: { message: 'File too large (max 4MB)' } }
  return r2Upload('wip', file, { task_id: taskId })
}

// ── WIP Views (badge system) ──

export async function getWipViews(userId) {
  const { data } = await supabase.from('task_wip_views')
    .select('task_id, viewed_at')
    .eq('user_id', userId)
  return data || []
}

export async function markWipViewed(taskId, userId) {
  const { data, error } = await supabase.from('task_wip_views')
    .upsert(
      { task_id: taskId, user_id: userId, viewed_at: new Date().toISOString() },
      { onConflict: 'task_id,user_id' }
    )
    .select()
    .single()
  return { data, error }
}

// ── Review Metadata ──

export async function updateReviewMeta(taskId, reviewTitle, reviewDescription) {
  const { data, error } = await supabase.from('tasks')
    .update({
      review_title: reviewTitle || null,
      review_description: reviewDescription || null,
    })
    .eq('id', taskId)
    .select()
    .single()
  return { data, error }
}

// ── WIP Updates Realtime ──

export function subscribeToWipUpdates(callback) {
  return supabase
    .channel('wip-updates-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_wip_updates' }, callback)
    .subscribe()
}

export function subscribeToChatChannel(channel, projectId, callback) {
  return supabase
    .channel(`chat-${projectId || 'none'}-${channel}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `project_id=eq.${projectId}`,
    }, (payload) => {
      if (payload?.new?.channel !== channel) return
      callback(payload)
    })
    .subscribe()
}

// ══════════════════════════════════════════
// ── Trading System ──
// ══════════════════════════════════════════

// ── Trade Tokens ──

export async function getTradeTokens(userId) {
  // Fetch existing row
  let { data } = await supabase.from('pack_trade_tokens').select('*').eq('user_id', userId).single()

  // Auto-init if row doesn't exist
  if (!data) {
    const { data: created } = await supabase.from('pack_trade_tokens')
      .upsert({ user_id: userId, tokens: 3, last_regenerated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select().single()
    data = created
  }
  if (!data) return { tokens: 3, last_regenerated_at: new Date().toISOString() }

  // Auto-regenerate: +1 per midnight UTC crossed since last_regenerated_at, cap at 3
  const last = new Date(data.last_regenerated_at)
  const now = new Date()
  // Count midnight crossings
  const lastDay = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()))
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const daysCrossed = Math.floor((today - lastDay) / (24 * 60 * 60 * 1000))

  if (daysCrossed > 0 && data.tokens < 3) {
    const newTokens = Math.min(3, data.tokens + daysCrossed)
    const { data: updated } = await supabase.from('pack_trade_tokens')
      .update({ tokens: newTokens, last_regenerated_at: now.toISOString() })
      .eq('user_id', userId).select().single()
    return updated || { ...data, tokens: newTokens }
  }

  return data
}

export async function consumeTradeToken(userId) {
  const tokenData = await getTradeTokens(userId)
  if (!tokenData || tokenData.tokens <= 0) {
    return { error: { message: 'Nessun token di scambio disponibile' } }
  }
  const { data, error } = await supabase.from('pack_trade_tokens')
    .update({ tokens: tokenData.tokens - 1, last_regenerated_at: new Date().toISOString() })
    .eq('user_id', userId).select().single()
  return { data, error }
}

// ── Other Users' Cards ──

export async function getOtherUserCards(userId) {
  const { data } = await supabase.from('pack_user_cards')
    .select('*')
    .eq('user_id', userId)
    .order('card_number')
    .order('obtained_at')
  return data || []
}

// ── Real-Time Trade Session ──

export async function createTradeInvite(proposerId, targetId) {
  const { data, error } = await supabase.from('pack_trades')
    .insert({ proposer_id: proposerId, target_id: targetId, status: 'pending_invite' })
    .select('*, proposer:profiles!pack_trades_proposer_id_fkey(id, full_name, avatar_url, role), target:profiles!pack_trades_target_id_fkey(id, full_name, avatar_url, role)')
    .single()
  return { data, error }
}

export async function acceptTradeInvite(tradeId) {
  const { data, error } = await supabase.from('pack_trades')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', tradeId).eq('status', 'pending_invite')
    .select('*').single()
  return { data, error }
}

export async function declineTradeInvite(tradeId) {
  const { data, error } = await supabase.from('pack_trades')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', tradeId).eq('status', 'pending_invite')
    .select('*').single()
  return { data, error }
}

export async function selectTradeCard(tradeId, side, cardNumber) {
  const col = side === 'proposer' ? 'proposer_card_number' : 'target_card_number'
  const { data, error } = await supabase.from('pack_trades')
    .update({
      [col]: cardNumber,
      proposer_accepted: false,
      target_accepted: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tradeId).eq('status', 'active')
    .select('*').single()
  return { data, error }
}

export async function acceptTradeSelection(tradeId, side) {
  const col = side === 'proposer' ? 'proposer_accepted' : 'target_accepted'
  const { data, error } = await supabase.from('pack_trades')
    .update({ [col]: true, updated_at: new Date().toISOString() })
    .eq('id', tradeId).eq('status', 'active')
    .select('*').single()
  return { data, error }
}

export async function executeTrade(tradeId) {
  // 1. Fetch trade
  const { data: trade, error: fetchErr } = await supabase.from('pack_trades')
    .select('*').eq('id', tradeId).single()
  if (fetchErr || !trade) return { error: fetchErr || { message: 'Trade not found' } }
  if (trade.status !== 'active') return { error: { message: 'Trade is not active' } }
  if (!trade.proposer_accepted || !trade.target_accepted) return { error: { message: 'Both users must accept' } }
  if (trade.proposer_card_number == null || trade.target_card_number == null) return { error: { message: 'Both must select a card' } }

  // 2. Verify same rarity
  const [{ data: propCard }, { data: targCard }] = await Promise.all([
    supabase.from('pack_cards').select('rarity').eq('number', trade.proposer_card_number).single(),
    supabase.from('pack_cards').select('rarity').eq('number', trade.target_card_number).single(),
  ])
  if (!propCard || !targCard || propCard.rarity !== targCard.rarity) {
    return { error: { message: 'Le carte devono essere della stessa rarità' } }
  }

  // 3. Check tokens
  const [proposerTokens, targetTokens] = await Promise.all([
    getTradeTokens(trade.proposer_id),
    getTradeTokens(trade.target_id),
  ])
  if (!proposerTokens || proposerTokens.tokens <= 0) return { error: { message: 'Proposer non ha token disponibili' } }
  if (!targetTokens || targetTokens.tokens <= 0) return { error: { message: 'Target non ha token disponibili' } }

  // 4. Verify ≥2 copies: target must have ≥2 of proposer_card_number, proposer must have ≥2 of target_card_number
  // (each player PICKS what they WANT from the other's duplicates)
  const [tGiveCards, pGiveCards] = await Promise.all([
    supabase.from('pack_user_cards').select('id, obtained_at')
      .eq('user_id', trade.target_id).eq('card_number', trade.proposer_card_number)
      .order('obtained_at', { ascending: false }),
    supabase.from('pack_user_cards').select('id, obtained_at')
      .eq('user_id', trade.proposer_id).eq('card_number', trade.target_card_number)
      .order('obtained_at', { ascending: false }),
  ])
  if (!tGiveCards.data || tGiveCards.data.length < 2) return { error: { message: 'Target non ha abbastanza copie' } }
  if (!pGiveCards.data || pGiveCards.data.length < 2) return { error: { message: 'Proposer non ha abbastanza copie' } }

  // 5. Delete one copy from each (target gives proposer_card_number, proposer gives target_card_number)
  await Promise.all([
    supabase.from('pack_user_cards').delete().eq('id', tGiveCards.data[0].id),
    supabase.from('pack_user_cards').delete().eq('id', pGiveCards.data[0].id),
  ])

  // 6. Grant: proposer gets what they wanted, target gets what they wanted
  await Promise.all([
    grantCard(trade.proposer_id, trade.proposer_card_number, 'trade'),
    grantCard(trade.target_id, trade.target_card_number, 'trade'),
  ])

  // 7. Consume tokens
  await Promise.all([
    consumeTradeToken(trade.proposer_id),
    consumeTradeToken(trade.target_id),
  ])

  // 8. Mark completed
  const { data: completed, error: completeErr } = await supabase.from('pack_trades')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', tradeId).select('*').single()
  return { data: completed, error: completeErr }
}

export async function cancelTrade(tradeId) {
  const { data, error } = await supabase.from('pack_trades')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', tradeId)
    .in('status', ['pending_invite', 'active'])
    .select('*').single()
  return { data, error }
}

export async function getTradeById(tradeId) {
  const { data, error } = await supabase.from('pack_trades')
    .select('*, proposer:profiles!pack_trades_proposer_id_fkey(id, full_name, avatar_url, role), target:profiles!pack_trades_target_id_fkey(id, full_name, avatar_url, role)')
    .eq('id', tradeId).single()
  return { data, error }
}

export async function getPendingInvites(userId) {
  const { data } = await supabase.from('pack_trades')
    .select('*, proposer:profiles!pack_trades_proposer_id_fkey(id, full_name, avatar_url, role)')
    .eq('target_id', userId)
    .eq('status', 'pending_invite')
    .order('created_at', { ascending: false })
  return data || []
}

export async function getActiveTrade(userId) {
  const { data } = await supabase.from('pack_trades')
    .select('*, proposer:profiles!pack_trades_proposer_id_fkey(id, full_name, avatar_url, role), target:profiles!pack_trades_target_id_fkey(id, full_name, avatar_url, role)')
    .or(`proposer_id.eq.${userId},target_id.eq.${userId}`)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return data
}

// ── Trade Realtime ──

export function subscribeToTradeInvites(userId, callback) {
  return supabase
    .channel(`trade-invites-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'pack_trades',
      filter: `target_id=eq.${userId}`,
    }, callback)
    .subscribe()
}

export function subscribeToTradeSession(tradeId, callback) {
  return supabase
    .channel(`trade-session-${tradeId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'pack_trades',
      filter: `id=eq.${tradeId}`,
    }, callback)
    .subscribe()
}

/* ═══════════════════════════════════════════════════════════════════
   MINI-GAMES
   ═══════════════════════════════════════════════════════════════════ */

function getInitialGameState(type, proposerId, targetId) {
  switch (type) {
    case 'connect4':
      return { board: Array.from({ length: 6 }, () => Array(7).fill(0)) }
    case 'othello': {
      const board = Array.from({ length: 8 }, () => Array(8).fill(0))
      board[3][3] = 2; board[3][4] = 1; board[4][3] = 1; board[4][4] = 2
      return { board }
    }
    case 'chess':
      return { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', pgn: '', clocks: { w: 600, b: 600 }, lastMoveTime: null }
    case 'uno': {
      // Create UNO deck, deal 7 cards each, set first discard
      const COLORS = ['red', 'blue', 'green', 'yellow']
      const deck = []
      for (const color of COLORS) {
        deck.push({ color, value: '0' })
        for (let i = 1; i <= 9; i++) { deck.push({ color, value: String(i) }); deck.push({ color, value: String(i) }) }
        for (const sp of ['skip', 'reverse', 'draw2']) { deck.push({ color, value: sp }); deck.push({ color, value: sp }) }
      }
      for (let i = 0; i < 4; i++) { deck.push({ color: 'wild', value: 'wild' }); deck.push({ color: 'wild', value: 'wild_draw4' }) }
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]] }
      const hand1 = deck.splice(0, 7)
      const hand2 = deck.splice(0, 7)
      let firstIdx = deck.findIndex(c => c.color !== 'wild')
      if (firstIdx === -1) firstIdx = 0
      const [firstCard] = deck.splice(firstIdx, 1)
      return {
        hands: { [proposerId]: hand1, [targetId]: hand2 },
        drawPile: deck, discardPile: [firstCard],
        direction: 1, chosenColor: null, lastAction: null,
      }
    }
    case 'snake_battle': {
      return {
        gridSize: 20,
        snakes: {
          [proposerId]: { body: [[2,10],[1,10],[0,10]], dir: 'right' },
          [targetId]: { body: [[17,10],[18,10],[19,10]], dir: 'left' },
        },
        food: [10, 10],
        speed: 180,
      }
    }
    case 'trivia_quiz': {
      // Pick 10 questions: 4 easy + 3 medium + 3 hard — solo challenge
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const easy = shuffle(TRIVIA_QUESTIONS.filter(q => q.difficulty === 'easy')).slice(0, 4)
      const medium = shuffle(TRIVIA_QUESTIONS.filter(q => q.difficulty === 'medium')).slice(0, 3)
      const hard = shuffle(TRIVIA_QUESTIONS.filter(q => q.difficulty === 'hard')).slice(0, 3)
      const questions = [...easy, ...medium, ...hard]
      return {
        questions,
        currentQ: 0,
        score: 0,
      }
    }
    default:
      return {}
  }
}

export async function createGameInvite(proposerId, targetId, gameType) {
  const { data, error } = await supabase.from('mini_games')
    .insert({
      game_type: gameType,
      proposer_id: proposerId,
      target_id: targetId,
      status: 'pending',
      game_state: getInitialGameState(gameType, proposerId, targetId),
      current_turn: proposerId,
    })
    .select('*, proposer:profiles!mini_games_proposer_id_fkey(id, full_name, avatar_url, role), target:profiles!mini_games_target_id_fkey(id, full_name, avatar_url, role)')
    .single()
  return { data, error }
}

export async function acceptGameInvite(gameId) {
  const { data, error } = await supabase.from('mini_games')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', gameId).eq('status', 'pending')
    .select('*, proposer:profiles!mini_games_proposer_id_fkey(id, full_name, avatar_url, role), target:profiles!mini_games_target_id_fkey(id, full_name, avatar_url, role)')
    .single()
  return { data, error }
}

export async function declineGameInvite(gameId) {
  const { data, error } = await supabase.from('mini_games')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', gameId).eq('status', 'pending')
    .select('*').single()
  return { data, error }
}

export async function cancelGame(gameId) {
  const { data, error } = await supabase.from('mini_games')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', gameId).in('status', ['pending', 'active'])
    .select('*').single()
  return { data, error }
}

export async function makeGameMove(gameId, newState, nextTurn, winnerId = null) {
  const update = {
    game_state: newState,
    current_turn: nextTurn,
    updated_at: new Date().toISOString(),
  }
  if (winnerId) { update.winner_id = winnerId; update.status = 'completed' }
  if (winnerId === 'draw') { update.winner_id = null; update.status = 'completed' }
  const { data, error } = await supabase.from('mini_games')
    .update(update)
    .eq('id', gameId).eq('status', 'active')
    .select('*').single()
  return { data, error }
}

export async function getGameById(gameId) {
  const { data, error } = await supabase.from('mini_games')
    .select('*, proposer:profiles!mini_games_proposer_id_fkey(id, full_name, avatar_url, role), target:profiles!mini_games_target_id_fkey(id, full_name, avatar_url, role)')
    .eq('id', gameId).single()
  return { data, error }
}

export function subscribeToGameInvites(userId, callback) {
  return supabase
    .channel(`game-invites-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mini_games',
      filter: `target_id=eq.${userId}`,
    }, callback)
    .subscribe()
}

export function subscribeToGameSession(gameId, callback) {
  return supabase
    .channel(`game-session-${gameId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'mini_games',
      filter: `id=eq.${gameId}`,
    }, callback)
    .subscribe()
}

// ── Roles CRUD ──

export async function getRoles() {
  const { data, error } = await supabase.from('roles').select('*').order('is_preset', { ascending: false }).order('name')
  return { data: data || [], error }
}

export async function createRole(name, slug, description, permissions) {
  const { data, error } = await supabase.from('roles').insert({ name, slug, description, permissions, is_preset: false }).select().single()
  return { data, error }
}

export async function updateRole(roleId, updates) {
  const { data, error } = await supabase.from('roles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', roleId).select().single()
  return { data, error }
}

export async function deleteRole(roleId) {
  // First reassign all users with this role to 'studente'
  const { data: studenteRole } = await supabase.from('roles').select('id').eq('slug', 'studente').single()
  if (studenteRole) {
    await supabase.from('profiles').update({ role_id: studenteRole.id, role: 'studente' }).eq('role_id', roleId)
  }
  const { error } = await supabase.from('roles').delete().eq('id', roleId)
  return { error }
}

export async function assignRole(userId, roleId, roleSlug) {
  // Update both role_id (new) and role text (legacy compat)
  const { data, error } = await supabase.from('profiles').update({ role_id: roleId, role: roleSlug || 'studente' }).eq('id', userId).select().single()
  return { data, error }
}

// ── Slide Layout ──

export async function updateSlideLayout(taskId, layout) {
  const { data, error } = await supabase.from('tasks').update({ slide_layout: layout }).eq('id', taskId).select().single()
  return { data, error }
}

// ── Storyboard Stickers ──

export async function getStickers(projectId) {
  const { data } = await supabase.from('storyboard_stickers').select('*').eq('project_id', projectId).order('z_index')
  return data || []
}

export async function createSticker(sticker) {
  const { data, error } = await supabase.from('storyboard_stickers').insert(sticker).select().single()
  return { data, error }
}

export async function updateSticker(id, updates) {
  const { data, error } = await supabase.from('storyboard_stickers').update(updates).eq('id', id).select().single()
  return { data, error }
}

export async function deleteSticker(id) {
  const { error } = await supabase.from('storyboard_stickers').delete().eq('id', id)
  return { error }
}

export async function uploadStickerImage(projectId, file) {
  if (file && file.size > 5 * 1024 * 1024) return { url: null, error: { message: 'Max 5MB' } }
  return r2Upload('sticker', file, { project_id: projectId })
}


// ── Image annotations (teacher pen drawings on top of WIP / review images) ──
// Keyed by image URL. Strokes are normalised [0..1] of the image's natural size
// so the same payload replays at any display scale.

export async function getImageAnnotations(urls) {
  if (!urls || urls.length === 0) return []
  const { data, error } = await supabase
    .from('image_annotations')
    .select('image_url, strokes, updated_by, updated_at')
    .in('image_url', urls)
  if (error) { console.warn('[image_annotations] fetch error:', error.message); return [] }
  return data || []
}

export async function upsertImageAnnotation(url, strokes, userId) {
  const payload = {
    image_url: url,
    strokes,
    updated_by: userId || null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('image_annotations')
    .upsert(payload, { onConflict: 'image_url' })
    .select()
    .single()
  if (error) console.warn('[image_annotations] save error:', error.message)
  return { data, error }
}

export function subscribeImageAnnotations(callback) {
  return supabase
    .channel('image_annotations_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'image_annotations' }, callback)
    .subscribe()
}

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

// ── WIP Images ──

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
  try {
    // Validate inputs
    if (cardNumber == null || cardNumber < 0) return { url: null, error: { message: 'Invalid card number' } }
    if (!file || !file.size) return { url: null, error: { message: 'No file selected' } }
    if (file.size > 10 * 1024 * 1024) return { url: null, error: { message: 'File too large (max 10MB)' } }

    // Step 1: Get signed upload params from Edge Function
    const sigUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/miro-sync`
    let sigRes
    try {
      sigRes = await fetch(sigUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'get_card_upload_sig', card_number: cardNumber }),
      })
    } catch (networkErr) {
      return { url: null, error: { message: 'Network error in signature request: ' + (networkErr.message || 'connection failed') } }
    }

    let sigJson
    try {
      sigJson = await sigRes.json()
    } catch (_) {
      return { url: null, error: { message: `Edge Function responded with status ${sigRes.status} but invalid JSON` } }
    }
    if (!sigRes.ok) return { url: null, error: { message: sigJson.error || `Signature error (status ${sigRes.status})` } }
    if (!sigJson.cloud_name || !sigJson.api_key || !sigJson.signature || !sigJson.timestamp) {
      return { url: null, error: { message: 'Incomplete signature response — check the Cloudinary credentials in secrets' } }
    }

    // Step 2: Upload directly to Cloudinary
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', sigJson.folder)
    fd.append('timestamp', String(sigJson.timestamp))
    fd.append('api_key', String(sigJson.api_key))
    fd.append('signature', String(sigJson.signature))

    let cloudRes
    try {
      cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sigJson.cloud_name}/image/upload`, {
        method: 'POST',
        body: fd,
      })
    } catch (networkErr) {
      return { url: null, error: { message: 'Cloudinary upload network error: ' + (networkErr.message || 'connection failed') } }
    }

    let cloudJson
    try {
      cloudJson = await cloudRes.json()
    } catch (_) {
      return { url: null, error: { message: `Cloudinary responded with status ${cloudRes.status} but invalid JSON` } }
    }
    if (!cloudRes.ok) {
      const msg = cloudJson.error?.message || JSON.stringify(cloudJson.error) || `Upload failed (status ${cloudRes.status})`
      return { url: null, error: { message: 'Cloudinary: ' + msg } }
    }

    const imageUrl = cloudJson.secure_url
    if (!imageUrl) return { url: null, error: { message: 'Cloudinary did not return an image URL' } }

    // Step 3: Save URL to database
    const { error: dbErr } = await supabase
      .from('pack_cards')
      .update({ image_url: imageUrl })
      .eq('number', cardNumber)
    if (dbErr) return { url: imageUrl, error: { message: 'Image uploaded but DB save error: ' + dbErr.message } }

    return { url: imageUrl, error: null }
  } catch (err) {
    return { url: null, error: { message: 'Unexpected error: ' + (err.message || String(err)) } }
  }
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

// ── TCG Game State ──

export async function getTcgGameActive() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'tcg_game_active').single()
  return data?.value === 'true'
}

export async function setTcgGameActive(active) {
  const { data, error } = await supabase.from('app_settings')
    .upsert({ key: 'tcg_game_active', value: active ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select().single()
  return { data, error }
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
    .select('*, author:profiles(id, full_name, avatar_url, role), task:tasks(id, title, status, department, assigned_to)')
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

// Upload a WIP image via Cloudinary (same pattern as uploadCardImage)
export async function uploadWipImage(taskId, file) {
  try {
    if (!file || !file.size) return { url: null, error: { message: 'No file selected' } }
    if (file.size > 4 * 1024 * 1024) return { url: null, error: { message: 'File too large (max 4MB)' } }

    // Step 1: Get signed upload params from Edge Function
    const sigUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/miro-sync`
    let sigRes
    try {
      sigRes = await fetch(sigUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: 'get_wip_upload_sig', task_id: taskId }),
      })
    } catch (networkErr) {
      return { url: null, error: { message: 'Network error in signature request: ' + (networkErr.message || 'connection failed') } }
    }

    let sigJson
    try {
      sigJson = await sigRes.json()
    } catch (_) {
      return { url: null, error: { message: `Edge Function responded with status ${sigRes.status} but invalid JSON` } }
    }
    if (!sigRes.ok) return { url: null, error: { message: sigJson.error || `Signature error (status ${sigRes.status})` } }
    if (!sigJson.cloud_name || !sigJson.api_key || !sigJson.signature || !sigJson.timestamp) {
      return { url: null, error: { message: 'Incomplete signature response — check the Cloudinary credentials in secrets' } }
    }

    // Step 2: Upload directly to Cloudinary
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', sigJson.folder)
    fd.append('timestamp', String(sigJson.timestamp))
    fd.append('api_key', String(sigJson.api_key))
    fd.append('signature', String(sigJson.signature))

    let cloudRes
    try {
      cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sigJson.cloud_name}/image/upload`, {
        method: 'POST',
        body: fd,
      })
    } catch (networkErr) {
      return { url: null, error: { message: 'Cloudinary upload network error: ' + (networkErr.message || 'connection failed') } }
    }

    let cloudJson
    try {
      cloudJson = await cloudRes.json()
    } catch (_) {
      return { url: null, error: { message: `Cloudinary responded with status ${cloudRes.status} but invalid JSON` } }
    }
    if (!cloudRes.ok) {
      const msg = cloudJson.error?.message || JSON.stringify(cloudJson.error) || `Upload failed (status ${cloudRes.status})`
      return { url: null, error: { message: 'Cloudinary: ' + msg } }
    }

    const imageUrl = cloudJson.secure_url
    if (!imageUrl) return { url: null, error: { message: 'Cloudinary did not return an image URL' } }

    return { url: imageUrl, error: null }
  } catch (err) {
    return { url: null, error: { message: 'Unexpected error: ' + (err.message || String(err)) } }
  }
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
      return { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', pgn: '' }
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

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { isStaff, isAdmin, isSuperAdmin, SUPER_ADMIN_EMAIL } from './lib/constants'
import AdminConsole from './components/admin/AdminConsole'
import AdminEffects from './components/admin/AdminEffects'
import useIsMobile from './hooks/useIsMobile'
import {
  supabase, signOut,
  getProfile, getAllProfiles,
  getShots, createShot, updateShot, deleteShot,
  getTasks, createTask, updateTask, deleteTask,
  addComment,
  getCalendarEvents, createCalendarEvent, deleteCalendarEvent,
  getNotifications, markNotificationRead, markAllNotificationsRead, sendNotification,
  subscribeToTable, subscribeToNotifications,
  subscribeToDMs, getDMUnreadCount,
  uploadConceptImage,
  getTcgGameActive,
  subscribeToGameInvites, getGameById,
  subscribeToTradeInvites, getTradeById,
  updateLastSeen,
  getWipUpdates, createWipUpdate, uploadWipImage, addWipComment,
  getWipViews, markWipViewed,
  updateReviewMeta, subscribeToWipUpdates,
} from './lib/supabase'

import Sidebar from './components/layout/Sidebar'
import ChatPanel from './components/layout/ChatPanel'
import ToastContainer, { useToast } from './components/ui/Toast'
import ConfirmDialog, { useConfirm } from './components/ui/ConfirmDialog'
import InstallBanner from './components/ui/InstallBanner'

import LoginPage from './components/pages/LoginPage'
import OverviewPage from './components/pages/OverviewPage'
import ShotTrackerPage from './components/pages/ShotTrackerPage'
import TasksPage from './components/pages/TasksPage'
import StoryboardPage from './components/pages/StoryboardPage'
import CrewPage from './components/pages/CrewPage'
import ProfilePage from './components/pages/ProfilePage'
import ActivityTrackerPage from './components/pages/ActivityTrackerPage'
import PackPage from './components/pages/PackPage'
import ReviewPage from './components/pages/ReviewPage'
import GameInviteOverlay from './components/games/GameInviteOverlay'
import GameSession from './components/games/GameSession'
import TradeInviteOverlay from './components/pack/TradeInviteOverlay'
import TradeSession from './components/pack/TradeSession'
import { createMiroShotRow, deleteMiroShotRow, uploadReferenceToMiro, fullSyncMiro, fixSyncMiro, fileToBase64, uploadWipImagesToMiro, deleteTaskMiroImages } from './lib/miro'
import { IconPalette, IconClipboard, IconEye, IconCheck, IconAlertTriangle, IconMessageCircle, IconMail, IconBell } from './components/ui/Icons'

import DevConsole from './components/console/DevConsole'
import BroadcastOverlay from './components/console/BroadcastOverlay'
import MatrixRain from './components/console/MatrixRain'
import BanOverlay from './components/console/BanOverlay'
import useAdminChannel from './components/console/useAdminChannel'
import useConsoleKeyboard from './components/console/useConsoleKeyboard'

export default function App() {
  const isMobile = useIsMobile()
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])
  const [shots, setShots] = useState([])
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [view, setView] = useState('overview')
  const [chatOpen, setChatOpen] = useState(false)
  const [deepLink, setDeepLink] = useState(null)
  const [dmUnreadCount, setDmUnreadCount] = useState(0)
  const [tcgGameActive, setTcgGameActive] = useState(false)
  const [wipViews, setWipViews] = useState([])
  const [adminConsoleOpen, setAdminConsoleOpen] = useState(false)
  const [matrixMode, setMatrixMode] = useState(false)
  const [pendingGameInvite, setPendingGameInvite] = useState(null) // { gameId, game, role }
  const [activeGameId, setActiveGameId] = useState(null)
  const [pendingTradeInvite, setPendingTradeInvite] = useState(null) // { tradeId, trade, role }
  const [activeTradeId, setActiveTradeId] = useState(null)
  const [adminFx, setAdminFx] = useState({ broadcastMsg: null, banInfo: null, shaking: 0, disco: 0, flipped: 0, gravity: 0 })
  const adminChRef = useRef(null)
  const dmToastedRef = useRef(new Set())
  const chatOpenRef = useRef(false)
  const { toasts, addToast, removeToast } = useToast()
  const { pending, requestConfirm, confirm, cancel } = useConfirm()

  // iOS PWA standalone viewport fix — window.innerHeight is the only
  // reliable source of truth on iOS; CSS vh/dvh can be wrong in standalone.
  useEffect(() => {
    const setH = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
    setH()
    window.addEventListener('resize', setH)
    // Also fire on orientationchange for older iOS
    window.addEventListener('orientationchange', () => setTimeout(setH, 100))
    return () => window.removeEventListener('resize', setH)
  }, [])

  // Admin DevConsole
  const [consoleOpen, setConsoleOpen] = useState(false)
  const {
    broadcastMessage, dismissBroadcast,
    matrixActive,
    banInfo,
    sendCommand,
  } = useAdminChannel(!!user)
  const toggleConsole = useCallback(() => setConsoleOpen(prev => !prev), [])
  useConsoleKeyboard(user?.role === 'admin', toggleConsole)

  const isBanned = banInfo && (
    user?.full_name === banInfo.target ||
    user?.email === banInfo.email
  )

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUser(session.user)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadUser(session.user)
      else { setUser(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadUser = async (authUser) => {
    let profile = await getProfile(authUser.id)
    if (!profile) {
      const fullName = authUser.user_metadata?.full_name
        || authUser.user_metadata?.name
        || authUser.email?.split('@')[0]?.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        || 'Unknown'
      const { data, error } = await supabase.from('profiles').upsert({
        id: authUser.id, email: authUser.email || '', full_name: fullName,
        avatar_url: authUser.user_metadata?.avatar_url || null, role: 'studente',
      }).select().single()
      if (!error) profile = data
    }
    // Auto-promote super admin if role is not yet set
    if (profile && profile.email === SUPER_ADMIN_EMAIL && profile.role !== 'super_admin') {
      const { data: promoted } = await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', profile.id).select().single()
      if (promoted) profile = promoted
    }
    setUser(profile)
    setLoading(false)
    if (profile) loadData(authUser.id)
  }

  const loadData = async (userId) => {
    const [p, sh, t, ev, n, dmUn, gameActive, wv] = await Promise.all([
      getAllProfiles(), getShots(), getTasks(), getCalendarEvents(), getNotifications(userId), getDMUnreadCount(userId), getTcgGameActive(), getWipViews(userId),
    ])
    setProfiles(p); setShots(sh); setTasks(t); setEvents(ev); setNotifications(n); setDmUnreadCount(dmUn); setTcgGameActive(gameActive); setWipViews(wv)
  }

  const refreshDmUnread = useCallback(() => {
    if (user) getDMUnreadCount(user.id).then(setDmUnreadCount)
  }, [user])

  // Keep chatOpenRef in sync so realtime callback can read it without re-subscribing
  useEffect(() => { chatOpenRef.current = chatOpen }, [chatOpen])

  // Admin Console – Ctrl+Shift+D (desktop) or triple-tap (mobile)
  const tapTimesRef = useRef([])
  useEffect(() => {
    if (!user || !isAdmin(user.role)) return
    const onKey = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        setAdminConsoleOpen(p => !p)
      }
    }
    const onTap = (e) => {
      // ignore taps inside the console itself or on inputs
      if (e.target.closest('[data-admin-console]') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const now = Date.now()
      tapTimesRef.current = [...tapTimesRef.current.filter(t => now - t < 600), now]
      if (tapTimesRef.current.length >= 3) {
        tapTimesRef.current = []
        setAdminConsoleOpen(p => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchend', onTap)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('touchend', onTap) }
  }, [user])

  // Super admin immunity — opening console clears troll effects (but NOT matrix mode)
  useEffect(() => {
    if (adminConsoleOpen && user && isSuperAdmin(user.role)) {
      setAdminFx({ broadcastMsg: null, banInfo: null, shaking: 0, disco: 0, flipped: 0, gravity: 0 })
      // Also reset body-level CSS effects that AdminEffects may have applied
      document.body.style.animation = ''
      document.body.style.transform = ''
      document.body.style.transition = ''
    }
  }, [adminConsoleOpen, user])

  // Admin effects broadcast channel (all users receive) + Presence tracking
  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('admin-fx', { config: { presence: { key: user.id } } })
      .on('broadcast', { event: 'admin-fx' }, ({ payload }) => {
        if (!payload) return
        const meTargeted = !payload.targetId || payload.targetId === user.id
        if (!meTargeted) return
        switch (payload.type) {
          case 'broadcast': setAdminFx(p => ({ ...p, broadcastMsg: payload })); break
          case 'ban': setAdminFx(p => ({ ...p, banInfo: payload })); break
          case 'shake': setAdminFx(p => ({ ...p, shaking: payload.duration })); break
          case 'disco': setAdminFx(p => ({ ...p, disco: payload.duration })); break
          case 'flip': setAdminFx(p => ({ ...p, flipped: payload.duration })); break
          case 'gravity': setAdminFx(p => ({ ...p, gravity: payload.duration })); break
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({
            user_id: user.id,
            full_name: user.full_name || user.email,
            role: user.role || 'studente',
            view: view,
            online_at: new Date().toISOString(),
          })
        }
      })
    adminChRef.current = ch
    return () => supabase.removeChannel(ch)
  }, [user])

  // Update presence when view changes
  useEffect(() => {
    if (!adminChRef.current || !user) return
    adminChRef.current.track({
      user_id: user.id,
      full_name: user.full_name || user.email,
      role: user.role || 'studente',
      view: view,
      online_at: new Date().toISOString(),
    })
  }, [view, user])

  // Persist last_seen_at to DB (on mount + every 2 min + on view change)
  useEffect(() => {
    if (!user) return
    updateLastSeen(user.id, view)
    const iv = setInterval(() => updateLastSeen(user.id, view), 2 * 60 * 1000)
    return () => clearInterval(iv)
  }, [user, view])

  const clearAdminFx = useCallback((key) => {
    setAdminFx(p => ({ ...p, [key]: key === 'shaking' || key === 'disco' || key === 'flipped' || key === 'gravity' ? 0 : null }))
  }, [])

  // Realtime
  useEffect(() => {
    if (!user) return
    const channels = [
      subscribeToTable('shots', () => getShots().then(setShots)),
      subscribeToTable('tasks', () => getTasks().then(setTasks)),
      subscribeToTable('notifications', () => getNotifications(user.id).then(setNotifications)),
      subscribeToNotifications(user.id, (payload) => {
        const n = payload.new
        if (n) {
          addToast(n.title, 'info', {
            body: n.body,
            onClick: () => {
              if (n.link_type && n.link_id) {
                handleNavigate(n.link_type === 'task' ? 'tasks' : n.link_type === 'shot' ? 'shots' : 'overview', n.link_id)
              }
            },
          })
        }
      }),
      // WIP updates realtime: refresh tasks + wipViews
      subscribeToWipUpdates(() => {
        getTasks().then(setTasks)
        if (isStaff(user.role)) getWipViews(user.id).then(setWipViews)
      }),
      // DM realtime: update badge + toast when chat is closed
      subscribeToDMs(user.id, (payload) => {
        refreshDmUnread()
        const msg = payload.new
        if (msg && !chatOpenRef.current) {
          const senderId = msg.sender_id
          if (!dmToastedRef.current.has(senderId)) {
            dmToastedRef.current.add(senderId)
            // Find sender name from profiles
            const sender = profiles.find(p => p.id === senderId)
            const name = sender?.full_name || 'Someone'
            addToast(`New message from ${name}`, 'info', {
              body: msg.body?.slice(0, 80),
              onClick: () => { setChatOpen(true) },
            })
            // Allow re-toast after 30s
            setTimeout(() => dmToastedRef.current.delete(senderId), 30000)
          }
        }
      }),
    ]
    return () => channels.forEach(ch => supabase.removeChannel(ch))
  }, [user, profiles, refreshDmUnread])

  // Game invite subscription (mini-games)
  useEffect(() => {
    if (!user) return
    const sub = subscribeToGameInvites(user.id, async (payload) => {
      const game = payload.new
      if (game && game.status === 'pending' && game.target_id === user.id) {
        // Fetch full game with profiles
        const { data: full } = await getGameById(game.id)
        if (full) setPendingGameInvite({ gameId: game.id, game: full, role: 'target' })
      }
    })
    return () => { if (sub) supabase.removeChannel(sub) }
  }, [user])

  // Trade invite subscription (global — works from any page)
  useEffect(() => {
    if (!user) return
    const sub = subscribeToTradeInvites(user.id, async (payload) => {
      const inv = payload.new
      if (inv && inv.status === 'pending_invite' && inv.target_id === user.id) {
        const { data: full } = await getTradeById(inv.id)
        if (full) setPendingTradeInvite({ tradeId: inv.id, trade: full, role: 'target' })
      }
    })
    return () => { if (sub) supabase.removeChannel(sub) }
  }, [user])

  // Trade invite sent handler (from PackTrading)
  const handleTradeInviteSent = useCallback((tradeId, trade) => {
    setPendingTradeInvite({ tradeId, trade, role: 'proposer' })
  }, [])

  // Game challenge handler (from AdminConsole)
  const handleGameChallenge = useCallback((invite) => {
    setPendingGameInvite(invite)
  }, [])

  const handleNavigate = (targetView, targetId) => {
    setView(targetView)
    if (targetId) setDeepLink({ type: targetView, id: targetId })
  }
  const clearDeepLink = () => setDeepLink(null)

  // Handlers
  const handleCreateShot = async (shot, referenceFile) => {
    // Auto-assign sort_order = next available in the same sequence
    const seqShots = shots.filter(s => s.sequence === shot.sequence)
    const maxOrder = seqShots.reduce((max, s) => Math.max(max, s.sort_order || 0), -1)
    const shotWithOrder = { ...shot, sort_order: maxOrder + 1 }

    const { data } = await createShot(shotWithOrder)
    if (data) {
      // Sync to Miro — must await so miro_shot_rows exists before reference upload
      try {
        const miroRes = await createMiroShotRow(data.id, data.code)
        if (miroRes.error) addToast(`Miro sync error: ${miroRes.error}`, 'danger')
      } catch (err) {
        addToast(`Miro sync failed: ${err.message || err}`, 'danger')
      }
      // Upload reference image after Miro row is ready
      if (referenceFile) {
        handleUploadReference(data.id, referenceFile)
      }
    }
    setShots(await getShots())
  }
  const handleUpdateShot = async (id, updates) => {
    // Optimistic: update UI instantly, then persist in background
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    const { error } = await updateShot(id, updates)
    if (error) setShots(await getShots()) // revert on failure
  }
  const handleDeleteShot = async (id) => {
    // Delete from DB first (CASCADE cleans miro tables), then sync Miro
    await deleteShot(id)
    setShots(await getShots())
    // Trigger Miro rebuild in background (shot already gone from DB)
    deleteMiroShotRow(id).then(res => {
      if (res.error) addToast(`Miro delete error: ${res.error}`, 'danger')
    }).catch(err => addToast(`Miro delete failed: ${err.message || err}`, 'danger'))
  }

  const handleSyncMiro = async () => {
    addToast('Syncing Miro...', 'info')
    try {
      const res = await fullSyncMiro()
      if (res.error) {
        addToast(`Miro sync error: ${res.error}`, 'danger')
      } else {
        addToast(`Miro synced! ${res.data?.shots || 0} shots`, 'success')
      }
    } catch (err) {
      addToast(`Miro sync failed: ${err.message || err}`, 'danger')
    }
  }

  const handleFixMiro = async () => {
    addToast('Fixing Miro...', 'info')
    try {
      const res = await fixSyncMiro()
      if (res.error) {
        addToast(`Fix Miro error: ${res.error}`, 'danger')
      } else {
        const d = res.data || {}
        addToast(`Fix Miro complete! ${d.cells_fixed || 0} cells repaired, ${d.images_fixed || 0} images`, 'success')
      }
    } catch (err) {
      addToast(`Fix Miro failed: ${err.message || err}`, 'danger')
    }
  }

  const handleUploadReference = async (shotId, file) => {
    // Read image dimensions from the file
    const dims = await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src) }
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = URL.createObjectURL(file)
    })
    // Upload reference to Supabase Storage for the site
    const { url } = await uploadConceptImage(shotId, file)
    if (url) await updateShot(shotId, {
      concept_image_url: url,
      ref_img_width: dims.w,
      ref_img_height: dims.h,
    })
    // Also upload to Miro (fire-and-forget)
    try {
      const base64 = await fileToBase64(file)
      await uploadReferenceToMiro(shotId, base64)
    } catch (err) {
      console.warn('Miro reference upload:', err)
    }
    setShots(await getShots())
  }

  const handleCreateTask = async (task) => {
    const { data } = await createTask(task)
    if (data && task.assigned_to) {
      await sendNotification(task.assigned_to, 'task_assigned', 'New task assigned', task.title, 'task', data.id)
    }
    setTasks(await getTasks())
  }

  const handleUpdateTask = async (id, updates) => {
    await updateTask(id, updates)
    const task = tasks.find(t => t.id === id)
    if (updates.status === 'approved' && task?.assigned_to) {
      await sendNotification(task.assigned_to, 'task_approved', 'Task approved!', task.title, 'task', id)
    }
    // Reject notification is handled by handleRejectTask
    setTasks(await getTasks())
  }

  const handleRejectTask = async (id) => {
    const task = tasks.find(t => t.id === id)
    // 1. Remove images from Miro (just the specific cell, not a full sync)
    try { await deleteTaskMiroImages(id) } catch (err) { console.warn('Miro reject cleanup:', err) }
    // 2. Set status back to WIP
    await updateTask(id, { status: 'wip' })
    // 3. Notify student
    if (task?.assigned_to) {
      await sendNotification(task.assigned_to, 'task_revision', 'Changes requested', task.title, 'task', id)
    }
    setTasks(await getTasks())
    addToast('Changes requested', 'success')
  }

  const handleDeleteTask = async (id) => {
    // Must await: edge function needs task in DB to find shot_id/department for Miro cell re-layout
    try { await deleteTaskMiroImages(id) } catch (err) { console.warn('Miro task cleanup:', err) }
    await deleteTask(id)
    setTasks(await getTasks())
  }

  // ── WIP Updates ──

  const handleCreateWipUpdate = async (taskId, note, files) => {
    // 1. Upload images to Cloudinary
    const imageUrls = []
    for (let i = 0; i < files.length; i++) {
      const { url, error } = await uploadWipImage(taskId, files[i])
      if (url) imageUrls.push(url)
      if (error) {
        console.warn('WIP image upload error:', error.message)
        addToast(`Image ${i + 1} upload failed: ${error.message}`, 'danger')
      }
    }
    if (files.length > 0 && imageUrls.length === 0) {
      addToast('No images uploaded — check the console for details', 'danger')
    }

    // 2. Create the WIP update record
    const { data, error } = await createWipUpdate(taskId, user.id, note, imageUrls)
    if (error) {
      addToast('Error creating WIP update', 'danger')
      return null
    }

    // 3. Update task.last_wip_at
    await updateTask(taskId, { last_wip_at: new Date().toISOString() })

    // 4. Notify all staff
    const task = tasks.find(t => t.id === taskId)
    const staffMembers = profiles.filter(p => isStaff(p.role))
    for (const s of staffMembers) {
      await sendNotification(s.id, 'wip_update', 'New WIP update', task?.title || 'Task', 'task', taskId)
    }

    setTasks(await getTasks())
    addToast('WIP update published!', 'success')
    return data
  }

  const handleMarkWipViewed = async (taskId) => {
    await markWipViewed(taskId, user.id)
    setWipViews(await getWipViews(user.id))
  }

  const handleCommitForReview = async (taskId) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // 1. Get latest WIP update with images
    const updates = await getWipUpdates(taskId)
    const latestWithImages = updates.find(u => u.images && u.images.length > 0)

    // 2. Change status to review FIRST — placeCellImages filters by status review/approved
    await updateTask(taskId, { status: 'review' })

    // 3. Upload images to Miro (now the task is "review" so placeCellImages will find it)
    if (latestWithImages && task.shot_id) {
      try {
        const base64Array = await Promise.all(
          latestWithImages.images.map(async (url) => {
            const res = await fetch(url)
            const blob = await res.blob()
            return new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
          })
        )
        await uploadWipImagesToMiro(task.shot_id, task.department, task.id, base64Array, user.id)
      } catch (err) {
        console.warn('Miro upload failed:', err)
      }
    }

    // 4. Notify assigned student
    if (task.assigned_to) {
      await sendNotification(task.assigned_to, 'task_review', 'Task submitted for review', task.title, 'task', taskId)
    }

    setTasks(await getTasks())
    addToast('Task submitted for review!', 'success')
  }

  const handleUpdateReviewMeta = async (taskId, reviewTitle, reviewDescription) => {
    await updateReviewMeta(taskId, reviewTitle, reviewDescription)
    setTasks(await getTasks())
  }

  const handleAddComment = async (taskId, authorId, body) => {
    const result = await addComment(taskId, authorId, body)
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      if (authorId !== task.assigned_to && task.assigned_to) {
        await sendNotification(task.assigned_to, 'comment', 'New comment on your task', body.slice(0, 80), 'task', taskId)
      }
      if (!isStaff(user.role)) {
        const staffMembers = profiles.filter(p => isStaff(p.role))
        for (const s of staffMembers) {
          if (s.id !== authorId) await sendNotification(s.id, 'comment', `Comment from ${user.full_name}`, body.slice(0, 80), 'task', taskId)
        }
      }
    }
    return result
  }

  const handleAddWipComment = async (wipUpdateId, taskId, authorId, body) => {
    const result = await addWipComment(wipUpdateId, authorId, body)
    // Notify the student who owns the task
    const task = tasks.find(t => t.id === taskId)
    if (task?.assigned_to && task.assigned_to !== authorId) {
      await sendNotification(task.assigned_to, 'comment', 'New feedback on your WIP', body.slice(0, 80), 'task', taskId)
    }
    return result
  }

  const handleCreateEvent = async (ev) => { await createCalendarEvent(ev); setEvents(await getCalendarEvents()) }
  const handleDeleteEvent = async (id) => { await deleteCalendarEvent(id); setEvents(await getCalendarEvents()) }
  const handleMarkRead = async (id) => { await markNotificationRead(id); setNotifications(await getNotifications(user.id)) }
  const handleMarkAllRead = async () => { await markAllNotificationsRead(user.id); setNotifications(await getNotifications(user.id)) }
  const handleProfileUpdate = (updatedProfile) => {
    setUser(updatedProfile)
    setProfiles(prev => prev.map(p => p.id === updatedProfile.id ? { ...p, ...updatedProfile } : p))
  }

  // Loading screen
  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5' }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/icons/icon-app.png" alt="BigRock Hub" style={{
          width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px',
          animation: 'pulse 1.5s ease infinite',
        }} />
        <div style={{ color: '#94A3B8', fontSize: 13 }}>Loading...</div>
      </div>
    </div>
  )
  if (!session || !user) return <LoginPage />

  const unreadCount = notifications.filter(n => !n.read).length

  // ── Notification rendering for mobile full-page view ──
  const renderMobileNotifications = () => {
    const NOTIF_CAT = {
      wip_update: { label: 'WIP', color: '#2563EB', bg: '#DBEAFE', icon: <IconPalette size={16} /> },
      task_assigned: { label: 'Assigned', color: '#F28C28', bg: '#FFF4E6', icon: <IconClipboard size={16} /> },
      task_review: { label: 'Review', color: '#F28C28', bg: '#FFF4E6', icon: <IconEye size={16} /> },
      task_approved: { label: 'Approved', color: '#00B894', bg: '#E8F8F5', icon: <IconCheck size={16} /> },
      task_revision: { label: 'Revision', color: '#E17055', bg: '#FFF0ED', icon: <IconAlertTriangle size={16} /> },
      comment: { label: 'Comment', color: '#F39C12', bg: '#FFF8E7', icon: <IconMessageCircle size={16} /> },
      dm: { label: 'Message', color: '#D63031', bg: '#FFEDED', icon: <IconMail size={16} /> },
    }
    const NOTIF_DEFAULT = { label: 'Notification', color: '#64748B', bg: '#F1F5F9', icon: <IconBell size={16} /> }
    const getCat = (type) => NOTIF_CAT[type] || NOTIF_DEFAULT

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Notifications</h1>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} style={{ fontSize: 12, color: '#F28C28', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Mark all read
            </button>
          )}
        </div>
        {(!notifications || notifications.length === 0) ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>No notifications</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notifications.slice(0, 50).map(n => {
              const cat = getCat(n.type)
              const unread = !n.read
              const date = new Date(n.created_at)
              const diffMin = Math.floor((Date.now() - date) / 60000)
              const diffH = Math.floor(diffMin / 60)
              const diffD = Math.floor(diffH / 24)
              const timeStr = diffMin < 1 ? 'Now' : diffMin < 60 ? `${diffMin}m` : diffH < 24 ? `${diffH}h` : diffD < 7 ? `${diffD}d` : date.toLocaleDateString('en', { day: 'numeric', month: 'short' })
              return (
                <div key={n.id} onClick={() => {
                  handleMarkRead(n.id)
                  if (n.link_type && n.link_id) handleNavigate(n.link_type === 'task' ? 'tasks' : n.link_type === 'shot' ? 'shots' : 'overview', n.link_id)
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  borderRadius: 14, cursor: 'pointer',
                  borderLeft: unread ? `3.5px solid ${cat.color}` : '3.5px solid transparent',
                  background: unread ? cat.bg : '#fff',
                  border: `1px solid ${unread ? cat.color + '30' : '#E8ECF1'}`,
                }}>
                  <span style={{ fontSize: 18, width: 36, height: 36, borderRadius: 10, background: unread ? `${cat.color}15` : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{cat.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.04em', background: `${cat.color}15`, padding: '1px 6px', borderRadius: 4 }}>{cat.label}</span>
                      {unread && <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.color }} />}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: unread ? 600 : 400, color: '#1a1a1a', lineHeight: 1.3 }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</div>}
                  </div>
                  <span style={{ fontSize: 10, color: '#B0B8C4', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeStr}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const contentPadding = isMobile ? '16px 16px 60px' : '36px 44px'

  return (
    <div className={isMobile ? 'mobile-safe-top' : ''} style={{ display: 'flex', height: isMobile ? 'var(--app-height, 100vh)' : '100vh', background: '#F0F2F5', overflow: 'hidden' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmDialog pending={pending} onConfirm={confirm} onCancel={cancel} />
      {isMobile && <InstallBanner />}
      <AdminEffects effects={adminFx} userId={user.id} matrixMode={matrixMode} onClear={clearAdminFx} />
      {adminConsoleOpen && isAdmin(user.role) && (
        <AdminConsole user={user} profiles={profiles} channelRef={adminChRef} matrixMode={matrixMode} onMatrixToggle={() => setMatrixMode(p => !p)} onGameChallenge={handleGameChallenge} onClose={() => setAdminConsoleOpen(false)} isMobile={isMobile} />
      )}

      <Sidebar
        user={user} view={view} setView={setView} onSignOut={signOut}
        events={events} onCreateEvent={handleCreateEvent} onDeleteEvent={handleDeleteEvent}
        notifications={notifications} onMarkRead={handleMarkRead} onMarkAllRead={handleMarkAllRead} onNavigate={handleNavigate}
        requestConfirm={requestConfirm} unreadCount={unreadCount} tcgGameActive={tcgGameActive}
        reviewCount={tasks.filter(t => t.status === 'review').length}
      />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Full-bleed views: storyboard, pack — no padding, no maxWidth */}
        {(view === 'storyboard' || view === 'pack') ? (
          <div style={{ flex: 1, overflow: 'hidden', ...(isMobile ? { paddingBottom: 44 } : {}) }}>
            {view === 'storyboard' && <StoryboardPage />}
            {view === 'pack' && (isAdmin(user.role) || tcgGameActive) && (
              <PackPage user={user} profiles={profiles} addToast={addToast} requestConfirm={requestConfirm} tcgGameActive={tcgGameActive} onGameStateChange={setTcgGameActive} onTradeInviteSent={handleTradeInviteSent} />
            )}
          </div>
        ) : (
          <div style={{ flex: 1, padding: contentPadding, overflowY: 'auto', ...(isMobile ? { overflowX: 'hidden' } : { maxWidth: 1400 }), width: '100%', margin: '0 auto' }}>
            {view === 'overview' && <OverviewPage shots={shots} tasks={tasks} profiles={profiles} user={user} />}
            {view === 'shots' && <ShotTrackerPage shots={shots} user={user} onUpdateShot={handleUpdateShot} onCreateShot={handleCreateShot} onDeleteShot={handleDeleteShot} onUploadReference={handleUploadReference} onSyncMiro={handleSyncMiro} onFixMiro={handleFixMiro} addToast={addToast} requestConfirm={requestConfirm} />}
            {view === 'tasks' && <TasksPage tasks={tasks} shots={shots} profiles={profiles} user={user} onCreateTask={handleCreateTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onRejectTask={handleRejectTask} onAddWipComment={handleAddWipComment} onCreateWipUpdate={handleCreateWipUpdate} onMarkWipViewed={handleMarkWipViewed} onCommitForReview={handleCommitForReview} wipViews={wipViews} addToast={addToast} requestConfirm={requestConfirm} deepLink={deepLink} clearDeepLink={clearDeepLink} />}
            {view === 'review' && isStaff(user.role) && <ReviewPage shots={shots} tasks={tasks} profiles={profiles} user={user} onUpdateTask={handleUpdateTask} onUpdateReviewMeta={handleUpdateReviewMeta} addToast={addToast} />}
            {view === 'crew' && <CrewPage profiles={profiles} user={user} />}
            {view === 'profile' && <ProfilePage user={user} onProfileUpdate={handleProfileUpdate} addToast={addToast} />}
            {view === 'activity' && isStaff(user.role) && <ActivityTrackerPage tasks={tasks} profiles={profiles} user={user} onNavigate={handleNavigate} />}
            {view === 'notifications' && renderMobileNotifications()}
          </div>
        )}
      </div>

      <ChatPanel user={user} open={chatOpen} onToggle={() => setChatOpen(!chatOpen)} profiles={profiles} dmUnreadCount={dmUnreadCount} onDmRead={refreshDmUnread} isMobile={isMobile} />

      {/* Mini-game overlays */}
      {pendingGameInvite && !activeGameId && createPortal(
        <GameInviteOverlay
          gameId={pendingGameInvite.gameId}
          game={pendingGameInvite.game}
          role={pendingGameInvite.role}
          onAccepted={(id) => { setPendingGameInvite(null); setActiveGameId(id) }}
          onClose={() => setPendingGameInvite(null)}
          addToast={addToast}
        />,
        document.body
      )}
      {activeGameId && createPortal(
        <GameSession
          gameId={activeGameId}
          user={user}
          onClose={() => setActiveGameId(null)}
          addToast={addToast}
          isMobile={isMobile}
        />,
        document.body
      )}

      {/* Trade overlays */}
      {pendingTradeInvite && !activeTradeId && createPortal(
        <TradeInviteOverlay
          tradeId={pendingTradeInvite.tradeId}
          trade={pendingTradeInvite.trade}
          role={pendingTradeInvite.role}
          onAccepted={(id) => { setPendingTradeInvite(null); setActiveTradeId(id) }}
          onClose={() => setPendingTradeInvite(null)}
          addToast={addToast}
        />,
        document.body
      )}
      {activeTradeId && createPortal(
        <TradeSession
          tradeId={activeTradeId}
          user={user}
          addToast={addToast}
          onClose={() => setActiveTradeId(null)}
        />,
        document.body
      )}

      {/* Admin DevConsole */}
      {user?.role === 'admin' && consoleOpen && (
        <DevConsole
          open={consoleOpen}
          onClose={() => setConsoleOpen(false)}
          sendCommand={sendCommand}
          profiles={profiles}
          addToast={addToast}
        />
      )}

      {/* Broadcast overlay — all users */}
      {broadcastMessage && (
        <BroadcastOverlay message={broadcastMessage} onDismiss={dismissBroadcast} />
      )}

      {/* Matrix rain — all users */}
      {matrixActive && <MatrixRain />}

      {/* Ban overlay — targeted user only */}
      {isBanned && (
        <BanOverlay seconds={banInfo.seconds} onExpire={() => {}} />
      )}
    </div>
  )
}

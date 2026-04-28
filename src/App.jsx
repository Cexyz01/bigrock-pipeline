import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { isStaff, isAdmin, isSuperAdmin, hasPermission, SUPER_ADMIN_EMAILS, isAudioUrl } from './lib/constants'
import AdminConsole from './components/admin/AdminConsole'
import AdminEffects from './components/admin/AdminEffects'
import useIsMobile from './hooks/useIsMobile'
import {
  supabase, signOut,
  getProfile, getAllProfiles,
  getShots, createShot, updateShot, deleteShot,
  getAssets, createAsset, updateAsset, deleteAsset,
  getTasks, createTask, updateTask, deleteTask, setTaskAssignees,
  getGanttItems, createGanttItem, updateGanttItem, deleteGanttItem,
  getGanttLanes, createGanttLane, updateGanttLane, deleteGanttLane,
  getProjectPauses, createProjectPause, deleteProjectPause,
  updateProject,
  addComment,
  getCalendarEvents, createCalendarEvent, deleteCalendarEvent,
  getNotifications, markNotificationRead, markAllNotificationsRead, sendNotification,
  subscribeToTable, subscribeToNotifications,
  subscribeToDMs, getDMUnreadCount,
  uploadConceptImage, uploadOutputImage, uploadTimelineFile,
  getTcgGameActive,
  subscribeToGameInvites, getGameById,
  subscribeToTradeInvites, getTradeById,
  updateLastSeen,
  getWipUpdates, createWipUpdate, uploadWipImage, addWipComment,
  getWipViews, markWipViewed, uploadWipFile,
  updateReviewMeta, subscribeToWipUpdates,
  getProjects, getUserProjects,
  getUnseenSuperNotifications, markSuperNotificationSeen,
} from './lib/supabase'

import Sidebar from './components/layout/Sidebar'
import ChatPanel from './components/layout/ChatPanel'
import ToastContainer, { useToast } from './components/ui/Toast'
import ConfirmDialog, { useConfirm } from './components/ui/ConfirmDialog'
import InstallBanner from './components/ui/InstallBanner'

import WaitingScreen from './components/pages/WaitingScreen'
import ProjectManagementPage from './components/pages/ProjectManagementPage'
import SuperNotifOverlay from './components/ui/SuperNotifOverlay'
import LoginPage from './components/pages/LoginPage'
import OverviewPage from './components/pages/OverviewPage'
import ShotTrackerPage from './components/pages/ShotTrackerPage'
import TasksPage from './components/pages/TasksPage'
import StoryboardPage from './components/pages/StoryboardPage'
import TimelinePage from './components/pages/TimelinePage'
import CrewPage from './components/pages/CrewPage'
import ProfilePage from './components/pages/ProfilePage'
import ActivityTrackerPage from './components/pages/ActivityTrackerPage'
import PackPage from './components/pages/PackPage'
import ReviewPage from './components/pages/ReviewPage'
import GanttPage from './components/pages/GanttPage'
import GameInviteOverlay from './components/games/GameInviteOverlay'
import GameSession from './components/games/GameSession'
import TradeInviteOverlay from './components/pack/TradeInviteOverlay'
import TradeSession from './components/pack/TradeSession'
import { createMiroShotRow, deleteMiroShotRow, uploadReferenceToMiro, fileToBase64, uploadWipImagesToMiro, deleteTaskMiroImages } from './lib/miro'
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
  const [assets, setAssets] = useState([])
  const [tasks, setTasks] = useState([])
  const [ganttItems, setGanttItems] = useState([])
  const [ganttLanes, setGanttLanes] = useState([])
  const [projectPauses, setProjectPauses] = useState([])
  const [events, setEvents] = useState([])
  const [notifications, setNotifications] = useState([])
  const [view, setViewRaw] = useState('overview')
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
  const [projects, setProjects] = useState([])
  const [currentProject, setCurrentProject] = useState(null)
  const [myPerms, setMyPerms] = useState({ can_manage_project: false, can_manage_shots: false, can_review: false })
  const [superNotifs, setSuperNotifs] = useState([])
  const [currentSuperNotif, setCurrentSuperNotif] = useState(null)

  // Wrap setView to check for super notifications on every page change
  const setView = useCallback((v) => {
    setViewRaw(v)
    if (user) {
      getUnseenSuperNotifications(user.id).then(sn => {
        if (sn.length > 0) {
          setSuperNotifs(sn)
          setCurrentSuperNotif(sn[0])
        }
      })
    }
  }, [user])

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
    if (profile && SUPER_ADMIN_EMAILS.includes(profile.email) && profile.role !== 'super_admin') {
      const { data: promoted } = await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', profile.id).select().single()
      if (promoted) profile = promoted
    }
    setUser(profile)
    setLoading(false)
    if (profile) {
      // Load projects for this user
      const userProjects = (SUPER_ADMIN_EMAILS.includes(profile.email) || profile.role_permissions?.manage_roles) ? await getProjects() : await getUserProjects(profile.id)
      setProjects(userProjects)
      // Auto-select project
      const savedId = localStorage.getItem('bigrock_current_project')
      const saved = savedId && userProjects.find(p => p.id === savedId)
      const selected = saved || userProjects[0] || null
      setCurrentProject(selected)
      if (selected) loadData(authUser.id, selected.id)
      // Load super notifications
      const sn = await getUnseenSuperNotifications(authUser.id)
      setSuperNotifs(sn)
      if (sn.length > 0) setCurrentSuperNotif(sn[0])
    }
  }

  const loadData = async (userId, projectId) => {
    const [p, sh, as, t, ev, n, dmUn, gameActive, wv, gi, gl, pp] = await Promise.all([
      getAllProfiles(),
      getShots(projectId),
      getAssets(projectId),
      getTasks({ project_id: projectId }),
      getCalendarEvents(projectId),
      getNotifications(userId),
      getDMUnreadCount(userId),
      getTcgGameActive(),
      getWipViews(userId),
      getGanttItems(projectId),
      getGanttLanes(projectId),
      getProjectPauses(projectId),
    ])
    setProfiles(p); setShots(sh); setAssets(as); setTasks(t); setEvents(ev); setNotifications(n); setDmUnreadCount(dmUn); setTcgGameActive(gameActive); setWipViews(wv); setGanttItems(gi); setGanttLanes(gl); setProjectPauses(pp)
    // Derive permissions from global role only
    const myProfile = p.find(pr => pr.id === userId)
    setMyPerms({
      can_manage_project: hasPermission(myProfile, 'manage_project_settings'),
      can_manage_shots: hasPermission(myProfile, 'create_edit_shots'),
      can_review: hasPermission(myProfile, 'access_review'),
    })
  }

  const handleSelectProject = useCallback((project) => {
    setCurrentProject(project)
    localStorage.setItem('bigrock_current_project', project.id)
    if (user) loadData(user.id, project.id)
  }, [user])

  // Refresh projects list (after create/delete)
  const refreshProjects = useCallback(async () => {
    if (!user) return
    const userProjects = hasPermission(user, 'manage_roles') ? await getProjects() : await getUserProjects(user.id)
    setProjects(userProjects)
    // If current project was deleted, select first available
    if (currentProject && !userProjects.find(p => p.id === currentProject.id)) {
      const next = userProjects[0] || null
      setCurrentProject(next)
      if (next) {
        localStorage.setItem('bigrock_current_project', next.id)
        loadData(user.id, next.id)
      }
    }
  }, [user, currentProject])

  const refreshDmUnread = useCallback(() => {
    if (user) getDMUnreadCount(user.id).then(setDmUnreadCount)
  }, [user])

  // Keep chatOpenRef in sync so realtime callback can read it without re-subscribing
  useEffect(() => { chatOpenRef.current = chatOpen }, [chatOpen])

  // Admin Console – Ctrl+Shift+D (desktop) or triple-tap (mobile)
  const tapTimesRef = useRef([])
  useEffect(() => {
    if (!user || !hasPermission(user, 'access_admin_console')) return
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
    if (!user || !currentProject) return
    const pid = currentProject.id
    const channels = [
      subscribeToTable('shots', () => getShots(pid).then(setShots), `project_id=eq.${pid}`),
      subscribeToTable('assets', () => getAssets(pid).then(setAssets), `project_id=eq.${pid}`),
      subscribeToTable('tasks', () => getTasks({ project_id: pid }).then(setTasks), `project_id=eq.${pid}`),
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
        getTasks({ project_id: pid }).then(setTasks)
        if (hasPermission(user, 'access_review')) getWipViews(user.id).then(setWipViews)
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
  }, [user, currentProject, profiles, refreshDmUnread])

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
    const shotWithOrder = { ...shot, project_id: currentProject.id, sort_order: maxOrder + 1 }

    const { data, error } = await createShot(shotWithOrder)
    if (error) { addToast(`Errore creazione shot: ${error.message}`, 'danger'); return }
    if (data) {
      // Legacy Miro sync — only if this project has a Miro board configured
      if (currentProject?.miro_board_id) {
        try { await createMiroShotRow(data.id, data.code, currentProject.miro_board_id) }
        catch (err) { console.warn('Miro sync skipped:', err) }
      }
      if (referenceFile) {
        handleUploadReference(data.id, referenceFile)
      }
    }
    setShots(await getShots(currentProject?.id))
  }
  const handleUpdateShot = async (id, updates) => {
    // Optimistic: update UI instantly, then persist in background
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    const { error } = await updateShot(id, updates)
    if (error) setShots(await getShots(currentProject?.id)) // revert on failure
  }
  // Batch reorder — single optimistic state update, DB writes fire-and-forget
  const handleReorderShots = (changes) => {
    if (!changes || changes.length === 0) return
    const map = new Map(changes.map(c => [c.id, c.updates]))
    setShots(prev => prev.map(s => map.has(s.id) ? { ...s, ...map.get(s.id) } : s))
    // Fire DB writes in parallel, don't await — revert only if any fails
    Promise.all(changes.map(c => updateShot(c.id, c.updates))).then(results => {
      if (results.some(r => r.error)) {
        getShots(currentProject?.id).then(setShots)
        addToast('Errore salvataggio ordine, ripristino', 'danger')
      }
    })
  }
  const handleDeleteShot = async (id) => {
    // Delete from DB first (CASCADE cleans related tables)
    const { error } = await deleteShot(id)
    if (error) {
      addToast(`Impossibile eliminare lo shot: ${error.message}`, 'danger')
      return
    }
    setShots(await getShots(currentProject?.id))
    // Legacy Miro cleanup (background, silent) — only if project has a Miro board
    if (currentProject?.miro_board_id) {
      deleteMiroShotRow(id, currentProject.miro_board_id).catch(err => console.warn('Miro cleanup skipped:', err))
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
    // Legacy Miro reference upload — only if project has a Miro board
    if (currentProject?.miro_board_id) {
      try {
        const base64 = await fileToBase64(file)
        await uploadReferenceToMiro(shotId, base64, currentProject.miro_board_id)
      } catch (err) {
        console.warn('Miro reference upload skipped:', err)
      }
    }
    setShots(await getShots(currentProject?.id))
  }

  const handleUploadOutput = async (shotId, file) => {
    const { url, width, height } = await uploadOutputImage(shotId, file)
    if (url) {
      await updateShot(shotId, {
        output_cloud_url: url,
        output_img_width: width || 0,
        output_img_height: height || 0,
      })
      setShots(await getShots(currentProject?.id))
      addToast('Output uploaded', 'success')
    } else {
      addToast('Output upload failed', 'danger')
    }
  }

  const handleUploadShotAudio = async (shotId, file) => {
    const { url, error } = await uploadTimelineFile(shotId, file)
    if (url) {
      await updateShot(shotId, { audio_url: url })
      setShots(await getShots(currentProject?.id))
      addToast('Audio uploaded', 'success')
    } else {
      addToast('Audio upload failed: ' + (error?.message || 'unknown'), 'danger')
    }
  }

  // ── Assets ──
  const handleCreateAsset = async (asset, referenceFile) => {
    const maxOrder = assets.reduce((max, a) => Math.max(max, a.sort_order || 0), -1)
    const payload = { ...asset, project_id: currentProject.id, created_by: user.id, sort_order: maxOrder + 1 }
    const { data, error } = await createAsset(payload)
    if (error) { addToast(`Errore creazione asset: ${error.message}`, 'danger'); return }
    if (data && referenceFile) handleUploadAssetReference(data.id, referenceFile)
    setAssets(await getAssets(currentProject?.id))
  }

  const handleUpdateAsset = async (id, updates) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
    const { error } = await updateAsset(id, updates)
    if (error) setAssets(await getAssets(currentProject?.id))
  }

  const handleReorderAssets = (changes) => {
    if (!changes || changes.length === 0) return
    const map = new Map(changes.map(c => [c.id, c.updates]))
    setAssets(prev => prev.map(a => map.has(a.id) ? { ...a, ...map.get(a.id) } : a))
    Promise.all(changes.map(c => updateAsset(c.id, c.updates))).then(results => {
      if (results.some(r => r.error)) {
        getAssets(currentProject?.id).then(setAssets)
        addToast('Errore salvataggio ordine asset, ripristino', 'danger')
      }
    })
  }

  const handleDeleteAsset = async (id) => {
    const { error } = await deleteAsset(id)
    if (error) { addToast(`Impossibile eliminare l'asset: ${error.message}`, 'danger'); return }
    setAssets(await getAssets(currentProject?.id))
    setTasks(await getTasks({ project_id: currentProject?.id }))
  }

  const handleUploadAssetReference = async (assetId, file) => {
    const dims = await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src) }
      img.onerror = () => resolve({ w: 0, h: 0 })
      img.src = URL.createObjectURL(file)
    })
    // Reuse the concept upload signature endpoint — it only generates a Cloudinary signature,
    // shot_id is just an opaque identifier in the payload.
    const { url, error } = await uploadConceptImage(assetId, file)
    if (error) { addToast('Asset reference upload failed: ' + error.message, 'danger'); return }
    if (url) await updateAsset(assetId, { ref_cloud_url: url, ref_img_width: dims.w, ref_img_height: dims.h })
    setAssets(await getAssets(currentProject?.id))
  }

  const handleUploadAssetOutput = async (assetId, file) => {
    const { url, width, height, error } = await uploadOutputImage(assetId, file)
    if (error) { addToast('Asset output upload failed: ' + error.message, 'danger'); return }
    if (url) {
      await updateAsset(assetId, { output_cloud_url: url, output_img_width: width || 0, output_img_height: height || 0 })
      setAssets(await getAssets(currentProject?.id))
      addToast('Output uploaded', 'success')
    }
  }

  const handleCreateTask = async (task) => {
    const assigneeIds = task.assignee_ids || []
    const { data } = await createTask({ ...task, project_id: currentProject.id })
    if (data && assigneeIds.length) {
      for (const uid of assigneeIds) {
        await sendNotification(uid, 'task_assigned', 'New task assigned', task.title, 'task', data.id)
      }
    }
    setTasks(await getTasks({ project_id: currentProject?.id }))
  }

  const handleSetTaskAssignees = async (taskId, userIds) => {
    const before = tasks.find(t => t.id === taskId)
    const beforeIds = new Set((before?.assignees || []).map(a => a.user.id))
    const afterIds = new Set(userIds)
    const newlyAdded = [...afterIds].filter(id => !beforeIds.has(id))
    await setTaskAssignees(taskId, userIds)
    // Notify newly-added assignees
    if (before) {
      for (const uid of newlyAdded) {
        await sendNotification(uid, 'task_assigned', 'New task assigned', before.title, 'task', taskId)
      }
    }
    setTasks(await getTasks({ project_id: currentProject?.id }))
  }

  // Batch reorder tasks within a group — optimistic update, parallel DB writes
  const handleReorderTasks = (changes) => {
    if (!changes || changes.length === 0) return
    const map = new Map(changes.map(c => [c.id, c.updates]))
    setTasks(prev => prev.map(t => map.has(t.id) ? { ...t, ...map.get(t.id) } : t))
    Promise.all(changes.map(c => updateTask(c.id, c.updates))).then(results => {
      if (results.some(r => r?.error)) {
        getTasks({ project_id: currentProject?.id }).then(setTasks)
        addToast('Errore salvataggio ordine, ripristino', 'danger')
      }
    })
  }

  const handleUpdateTask = async (id, updates) => {
    // Clear revision comment when task is approved or re-submitted for review
    if (updates.status === 'approved' || updates.status === 'review') {
      updates.revision_comment = null
    }
    await updateTask(id, updates)
    const task = tasks.find(t => t.id === id)
    if (updates.status === 'approved' && task) {
      for (const a of (task.assignees || [])) {
        await sendNotification(a.user.id, 'task_approved', 'Task approved!', task.title, 'task', id)
      }
    }
    // Reject notification is handled by handleRejectTask
    setTasks(await getTasks({ project_id: currentProject?.id }))
  }

  const handleRejectTask = async (id, comment = '') => {
    const task = tasks.find(t => t.id === id)
    // Legacy Miro cleanup — only if project has a Miro board
    if (currentProject?.miro_board_id) {
      try { await deleteTaskMiroImages(id, currentProject.miro_board_id) } catch (err) { console.warn('Miro reject cleanup skipped:', err) }
    }
    // 2. Set status back to WIP
    await updateTask(id, { status: 'wip' })
    // 3. Add comment to the latest WIP update if provided
    if (comment.trim()) {
      try {
        const { data: wipUpdates } = await supabase.from('task_wip_updates')
          .select('id').eq('task_id', id).order('created_at', { ascending: false }).limit(1)
        if (wipUpdates?.length > 0) {
          await addWipComment(wipUpdates[0].id, user.id, `📌 Modifiche richieste: ${comment.trim()}`)
        }
      } catch (err) { console.warn('Failed to add revision comment:', err) }
    }
    // 4. Notify all assignees
    if (task) {
      const msg = comment ? `Changes requested: ${comment}` : 'Changes requested'
      for (const a of (task.assignees || [])) {
        await sendNotification(a.user.id, 'task_revision', msg, task.title, 'task', id)
      }
    }
    setTasks(await getTasks({ project_id: currentProject?.id }))
    addToast('Changes requested', 'success')
  }

  const handleDeleteTask = async (id) => {
    // Legacy Miro cleanup before DB delete — only if project has a Miro board
    if (currentProject?.miro_board_id) {
      try { await deleteTaskMiroImages(id, currentProject.miro_board_id) } catch (err) { console.warn('Miro task cleanup skipped:', err) }
    }
    const { error } = await deleteTask(id)
    if (error) { addToast(`Impossibile eliminare il task: ${error.message}`, 'danger'); return }
    setTasks(await getTasks({ project_id: currentProject?.id }))
  }

  // ── WIP Updates ──

  const handleCreateWipUpdate = async (taskId, note, files) => {
    // 1. Upload files to Cloudinary (images via uploadWipImage, audio via uploadWipFile)
    const imageUrls = []
    for (let i = 0; i < files.length; i++) {
      const isAudio = files[i].type?.startsWith('audio/')
      const { url, error } = isAudio
        ? await uploadWipFile(taskId, files[i])
        : await uploadWipImage(taskId, files[i])
      if (url) imageUrls.push(url)
      if (error) {
        console.warn('WIP upload error:', error.message)
        addToast(`File ${i + 1} upload failed: ${error.message}`, 'danger')
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
    const staffMembers = profiles.filter(p => isStaff(p))
    for (const s of staffMembers) {
      await sendNotification(s.id, 'wip_update', 'New WIP update', task?.title || 'Task', 'task', taskId)
    }

    setTasks(await getTasks({ project_id: currentProject?.id }))
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

    // 1. Get all WIP updates and reduce to latest-with-files PER assignee.
    //    Multi-assignee tasks: each student's latest WIP gets pushed to storyboard.
    const updates = await getWipUpdates(taskId)
    const latestPerUser = new Map()
    for (const u of updates) {
      if (!u.images || u.images.length === 0) continue
      if (!latestPerUser.has(u.user_id)) latestPerUser.set(u.user_id, u)
    }

    // 2. Change status to review FIRST — placeCellImages filters by status review/approved
    await updateTask(taskId, { status: 'review' })

    // 3. Upload each user's latest WIP to storyboard.
    //    Each user's row set is replaced independently — other students' rows untouched.
    if (latestPerUser.size > 0 && (task.shot_id || task.asset_id)) {
      const isAssetTask = !task.shot_id && task.asset_id

      for (const [uploaderId, wip] of latestPerUser) {
        // Per-user dedup for asset tasks (edge fn handles dedup for shot tasks)
        if (isAssetTask) {
          try { await supabase.from('miro_wip_images').delete().eq('task_id', taskId).eq('uploaded_by', uploaderId) } catch (err) { console.warn('Per-user clean failed:', err) }
        }
        const imageUrls = wip.images.filter(url => !isAudioUrl(url))
        const audioUrls = wip.images.filter(url => isAudioUrl(url))

        // Shot tasks: send to Miro edge function (also writes miro_wip_images rows)
        if (imageUrls.length > 0 && !isAssetTask) {
          try {
            const base64Array = await Promise.all(imageUrls.map(async (url) => {
              const res = await fetch(url)
              const blob = await res.blob()
              return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.onerror = reject
                reader.readAsDataURL(blob)
              })
            }))
            await uploadWipImagesToMiro(task.shot_id, task.department, task.id, base64Array, uploaderId, currentProject?.miro_board_id)
          } catch (err) {
            console.warn('Storyboard upload failed for user', uploaderId, err)
          }
        }

        // Asset tasks: insert directly into miro_wip_images
        if (imageUrls.length > 0 && isAssetTask) {
          try {
            const existingImages = await supabase.from('miro_wip_images')
              .select('image_order').eq('task_id', taskId).order('image_order', { ascending: false }).limit(1)
            let nextOrder = (existingImages.data?.[0]?.image_order ?? -1) + 1
            for (const imgUrl of imageUrls) {
              await supabase.from('miro_wip_images').insert({
                shot_id: null,
                asset_id: task.asset_id,
                task_id: taskId,
                department: task.department,
                miro_item_id: 'asset',
                uploaded_by: uploaderId,
                image_url: imgUrl,
                image_order: nextOrder++,
                img_width: 0,
                img_height: 0,
              })
            }
          } catch (err) {
            console.warn('Asset image insert to storyboard failed for user', uploaderId, err)
          }
        }

        // Audio rows (both shot/asset)
        if (audioUrls.length > 0) {
          try {
            const existingImages = await supabase.from('miro_wip_images')
              .select('image_order').eq('task_id', taskId).order('image_order', { ascending: false }).limit(1)
            let nextOrder = (existingImages.data?.[0]?.image_order ?? -1) + 1
            for (const audioUrl of audioUrls) {
              await supabase.from('miro_wip_images').insert({
                shot_id: task.shot_id || null,
                asset_id: task.asset_id || null,
                task_id: taskId,
                department: task.department,
                miro_item_id: 'audio',
                uploaded_by: uploaderId,
                image_url: audioUrl,
                image_order: nextOrder++,
                img_width: 0,
                img_height: 0,
              })
            }
          } catch (err) {
            console.warn('Audio insert to storyboard failed for user', uploaderId, err)
          }
        }
      }
    }

    // 4. Notify all assignees
    for (const a of (task.assignees || [])) {
      await sendNotification(a.user.id, 'task_review', 'Task submitted for review', task.title, 'task', taskId)
    }

    setTasks(await getTasks({ project_id: currentProject?.id }))
    addToast('Task submitted for review!', 'success')
  }

  const handleUpdateReviewMeta = async (taskId, reviewTitle, reviewDescription) => {
    await updateReviewMeta(taskId, reviewTitle, reviewDescription)
    setTasks(await getTasks({ project_id: currentProject?.id }))
  }

  const handleAddComment = async (taskId, authorId, body) => {
    const result = await addComment(taskId, authorId, body)
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      for (const a of (task.assignees || [])) {
        if (a.user.id !== authorId) {
          await sendNotification(a.user.id, 'comment', 'New comment on your task', body.slice(0, 80), 'task', taskId)
        }
      }
      if (!isStaff(user)) {
        const staffMembers = profiles.filter(p => isStaff(p))
        for (const s of staffMembers) {
          if (s.id !== authorId) await sendNotification(s.id, 'comment', `Comment from ${user.full_name}`, body.slice(0, 80), 'task', taskId)
        }
      }
    }
    return result
  }

  const handleAddWipComment = async (wipUpdateId, taskId, authorId, body) => {
    const result = await addWipComment(wipUpdateId, authorId, body)
    // Notify all assignees (except the author of the comment)
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      for (const a of (task.assignees || [])) {
        if (a.user.id !== authorId) {
          await sendNotification(a.user.id, 'comment', 'New feedback on your WIP', body.slice(0, 80), 'task', taskId)
        }
      }
    }
    return result
  }

  // ── Project pause handlers ──
  const handleCreateProjectPause = async (start_date, end_date, label) => {
    if (!currentProject?.id) return
    const { error } = await createProjectPause({ project_id: currentProject.id, start_date, end_date, label: label || null })
    if (error) { addToast('Errore creazione pausa: ' + error.message, 'danger'); return }
    setProjectPauses(await getProjectPauses(currentProject.id))
  }
  const handleDeleteProjectPause = async (id) => {
    const { error } = await deleteProjectPause(id)
    if (error) { addToast('Errore eliminazione pausa', 'danger'); return }
    setProjectPauses(prev => prev.filter(p => p.id !== id))
  }

  // ── Gantt handlers ──
  const handleCreateGanttItem = async (payload) => {
    const { error } = await createGanttItem(payload)
    if (error) { addToast('Errore creazione: ' + error.message, 'danger'); return }
    setGanttItems(await getGanttItems(currentProject?.id))
  }
  const handleUpdateGanttItem = async (id, updates) => {
    // Optimistic update
    setGanttItems(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g))
    const { error } = await updateGanttItem(id, updates)
    if (error) { addToast('Errore salvataggio: ' + error.message, 'danger'); setGanttItems(await getGanttItems(currentProject?.id)) }
  }
  const handleDeleteGanttItem = async (id) => {
    const { error } = await deleteGanttItem(id)
    if (error) { addToast('Errore eliminazione', 'danger'); return }
    setGanttItems(await getGanttItems(currentProject?.id))
  }

  const handleUpdateProjectDates = async (start, end) => {
    if (!currentProject) return
    const { data, error } = await updateProject(currentProject.id, { start_date: start || null, end_date: end || null })
    if (error) { addToast('Errore: ' + error.message, 'danger'); return }
    setCurrentProject(prev => ({ ...prev, start_date: data?.start_date ?? start, end_date: data?.end_date ?? end }))
    setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, start_date: data?.start_date ?? start, end_date: data?.end_date ?? end } : p))
  }

  const handleCreateGanttLane = async (name) => {
    const trimmed = (name || '').trim()
    if (!trimmed) return
    const { error } = await createGanttLane({ project_id: currentProject.id, name: trimmed, sort_order: ganttLanes.length })
    if (error) { addToast(error.code === '23505' ? 'Lane già esistente' : 'Errore: ' + error.message, 'danger'); return }
    setGanttLanes(await getGanttLanes(currentProject?.id))
  }
  const handleUpdateGanttLane = async (id, updates) => {
    const { error } = await updateGanttLane(id, updates)
    if (error) { addToast('Errore: ' + error.message, 'danger'); return }
    setGanttLanes(await getGanttLanes(currentProject?.id))
  }
  const handleDeleteGanttLane = async (id) => {
    const lane = ganttLanes.find(l => l.id === id)
    const { error } = await deleteGanttLane(id)
    if (error) { addToast('Errore eliminazione', 'danger'); return }
    // Items keep the lane string but the row will disappear if empty;
    // if the lane still has items, surface them under "Senza lane".
    if (lane) {
      setGanttItems(prev => prev.map(it => it.lane === lane.name ? { ...it, lane: '' } : it))
      // Persist null on those items so the next reload is consistent.
      const orphans = ganttItems.filter(it => it.lane === lane.name)
      await Promise.all(orphans.map(it => updateGanttItem(it.id, { lane: '' })))
    }
    setGanttLanes(await getGanttLanes(currentProject?.id))
  }

  const handleCreateEvent = async (ev) => { await createCalendarEvent({ ...ev, project_id: currentProject.id }); setEvents(await getCalendarEvents(currentProject?.id)) }
  const handleDeleteEvent = async (id) => { await deleteCalendarEvent(id); setEvents(await getCalendarEvents(currentProject?.id)) }
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

  // Students with no projects see waiting screen
  if (user.role === 'studente' && projects.length === 0) {
    return <WaitingScreen user={user} onSignOut={signOut} />
  }

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

  const contentPadding = isMobile ? '16px 16px 65px' : '36px 44px'

  return (
    <div className={isMobile ? 'mobile-safe-top app-shell-mobile' : ''} style={{ display: 'flex', height: isMobile ? '100%' : '100vh', background: '#F0F2F5', overflow: 'hidden' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmDialog pending={pending} onConfirm={confirm} onCancel={cancel} />
      {currentSuperNotif && (
        <SuperNotifOverlay notification={currentSuperNotif} onDismiss={async () => {
          await markSuperNotificationSeen(currentSuperNotif.id)
          const remaining = superNotifs.filter(n => n.id !== currentSuperNotif.id)
          setSuperNotifs(remaining)
          setCurrentSuperNotif(remaining.length > 0 ? remaining[0] : null)
        }} />
      )}
      {isMobile && <InstallBanner />}
      <AdminEffects effects={adminFx} userId={user.id} matrixMode={matrixMode} onClear={clearAdminFx} />
      {adminConsoleOpen && hasPermission(user, 'access_admin_console') && (
        <AdminConsole user={user} profiles={profiles} channelRef={adminChRef} matrixMode={matrixMode} onMatrixToggle={() => setMatrixMode(p => !p)} onGameChallenge={handleGameChallenge} onClose={() => setAdminConsoleOpen(false)} isMobile={isMobile} />
      )}

      <Sidebar
        user={user} view={view} setView={setView} onSignOut={signOut}
        events={events} onCreateEvent={handleCreateEvent} onDeleteEvent={handleDeleteEvent}
        notifications={notifications} onMarkRead={handleMarkRead} onMarkAllRead={handleMarkAllRead} onNavigate={handleNavigate}
        requestConfirm={requestConfirm} unreadCount={unreadCount} tcgGameActive={tcgGameActive}
        reviewCount={tasks.filter(t => t.status === 'review').length}
        projects={projects} currentProject={currentProject} onSelectProject={handleSelectProject}
        myPerms={myPerms}
      />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Full-bleed views: storyboard, timeline, pack — no padding, no maxWidth */}
        {(view === 'storyboard' || view === 'timeline' || view === 'pack' || view === 'gantt' || view === 'review') ? (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', ...(isMobile ? { paddingBottom: 49 } : {}) }}>
            {view === 'storyboard' && <StoryboardPage shots={shots} assets={assets} tasks={tasks} profiles={profiles} user={user} currentProject={currentProject} addToast={addToast} />}
            {view === 'timeline' && hasPermission(user, 'access_timeline') && <TimelinePage shots={shots} user={user} onUpdateShot={handleUpdateShot} onUploadShotAudio={handleUploadShotAudio} onUploadOutput={handleUploadOutput} addToast={addToast} onGoToShotTasks={(shotId) => { setDeepLink({ type: 'shotFilter', id: shotId }); setView('tasks') }} />}
            {view === 'pack' && (hasPermission(user, 'manage_tcg') || tcgGameActive) && (
              <PackPage user={user} profiles={profiles} addToast={addToast} requestConfirm={requestConfirm} tcgGameActive={tcgGameActive} onGameStateChange={setTcgGameActive} onTradeInviteSent={handleTradeInviteSent} />
            )}
            {view === 'gantt' && (
              <GanttPage tasks={tasks} shots={shots} assets={assets} currentProject={currentProject} user={user}
                profiles={profiles}
                pauses={projectPauses}
                onCreatePause={handleCreateProjectPause}
                onDeletePause={handleDeleteProjectPause}
                onUpdateTask={handleUpdateTask}
                onUpdateProjectDates={handleUpdateProjectDates}
                onGoToTask={(taskId) => { setDeepLink({ type: 'tasks', id: taskId }); setView('tasks') }}
                onSetAssignees={handleSetTaskAssignees}
                onDeleteTask={handleDeleteTask}
                onRejectTask={handleRejectTask}
                onAddWipComment={handleAddWipComment}
                onCreateWipUpdate={handleCreateWipUpdate}
                onCommitForReview={handleCommitForReview}
                onMarkWipViewed={handleMarkWipViewed}
                wipViews={wipViews}
                requestConfirm={requestConfirm}
                addToast={addToast} />
            )}
            {view === 'review' && myPerms.can_review && (
              <ReviewPage shots={shots} assets={assets} tasks={tasks} profiles={profiles} user={user}
                currentProject={currentProject} ganttItems={ganttItems} ganttLanes={ganttLanes}
                onUpdateTask={handleUpdateTask} onRejectTask={handleRejectTask}
                addToast={addToast} requestConfirm={requestConfirm} />
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', ...(isMobile ? { overflowX: 'hidden' } : {}), width: '100%' }}>
          <div style={{ padding: contentPadding, ...(isMobile ? {} : { maxWidth: 1400 }), width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            {view === 'overview' && <OverviewPage shots={shots} assets={assets} tasks={tasks} profiles={profiles} user={user} currentProject={currentProject} />}
            {view === 'shots' && <ShotTrackerPage shots={shots} assets={assets} user={user} canEditShots={myPerms.can_manage_shots} onUpdateShot={handleUpdateShot} onReorderShots={handleReorderShots} onCreateShot={handleCreateShot} onDeleteShot={handleDeleteShot} onUploadReference={handleUploadReference} onUploadOutput={handleUploadOutput} onCreateAsset={handleCreateAsset} onUpdateAsset={handleUpdateAsset} onDeleteAsset={handleDeleteAsset} onReorderAssets={handleReorderAssets} onUploadAssetReference={handleUploadAssetReference} onUploadAssetOutput={handleUploadAssetOutput} addToast={addToast} requestConfirm={requestConfirm} onGoToShotTasks={(shotId) => { setDeepLink({ type: 'shotFilter', id: shotId }); setView('tasks') }} onGoToAssetTasks={(assetId) => { setDeepLink({ type: 'assetFilter', id: assetId }); setView('tasks') }} />}
            {view === 'tasks' && <TasksPage tasks={tasks} shots={shots} assets={assets} profiles={profiles} user={user} currentProject={currentProject} onCreateTask={handleCreateTask} onUpdateTask={handleUpdateTask} onReorderTasks={handleReorderTasks} onSetAssignees={handleSetTaskAssignees} onDeleteTask={handleDeleteTask} onRejectTask={handleRejectTask} onAddWipComment={handleAddWipComment} onCreateWipUpdate={handleCreateWipUpdate} onMarkWipViewed={handleMarkWipViewed} onCommitForReview={handleCommitForReview} wipViews={wipViews} addToast={addToast} requestConfirm={requestConfirm} deepLink={deepLink} clearDeepLink={clearDeepLink} />}
            {view === 'crew' && <CrewPage profiles={profiles} user={user} currentProject={currentProject} />}
            {view === 'profile' && <ProfilePage user={user} onProfileUpdate={handleProfileUpdate} addToast={addToast} />}
            {view === 'activity' && hasPermission(user, 'access_activity') && <ActivityTrackerPage tasks={tasks} profiles={profiles} user={user} onNavigate={handleNavigate} currentProject={currentProject} />}
            {view === 'projects' && (hasPermission(user, 'manage_project_settings') || hasPermission(user, 'manage_roles') || myPerms.can_manage_project || hasPermission(user, 'create_projects')) && <ProjectManagementPage user={user} profiles={profiles} projects={projects} myPerms={myPerms} onRefreshProjects={refreshProjects} onRefreshProfiles={async () => { const p = await getAllProfiles(); setProfiles(p) }} addToast={addToast} requestConfirm={requestConfirm} />}
            {view === 'notifications' && renderMobileNotifications()}
          </div>
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

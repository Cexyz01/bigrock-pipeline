import { useState, useEffect, useRef, useCallback } from 'react'
import { isStaff } from './lib/constants'
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
} from './lib/supabase'

import Sidebar from './components/layout/Sidebar'
import ChatPanel from './components/layout/ChatPanel'
import ToastContainer, { useToast } from './components/ui/Toast'
import ConfirmDialog, { useConfirm } from './components/ui/ConfirmDialog'

import LoginPage from './components/pages/LoginPage'
import OverviewPage from './components/pages/OverviewPage'
import ShotTrackerPage from './components/pages/ShotTrackerPage'
import TasksPage from './components/pages/TasksPage'
import StoryboardPage from './components/pages/StoryboardPage'
import CrewPage from './components/pages/CrewPage'
import ProfilePage from './components/pages/ProfilePage'
import ActivityTrackerPage from './components/pages/ActivityTrackerPage'

export default function App() {
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
  const dmToastedRef = useRef(new Set())
  const chatOpenRef = useRef(false)
  const { toasts, addToast, removeToast } = useToast()
  const { pending, requestConfirm, confirm, cancel } = useConfirm()

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
    setUser(profile)
    setLoading(false)
    if (profile) loadData(authUser.id)
  }

  const loadData = async (userId) => {
    const [p, sh, t, ev, n, dmUn] = await Promise.all([
      getAllProfiles(), getShots(), getTasks(), getCalendarEvents(), getNotifications(userId), getDMUnreadCount(userId),
    ])
    setProfiles(p); setShots(sh); setTasks(t); setEvents(ev); setNotifications(n); setDmUnreadCount(dmUn)
  }

  const refreshDmUnread = useCallback(() => {
    if (user) getDMUnreadCount(user.id).then(setDmUnreadCount)
  }, [user])

  // Keep chatOpenRef in sync so realtime callback can read it without re-subscribing
  useEffect(() => { chatOpenRef.current = chatOpen }, [chatOpen])

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
            const name = sender?.full_name || 'Qualcuno'
            addToast(`Nuovo messaggio da ${name}`, 'info', {
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

  const handleNavigate = (targetView, targetId) => {
    setView(targetView)
    if (targetId) setDeepLink({ type: targetView, id: targetId })
  }
  const clearDeepLink = () => setDeepLink(null)

  // Handlers
  const handleCreateShot = async (shot) => { await createShot(shot); setShots(await getShots()) }
  const handleUpdateShot = async (id, updates) => {
    // Optimistic: update UI instantly, then persist in background
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    const { error } = await updateShot(id, updates)
    if (error) setShots(await getShots()) // revert on failure
  }
  const handleDeleteShot = async (id) => { await deleteShot(id); setShots(await getShots()) }

  const handleCreateTask = async (task) => {
    const { data } = await createTask(task)
    if (data && task.assigned_to) {
      await sendNotification(task.assigned_to, 'task_assigned', 'Nuovo task assegnato', task.title, 'task', data.id)
    }
    setTasks(await getTasks())
  }

  const handleUpdateTask = async (id, updates) => {
    await updateTask(id, updates)
    const task = tasks.find(t => t.id === id)
    if (updates.status === 'review' && task?.assigned_to) {
      const staffMembers = profiles.filter(p => isStaff(p.role))
      for (const s of staffMembers) {
        await sendNotification(s.id, 'task_review', 'Task inviato per review', task.title, 'task', id)
      }
    }
    if (updates.status === 'approved' && task?.assigned_to) {
      await sendNotification(task.assigned_to, 'task_approved', 'Task approvato!', task.title, 'task', id)
    }
    if (updates.status === 'wip' && task?.status === 'review' && task?.assigned_to) {
      await sendNotification(task.assigned_to, 'task_revision', 'Modifiche richieste', task.title, 'task', id)
    }
    setTasks(await getTasks())
  }

  const handleDeleteTask = async (id) => { await deleteTask(id); setTasks(await getTasks()) }

  const handleAddComment = async (taskId, authorId, body) => {
    const result = await addComment(taskId, authorId, body)
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      if (authorId !== task.assigned_to && task.assigned_to) {
        await sendNotification(task.assigned_to, 'comment', 'Nuovo commento sul tuo task', body.slice(0, 80), 'task', taskId)
      }
      if (!isStaff(user.role)) {
        const staffMembers = profiles.filter(p => isStaff(p.role))
        for (const s of staffMembers) {
          if (s.id !== authorId) await sendNotification(s.id, 'comment', `Commento da ${user.full_name}`, body.slice(0, 80), 'task', taskId)
        }
      }
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: '#fff', animation: 'pulse 1.5s ease infinite',
        }}>BR</div>
        <div style={{ color: '#94A3B8', fontSize: 13 }}>Caricamento...</div>
      </div>
    </div>
  )
  if (!session || !user) return <LoginPage />

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F0F2F5' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmDialog pending={pending} onConfirm={confirm} onCancel={cancel} />

      <Sidebar
        user={user} view={view} setView={setView} onSignOut={signOut}
        events={events} onCreateEvent={handleCreateEvent} onDeleteEvent={handleDeleteEvent}
        notifications={notifications} onMarkRead={handleMarkRead} onMarkAllRead={handleMarkAllRead} onNavigate={handleNavigate}
        requestConfirm={requestConfirm} unreadCount={unreadCount}
      />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Storyboard gets full bleed — no padding, no maxWidth */}
        {view === 'storyboard' ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <StoryboardPage />
          </div>
        ) : (
          <div style={{ flex: 1, padding: '36px 44px', overflowY: 'auto', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
            {view === 'overview' && <OverviewPage shots={shots} tasks={tasks} profiles={profiles} user={user} />}
            {view === 'shots' && <ShotTrackerPage shots={shots} user={user} onUpdateShot={handleUpdateShot} onCreateShot={handleCreateShot} onDeleteShot={handleDeleteShot} requestConfirm={requestConfirm} />}
            {view === 'tasks' && <TasksPage tasks={tasks} shots={shots} profiles={profiles} user={user} onCreateTask={handleCreateTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onAddComment={handleAddComment} addToast={addToast} requestConfirm={requestConfirm} deepLink={deepLink} clearDeepLink={clearDeepLink} />}
            {view === 'crew' && <CrewPage profiles={profiles} user={user} />}
            {view === 'profile' && <ProfilePage user={user} onProfileUpdate={handleProfileUpdate} addToast={addToast} />}
            {view === 'activity' && isStaff(user.role) && <ActivityTrackerPage tasks={tasks} profiles={profiles} onNavigate={handleNavigate} />}
          </div>
        )}
      </div>

      <ChatPanel user={user} open={chatOpen} onToggle={() => setChatOpen(!chatOpen)} profiles={profiles} dmUnreadCount={dmUnreadCount} onDmRead={refreshDmUnread} />
    </div>
  )
}

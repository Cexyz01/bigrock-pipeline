import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function useAdminChannel(enabled) {
  const [broadcastMessage, setBroadcastMessage] = useState(null)
  const [matrixActive, setMatrixActive] = useState(false)
  const [banInfo, setBanInfo] = useState(null)
  const channelRef = useRef(null)
  const broadcastTimerRef = useRef(null)
  const banTimerRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const channel = supabase.channel('admin-commands')
    channelRef.current = channel

    channel.on('broadcast', { event: 'admin-cmd' }, ({ payload }) => {
      if (!payload) return

      switch (payload.type) {
        case 'broadcast_message':
          setBroadcastMessage(payload.message)
          break
        case 'matrix_toggle':
          setMatrixActive(prev => !prev)
          break
        case 'ban_user':
          setBanInfo({
            target: payload.target,
            email: payload.email,
            seconds: payload.seconds,
          })
          break
      }
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [enabled])

  // Auto-dismiss broadcast after 5s
  useEffect(() => {
    if (!broadcastMessage) return
    clearTimeout(broadcastTimerRef.current)
    broadcastTimerRef.current = setTimeout(() => setBroadcastMessage(null), 5500)
    return () => clearTimeout(broadcastTimerRef.current)
  }, [broadcastMessage])

  // Auto-expire ban
  useEffect(() => {
    if (!banInfo) return
    clearTimeout(banTimerRef.current)
    banTimerRef.current = setTimeout(() => setBanInfo(null), banInfo.seconds * 1000 + 500)
    return () => clearTimeout(banTimerRef.current)
  }, [banInfo])

  const dismissBroadcast = useCallback(() => {
    setBroadcastMessage(null)
    clearTimeout(broadcastTimerRef.current)
  }, [])

  const sendCommand = useCallback((type, payload) => {
    if (!channelRef.current) return
    channelRef.current.send({
      type: 'broadcast',
      event: 'admin-cmd',
      payload: { type, ...payload },
    })
  }, [])

  return {
    broadcastMessage,
    dismissBroadcast,
    matrixActive,
    banInfo,
    sendCommand,
  }
}

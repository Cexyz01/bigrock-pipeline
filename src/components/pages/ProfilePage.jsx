import { useState, useRef } from 'react'
import { MOOD_EMOJIS } from '../../lib/constants'
import { uploadAvatar, updateProfile } from '../../lib/supabase'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Btn from '../ui/Btn'
import HangingIDCard from '../profile/HangingIDCard'

export default function ProfilePage({ user, onProfileUpdate, addToast }) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      addToast('Image too large (max 1MB)', 'error')
      return
    }
    setUploading(true)
    const { url, error } = await uploadAvatar(user.id, file)
    if (!error && url) {
      await updateProfile(user.id, { avatar_url: url })
      onProfileUpdate({ ...user, avatar_url: url })
      addToast('Avatar updated!', 'success')
    } else {
      addToast('Upload error', 'error')
    }
    setUploading(false)
  }

  // #6: Delete avatar
  const handleDeleteAvatar = async () => {
    setDeleting(true)
    await updateProfile(user.id, { avatar_url: null })
    onProfileUpdate({ ...user, avatar_url: null })
    addToast('Avatar removed', 'success')
    setDeleting(false)
  }

  const handleMood = async (emoji) => {
    const newMood = user.mood_emoji === emoji ? null : emoji
    await updateProfile(user.id, { mood_emoji: newMood })
    onProfileUpdate({ ...user, mood_emoji: newMood })
    addToast(newMood ? `Mood: ${newMood}` : 'Mood removed', 'success')
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Fade>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a', textAlign: 'center' }}>Profile</h1>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16, textAlign: 'center' }}>Trascina il tesserino o cambia il tuo avatar</p>
      </Fade>

      <Fade delay={50}>
        <HangingIDCard user={user} />
      </Fade>

      <Fade delay={120}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 4, marginBottom: 28, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={() => fileRef.current?.click()} loading={uploading}
            style={{ padding: '8px 18px', fontSize: 12 }}>
            Cambia Avatar
          </Btn>
          {user.avatar_url && (
            <Btn variant="danger" onClick={handleDeleteAvatar} loading={deleting}
              style={{ padding: '8px 18px', fontSize: 12 }}>
              Rimuovi avatar
            </Btn>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: -20, marginBottom: 24 }}>Max 1MB</div>
      </Fade>

      <Fade delay={200}>
        <Card>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#1a1a1a' }}>Mood del giorno</div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>Scegli un emoji che ti rappresenta oggi — apparirà sull'avatar</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {MOOD_EMOJIS.map(e => (
              <button key={e} onClick={() => handleMood(e)}
                style={{
                  width: 42, height: 42, borderRadius: 12, fontSize: 20,
                  background: user.mood_emoji === e ? 'rgba(242,140,40,0.08)' : '#F8FAFC',
                  border: user.mood_emoji === e ? '2px solid #F28C28' : '1px solid #E2E8F0',
                  cursor: 'pointer', transition: 'all 0.12s ease',
                  transform: user.mood_emoji === e ? 'scale(1.1)' : 'none',
                }}>{e}</button>
            ))}
          </div>
        </Card>
      </Fade>
    </div>
  )
}

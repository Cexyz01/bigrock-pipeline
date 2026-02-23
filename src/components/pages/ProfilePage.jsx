import { useState, useRef } from 'react'
import { DEPTS, MOOD_EMOJIS, isStaff } from '../../lib/constants'
import { uploadAvatar, updateProfile } from '../../lib/supabase'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Av from '../ui/Av'
import Btn from '../ui/Btn'

export default function ProfilePage({ user, onProfileUpdate, addToast }) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef(null)

  const staff = isStaff(user.role)
  const dept = DEPTS.find(d => d.id === user.department)

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      addToast('Immagine troppo grande (max 1MB)', 'error')
      return
    }
    setUploading(true)
    const { url, error } = await uploadAvatar(user.id, file)
    if (!error && url) {
      await updateProfile(user.id, { avatar_url: url })
      onProfileUpdate({ ...user, avatar_url: url })
      addToast('Avatar aggiornato!', 'success')
    } else {
      addToast('Errore nel caricamento', 'error')
    }
    setUploading(false)
  }

  // #6: Delete avatar
  const handleDeleteAvatar = async () => {
    setDeleting(true)
    await updateProfile(user.id, { avatar_url: null })
    onProfileUpdate({ ...user, avatar_url: null })
    addToast('Avatar rimosso', 'success')
    setDeleting(false)
  }

  const handleMood = async (emoji) => {
    const newMood = user.mood_emoji === emoji ? null : emoji
    await updateProfile(user.id, { mood_emoji: newMood })
    onProfileUpdate({ ...user, mood_emoji: newMood })
    addToast(newMood ? `Mood: ${newMood}` : 'Mood rimosso', 'success')
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <Fade>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px', color: '#f0f0f5' }}>👤 Profilo</h1>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 28 }}>Personalizza il tuo profilo</p>
      </Fade>

      <Fade delay={100}>
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <div style={{ position: 'relative' }}>
              <Av name={user.full_name} size={80} url={user.avatar_url} mood={user.mood_emoji} />
              <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#f0f0f5' }}>{user.full_name}</div>
              <div style={{ fontSize: 13, color: '#888' }}>{user.email}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Btn variant="primary" onClick={() => fileRef.current?.click()} loading={uploading}
                  style={{ padding: '6px 14px', fontSize: 12 }}>
                  Cambia Avatar
                </Btn>
                {/* #6: Delete avatar button */}
                {user.avatar_url && (
                  <Btn variant="danger" onClick={handleDeleteAvatar} loading={deleting}
                    style={{ padding: '6px 14px', fontSize: 12 }}>
                    Rimuovi
                  </Btn>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>Max 1MB</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <InfoField label="Ruolo" value={user.role} />
            {/* #7: Staff don't show department */}
            {!staff && <InfoField label="Dipartimento" value={dept ? `${dept.icon} ${dept.label}` : 'Non assegnato'} />}
            <InfoField label="Email" value={user.email} />
            <InfoField label="Membro dal" value={user.created_at ? new Date(user.created_at).toLocaleDateString('it') : '-'} />
          </div>
        </Card>
      </Fade>

      <Fade delay={200}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#f0f0f5' }}>Mood del Giorno</div>
          <div style={{ fontSize: 12, color: '#777', marginBottom: 16 }}>Scegli un emoji che rappresenta come ti senti oggi</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MOOD_EMOJIS.map(e => (
              <button key={e} onClick={() => handleMood(e)}
                style={{
                  width: 44, height: 44, borderRadius: 14, fontSize: 22,
                  background: user.mood_emoji === e ? 'rgba(205,255,0,0.15)' : '#141420',
                  border: user.mood_emoji === e ? '2px solid #CDFF00' : '1px solid #1e1e2e',
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

function InfoField({ label, value }) {
  return (
    <div style={{ padding: '10px 14px', background: '#1a1a2a', borderRadius: 14 }}>
      <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f5' }}>{value}</div>
    </div>
  )
}

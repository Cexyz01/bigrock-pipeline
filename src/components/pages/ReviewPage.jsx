import { useState, useEffect } from 'react'
import { DEPTS, SHOT_STATUSES, isStaff } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import { getWipUpdates, getProjectStartDate, getProjectEndDate } from '../../lib/supabase'
import { jsPDF } from 'jspdf'
import Fade from '../ui/Fade'
import Btn from '../ui/Btn'
import Av from '../ui/Av'
import StatusBadge from '../ui/StatusBadge'
import EmptyState from '../ui/EmptyState'
import ImageLightbox from '../ui/ImageLightbox'
import { IconEdit, IconCheck, IconX, IconEye } from '../ui/Icons'

export default function ReviewPage({ shots, tasks, profiles, user, onUpdateTask, onUpdateReviewMeta, addToast }) {
  const isMobile = useIsMobile()
  const reviewTasks = tasks.filter(t => t.status === 'review')
  const [wipCache, setWipCache] = useState({}) // taskId -> latest WIP images
  const [editing, setEditing] = useState(null) // taskId being edited
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [generating, setGenerating] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  // Load latest WIP images for all review tasks
  useEffect(() => {
    reviewTasks.forEach(t => {
      if (!wipCache[t.id]) {
        getWipUpdates(t.id).then(updates => {
          const latest = updates.find(u => u.images && u.images.length > 0)
          if (latest) {
            setWipCache(prev => ({ ...prev, [t.id]: latest.images }))
          }
        })
      }
    })
  }, [reviewTasks.length])

  const startEdit = (task) => {
    setEditing(task.id)
    setEditTitle(task.review_title || task.title)
    setEditDesc(task.review_description || task.description || '')
  }

  const saveEdit = async () => {
    if (!editing) return
    await onUpdateReviewMeta(editing, editTitle, editDesc)
    setEditing(null)
    if (addToast) addToast('Metadata updated', 'success')
  }

  const cancelEdit = () => {
    setEditing(null)
  }

  // ── PDF Presentation Generator ──
  const generatePresentation = async () => {
    setGenerating(true)
    if (addToast) addToast('Downloading images and generating PDF...', 'info')

    try {
      // Gather slide data
      const slides = reviewTasks.map(t => {
        const dept = DEPTS.find(d => d.id === t.department)
        const student = profiles.find(p => p.id === t.assigned_to)
        const images = wipCache[t.id] || []
        return {
          title: t.review_title || t.title,
          description: t.review_description || t.description || '',
          department: dept?.label || '',
          deptColor: dept?.color || '#F28C28',
          student: student?.full_name || 'Unassigned',
          images,
        }
      })

      // Pre-fetch all images as base64 for offline PDF
      const imageCache = {}
      const allUrls = slides.flatMap(s => s.images)
      await Promise.all(allUrls.map(async (url) => {
        try {
          const res = await fetch(url)
          const blob = await res.blob()
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          imageCache[url] = dataUrl
        } catch (e) {
          console.warn('Failed to fetch image:', url, e)
        }
      }))

      // Create PDF — landscape 16:9 (338.67mm x 190.5mm ≈ 1280x720pt)
      const W = 338.67
      const H = 190.5
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [H, W] })

      // ── Layout constants ──
      const MX = 18  // horizontal margin
      const MY = 14  // top margin
      const GAP = 5  // gap between images

      // ── Title page with project stats ──
      pdf.setFillColor(15, 23, 42) // #0F172A
      pdf.rect(0, 0, W, H, 'F')

      // Title section (top third)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(42)
      pdf.setTextColor(248, 250, 252)
      pdf.text('BIGROCK', W / 2, 36, { align: 'center' })
      pdf.setFontSize(16)
      pdf.setTextColor(148, 163, 184)
      pdf.text('Review Presentation', W / 2, 48, { align: 'center' })
      pdf.setFontSize(11)
      pdf.setTextColor(100, 116, 139)
      pdf.text(new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), W / 2, 57, { align: 'center' })

      // Divider line
      pdf.setDrawColor(51, 65, 85)
      pdf.setLineWidth(0.3)
      pdf.line(MX + 30, 65, W - MX - 30, 65)

      // ── Stats section — same as Overview page ──
      const totalSlots = shots.length * DEPTS.length
      const doneSlots = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === 'approved').length, 0)
      const wipSlots = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === 'in_progress').length, 0)
      const reviewSlots = tasks.filter(t => t.status === 'review').length
      const pipelinePct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0

      // 4 stat cards — matching Overview
      const statsY = 74
      const cardW = (W - 2 * MX - 3 * 8) / 4
      const cardH = 36
      const statsData = [
        { value: shots.length, label: 'Shots', color: '#1a1a1a' },
        { value: doneSlots, label: 'Completed', color: '#10B981' },
        { value: wipSlots, label: 'In Progress', color: '#2563EB' },
        { value: reviewSlots, label: 'To Review', color: '#F28C28' },
      ]

      statsData.forEach((stat, idx) => {
        const x = MX + idx * (cardW + 8)
        const c = hexToRgb(stat.color)
        // Card background
        pdf.setFillColor(30, 41, 59)
        pdf.roundedRect(x, statsY, cardW, cardH, 3, 3, 'F')
        // Left color accent bar
        pdf.setFillColor(c.r, c.g, c.b)
        pdf.roundedRect(x, statsY, 3, cardH, 3, 3, 'F')
        pdf.rect(x + 1.5, statsY, 1.5, cardH, 'F')
        // Label
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(148, 163, 184)
        pdf.text(stat.label, x + 14, statsY + 12)
        // Value
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(22)
        pdf.setTextColor(c.r, c.g, c.b)
        pdf.text(String(stat.value), x + 14, statsY + 28)
      })

      // ── Pipeline Progress bar ──
      const barY = statsY + cardH + 14
      const barW = W - 2 * MX

      // Header: "Pipeline Progress" + percentage
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(248, 250, 252)
      pdf.text('Pipeline Progress', MX, barY)
      pdf.setFontSize(14)
      pdf.setTextColor(242, 140, 40)
      pdf.text(`${pipelinePct}%`, MX + barW, barY, { align: 'right' })

      // Progress bar track
      const barTrackY = barY + 5
      const barTrackH = 7
      pdf.setFillColor(30, 41, 59)
      pdf.roundedRect(MX, barTrackY, barW, barTrackH, 2, 2, 'F')
      // Filled portion — accent orange
      if (pipelinePct > 0) {
        pdf.setFillColor(242, 140, 40)
        pdf.roundedRect(MX, barTrackY, Math.max(barW * (pipelinePct / 100), 3), barTrackH, 2, 2, 'F')
      }

      // Status breakdown row (To Do, WIP, Review, Fix, Done)
      const statusRowY = barTrackY + barTrackH + 7
      const statusCounts = SHOT_STATUSES.map(st => ({
        ...st,
        count: shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === st.id).length, 0),
      }))

      let statusX = MX
      statusCounts.forEach((st) => {
        const c = hexToRgb(st.color)
        // Dot
        pdf.setFillColor(c.r, c.g, c.b)
        pdf.circle(statusX + 3, statusRowY, 2, 'F')
        // Label
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(148, 163, 184)
        pdf.text(st.label, statusX + 8, statusRowY + 1.5)
        // Count
        const labelW = pdf.getTextWidth(st.label)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(c.r, c.g, c.b)
        pdf.text(String(st.count), statusX + 8 + labelW + 3, statusRowY + 1.5)
        const countW = pdf.getTextWidth(String(st.count))
        statusX += 8 + labelW + 3 + countW + 14
      })

      // ── Thesis timeline ──
      const tlY = statusRowY + 16
      const tlW = W - 2 * MX
      // Fetch project dates from DB
      const startDateStr = await getProjectStartDate()
      const endDateStr = await getProjectEndDate()
      const thesisStart = startDateStr ? new Date(startDateStr) : null
      const thesisEnd = endDateStr ? new Date(endDateStr) : null

      if (thesisStart && thesisEnd && thesisEnd > thesisStart) {
        const now = new Date()
        const totalMs = thesisEnd - thesisStart
        const elapsedMs = Math.max(0, Math.min(now - thesisStart, totalMs))
        const timelinePct = Math.round((elapsedMs / totalMs) * 100)

        // Label
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.setTextColor(148, 163, 184)
        pdf.text('THESIS TIMELINE', MX, tlY)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(100, 116, 139)
        pdf.text(`${timelinePct}% of time elapsed`, MX + tlW, tlY, { align: 'right' })

        // Track
        const trackY = tlY + 5
        const trackH = 6
        pdf.setFillColor(30, 41, 59)
        pdf.roundedRect(MX, trackY, tlW, trackH, 2, 2, 'F')
        // Elapsed fill — green
        const tlColor = [5, 150, 105]
        if (timelinePct > 0) {
          pdf.setFillColor(tlColor[0], tlColor[1], tlColor[2])
          pdf.roundedRect(MX, trackY, Math.max(tlW * (timelinePct / 100), 3), trackH, 2, 2, 'F')
        }
        // "Now" marker dot
        const nowX = MX + tlW * (timelinePct / 100)
        pdf.setFillColor(255, 255, 255)
        pdf.circle(Math.min(nowX, MX + tlW - 2), trackY + trackH / 2, 2.5, 'F')
        pdf.setFillColor(tlColor[0], tlColor[1], tlColor[2])
        pdf.circle(Math.min(nowX, MX + tlW - 2), trackY + trackH / 2, 1.5, 'F')

        // Start / Now / End labels
        const labelY = trackY + trackH + 5
        const startLabel = thesisStart.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
        const endLabel = thesisEnd.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
        const nowLabel = now.toLocaleDateString('en', { day: 'numeric', month: 'short' })
        pdf.setFontSize(7)
        pdf.setTextColor(100, 116, 139)
        pdf.text(startLabel, MX, labelY)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(tlColor[0], tlColor[1], tlColor[2])
        pdf.text(nowLabel, Math.min(Math.max(nowX, MX + 18), MX + tlW - 18), labelY, { align: 'center' })
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(100, 116, 139)
        pdf.text(endLabel, MX + tlW, labelY, { align: 'right' })
      }

      // ── Slide pages ──
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i]
        pdf.addPage([H, W], 'landscape')

        // Background
        pdf.setFillColor(15, 23, 42)
        pdf.rect(0, 0, W, H, 'F')

        let curY = MY

        // ── Header row: dept badge + student + counter ──
        // Dept badge — set font FIRST so getTextWidth is accurate
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        const deptText = s.department.toUpperCase()
        const badgeW = pdf.getTextWidth(deptText) + 18
        const col = hexToRgb(s.deptColor)
        pdf.setFillColor(col.r, col.g, col.b)
        pdf.roundedRect(MX, curY, badgeW, 8, 2, 2, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.text(deptText, MX + badgeW / 2, curY + 5.5, { align: 'center' })

        // Student name (right)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(11)
        pdf.setTextColor(148, 163, 184)
        pdf.text(s.student, W - MX, curY + 5.5, { align: 'right' })

        // Counter
        pdf.setFontSize(9)
        pdf.setTextColor(71, 85, 105)
        pdf.text(`${i + 1} / ${slides.length}`, W - MX, H - 8, { align: 'right' })

        // BIGROCK logo
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.setTextColor(51, 65, 85)
        pdf.text('BIGROCK', MX, H - 8)

        curY += 14

        // ── Title ──
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(24)
        pdf.setTextColor(248, 250, 252)
        const titleLines = pdf.splitTextToSize(s.title, W - 2 * MX)
        pdf.text(titleLines.slice(0, 2), MX, curY + 7)
        curY += titleLines.slice(0, 2).length * 10

        // ── Description ──
        if (s.description) {
          curY += 3
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(11)
          pdf.setTextColor(148, 163, 184)
          const descLines = pdf.splitTextToSize(s.description, W - 2 * MX)
          pdf.text(descLines.slice(0, 3), MX, curY + 4)
          curY += Math.min(descLines.length, 3) * 5 + 2
        }

        curY += 6

        // ── Images — always in a single row, max 4 ──
        const imgs = s.images.slice(0, 4)
        if (imgs.length > 0) {
          const availW = W - 2 * MX
          const availH = H - curY - 12 // leave 12mm bottom margin
          const imgW = (availW - (imgs.length - 1) * GAP) / imgs.length
          const imgH = availH

          for (let j = 0; j < imgs.length; j++) {
            const dataUrl = imageCache[imgs[j]]
            if (!dataUrl) continue

            const x = MX + j * (imgW + GAP)
            const y = curY

            // Dark background for image slot
            pdf.setFillColor(30, 41, 59) // #1E293B
            pdf.roundedRect(x, y, imgW, imgH, 3, 3, 'F')

            try {
              // Load image to get natural dimensions
              const dim = await getImageDimensions(dataUrl)
              // Fit image within slot keeping aspect ratio
              const scale = Math.min(imgW / dim.w, imgH / dim.h)
              const drawW = dim.w * scale
              const drawH = dim.h * scale
              const drawX = x + (imgW - drawW) / 2
              const drawY = y + (imgH - drawH) / 2

              pdf.addImage(dataUrl, 'JPEG', drawX, drawY, drawW, drawH)
            } catch (e) {
              // Image failed, show placeholder
              pdf.setFontSize(9)
              pdf.setTextColor(100, 116, 139)
              pdf.text('Image\nnot available', x + imgW / 2, y + imgH / 2, { align: 'center' })
            }
          }
        } else {
          // No images placeholder
          pdf.setFontSize(13)
          pdf.setTextColor(71, 85, 105)
          pdf.text('No WIP images', W / 2, curY + 30, { align: 'center' })
        }
      }

      // Save
      const fileName = `BigRock_Review_${new Date().toLocaleDateString('en').replace(/\//g, '-')}.pdf`
      pdf.save(fileName)
      if (addToast) addToast('PDF generated!', 'success')
    } catch (e) {
      console.error('PDF generation error:', e)
      if (addToast) addToast('Error generating PDF: ' + e.message, 'danger')
    }

    setGenerating(false)
  }

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Review</h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>
              {reviewTasks.length} tasks in review
            </p>
          </div>
          {reviewTasks.length > 0 && (
            <Btn variant="primary" loading={generating} onClick={generatePresentation}>
              Generate PDF
            </Btn>
          )}
        </div>
      </Fade>

      {reviewTasks.length === 0 ? (
        <EmptyState icon={<IconEye size={48} color="#94A3B8" />} title="No tasks in review" sub="Tasks submitted for review will appear here" />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: isMobile ? 12 : 20,
        }}>
          {reviewTasks.map((task, i) => {
            const dept = DEPTS.find(d => d.id === task.department)
            const student = profiles.find(p => p.id === task.assigned_to)
            const images = wipCache[task.id] || []
            const isEditing = editing === task.id

            return (
              <Fade key={task.id} delay={Math.min(i * 30, 300)}>
                <div style={{
                  background: '#fff', borderRadius: 16,
                  border: '1px solid #E8ECF1',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s ease',
                  boxShadow: isEditing ? '0 8px 32px rgba(242,140,40,0.12)' : 'none',
                }}>
                  {/* Image preview */}
                  {images.length > 0 ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: images.length === 1 ? '1fr' : images.length === 2 ? '1fr 1fr' : images.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr',
                      gap: 2,
                      height: 180,
                    }}>
                      {images.slice(0, 4).map((img, imgIdx) => (
                        <div key={imgIdx} onClick={() => setLightboxUrl(img)} style={{ overflow: 'hidden', cursor: 'pointer' }}>
                          <img
                            src={img}
                            alt={`Review ${imgIdx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      height: 100, background: '#F8FAFC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#B0B8C4', fontSize: 13,
                    }}>No WIP images</div>
                  )}

                  {/* Card body */}
                  <div style={{ padding: 20 }}>
                    {/* Header: dept badge + student */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: dept?.color || '#F28C28',
                        background: `${dept?.color || '#F28C28'}15`, padding: '3px 10px',
                        borderRadius: 6,
                      }}>{dept?.label || ''}</span>
                      {student && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                          <Av name={student.full_name} size={22} url={student.avatar_url} />
                          <span style={{ fontSize: 12, color: '#64748B' }}>{student.full_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Title + Description — editable */}
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          placeholder="Presentation title..."
                          style={{
                            fontSize: 16, fontWeight: 700, color: '#1a1a1a',
                            border: '1px solid #E2E8F0', borderRadius: 10,
                            padding: '10px 14px', outline: 'none',
                          }}
                          onFocus={e => e.target.style.borderColor = '#F28C28'}
                          onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                          autoFocus
                        />
                        <textarea
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          placeholder="Presentation description..."
                          rows={3}
                          style={{
                            fontSize: 13, color: '#475569', lineHeight: 1.6,
                            border: '1px solid #E2E8F0', borderRadius: 10,
                            padding: '10px 14px', outline: 'none', resize: 'vertical',
                            fontFamily: 'inherit',
                          }}
                          onFocus={e => e.target.style.borderColor = '#F28C28'}
                          onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Btn variant="primary" onClick={saveEdit} style={{ flex: 1, justifyContent: 'center' }}>
                            <IconCheck size={14} /> Save
                          </Btn>
                          <Btn onClick={cancelEdit} style={{ justifyContent: 'center' }}>
                            <IconX size={14} /> Cancel
                          </Btn>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3 style={{
                            fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0, flex: 1,
                          }}>{task.review_title || task.title}</h3>
                          <button
                            onClick={() => startEdit(task)}
                            style={{
                              background: '#F1F5F9', border: 'none', borderRadius: 8,
                              width: 32, height: 32, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#64748B', transition: 'all 0.15s ease',
                              flexShrink: 0,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#F28C28' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B' }}
                            title="Edit for presentation"
                          >
                            <IconEdit size={14} />
                          </button>
                        </div>
                        {(task.review_description || task.description) && (
                          <p style={{
                            fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '8px 0 0',
                            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                          }}>{task.review_description || task.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Fade>
            )
          })}
        </div>
      )}

      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  )
}

// ── Helpers ──

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}

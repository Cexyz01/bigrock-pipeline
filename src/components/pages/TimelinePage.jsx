import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ACCENT, DEFAULT_FPS, DEFAULT_DURATION_FRAMES, isAudioUrl, isVideoUrl } from '../../lib/constants'
import { IconTimeline, IconX } from '../ui/Icons'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

// ── Helpers ──
const fmt = (sec) => {
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(1)
  return `${m}:${s.padStart(4, '0')}`
}

const thumbUrl = (url, w = 1280, h = 720) => {
  if (!url) return null
  if (url.includes('/upload/')) return url.replace('/upload/', `/upload/c_fill,w_${w},h_${h},q_auto,f_auto/`)
  return url
}

const smallThumb = (url) => thumbUrl(url, 200, 112)

// For video files, get a poster/thumbnail from Cloudinary (first frame as jpg)
const videoThumb = (url, w = 200, h = 112) => {
  if (!url) return null
  if (url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/c_fill,w_${w},h_${h},q_auto,f_jpg,so_0/`)
  }
  return null
}

// Serve video at 720p via Cloudinary transform
const video720p = (url) => {
  if (!url) return null
  if (url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/c_limit,h_720,q_auto/')
  }
  return url
}

// ── Main Component ──
export default function TimelinePage({ shots, user, onUpdateShot, onUploadShotAudio, onUploadOutput, addToast, onGoToShotTasks }) {
  const [fps, setFps] = useState(DEFAULT_FPS)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(false)
  const [selectedShotId, setSelectedShotId] = useState(null)
  const [editDuration, setEditDuration] = useState('')
  const [exporting, setExporting] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const [playerZoom, setPlayerZoom] = useState(67)
  const [tab, setTab] = useState('player')
  const [tableDurations, setTableDurations] = useState({})
  const [videoPreloadStatus, setVideoPreloadStatus] = useState({}) // { url: 'loading' | 'ready' | 'error' }

  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const timelineRef = useRef(null)
  const audioRefs = useRef({})
  const videoPreloadCache = useRef({}) // { url: HTMLVideoElement }
  const imageCache = useRef({})
  const currentFrameRef = useRef(0)
  const fileInputRef = useRef(null)
  const outputFileRef = useRef(null)
  const [activeVideoShotId, setActiveVideoShotId] = useState(null)

  // Ordered shots (all) and timeline shots (enabled only)
  const orderedShots = useMemo(() =>
    [...shots].sort((a, b) => a.sequence.localeCompare(b.sequence) || (a.sort_order || 0) - (b.sort_order || 0))
  , [shots])
  const timelineShots = useMemo(() =>
    orderedShots.filter(sh => sh.timeline_enabled !== false)
  , [orderedShots])

  const totalFrames = useMemo(() =>
    timelineShots.reduce((s, sh) => s + (sh.duration_frames || DEFAULT_DURATION_FRAMES), 0)
  , [timelineShots])

  const totalSeconds = totalFrames / fps

  const getShotAtFrame = useCallback((frame) => {
    let acc = 0
    for (let i = 0; i < timelineShots.length; i++) {
      const sh = timelineShots[i]
      const dur = sh.duration_frames || DEFAULT_DURATION_FRAMES
      if (frame < acc + dur) return { shot: sh, index: i, localFrame: frame - acc, startFrame: acc }
      acc += dur
    }
    const last = timelineShots[timelineShots.length - 1]
    return { shot: last, index: timelineShots.length - 1, localFrame: 0, startFrame: acc - (last?.duration_frames || DEFAULT_DURATION_FRAMES) }
  }, [timelineShots])

  const currentShotInfo = useMemo(() => getShotAtFrame(currentFrame), [currentFrame, getShotAtFrame])
  const selectedShot = timelineShots.find(s => s.id === selectedShotId) || orderedShots.find(s => s.id === selectedShotId)

  // ── Image preloading ──
  const [imagesLoaded, setImagesLoaded] = useState(0) // triggers redraw when images finish loading
  const preloadImage = useCallback((url) => {
    if (!url || imageCache.current[url]) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImagesLoaded(n => n + 1)
    img.src = thumbUrl(url)
    imageCache.current[url] = img
  }, [])

  useEffect(() => {
    timelineShots.forEach(sh => {
      const url = sh.output_cloud_url || sh.ref_cloud_url || sh.concept_image_url
      if (url) {
        if (isVideoUrl(url)) {
          const poster = videoThumb(url)
          if (poster) preloadImage(poster)
        } else {
          preloadImage(url)
        }
      }
    })
  }, [timelineShots, preloadImage])

  // ── Video preloading — buffer all video shots in advance ──
  useEffect(() => {
    const videoUrls = timelineShots
      .map(sh => sh.output_cloud_url || sh.ref_cloud_url || sh.concept_image_url)
      .filter(url => url && isVideoUrl(url))
    const uniqueUrls = [...new Set(videoUrls)]

    uniqueUrls.forEach(originalUrl => {
      if (videoPreloadCache.current[originalUrl]) return
      const src = video720p(originalUrl)
      const vid = document.createElement('video')
      vid.preload = 'auto'
      vid.muted = true
      vid.src = src
      videoPreloadCache.current[originalUrl] = vid
      setVideoPreloadStatus(prev => ({ ...prev, [originalUrl]: 'loading' }))

      const onCanPlay = () => {
        setVideoPreloadStatus(prev => ({ ...prev, [originalUrl]: 'ready' }))
        vid.removeEventListener('canplaythrough', onCanPlay)
      }
      const onError = () => {
        setVideoPreloadStatus(prev => ({ ...prev, [originalUrl]: 'error' }))
        vid.removeEventListener('error', onError)
      }
      vid.addEventListener('canplaythrough', onCanPlay)
      vid.addEventListener('error', onError)
      vid.load()
    })
  }, [timelineShots])

  const getShotMedia = useCallback((shot) => {
    const url = shot?.output_cloud_url || shot?.ref_cloud_url || shot?.concept_image_url
    if (!url) return { url: null, type: 'none' }
    if (isVideoUrl(url)) return { url, type: 'video' }
    return { url, type: 'image' }
  }, [])

  // Get thumbnail for any shot (image or video first frame)
  const getShotThumb = useCallback((shot) => {
    const url = shot?.output_cloud_url || shot?.ref_cloud_url || shot?.concept_image_url
    if (!url) return null
    if (isVideoUrl(url)) return videoThumb(url)
    return smallThumb(url)
  }, [])

  // ── Canvas drawing ──
  const drawFrame = useCallback((frame) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { shot } = getShotAtFrame(frame)
    const { url, type } = getShotMedia(shot)

    if (type === 'video') {
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      setActiveVideoShotId(shot?.id)
      return
    }

    setActiveVideoShotId(null)
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (url && type === 'image') {
      const tUrl = thumbUrl(url)
      const cached = imageCache.current[url] || imageCache.current[tUrl]
      if (cached && cached.complete && cached.naturalWidth) {
        const cw = canvas.width, ch = canvas.height
        const iw = cached.naturalWidth, ih = cached.naturalHeight
        const scale = Math.min(cw / iw, ch / ih)
        const dw = iw * scale, dh = ih * scale
        ctx.drawImage(cached, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
      } else {
        ctx.fillStyle = '#333'
        ctx.font = '20px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2)
        if (url && !imageCache.current[url]) preloadImage(url)
      }
    } else {
      ctx.fillStyle = '#222'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#555'
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(shot?.code || 'No Shot', canvas.width / 2, canvas.height / 2)
    }

    if (shot) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`${shot.code}  —  ${shot.sequence}`, 16, canvas.height - 14)
      const dur = shot.duration_frames || DEFAULT_DURATION_FRAMES
      const { localFrame } = getShotAtFrame(frame)
      ctx.textAlign = 'right'
      ctx.font = '14px monospace'
      ctx.fillText(`Frame ${localFrame + 1}/${dur}`, canvas.width - 16, canvas.height - 14)
    }
  }, [getShotAtFrame, getShotMedia, preloadImage])

  useEffect(() => { drawFrame(currentFrame) }, [currentFrame, drawFrame, imagesLoaded])

  // ── Video sync ──
  const currentVideoUrl = useMemo(() => {
    const { shot } = getShotAtFrame(currentFrame)
    const { url, type } = getShotMedia(shot)
    return type === 'video' ? url : null
  }, [currentFrame, getShotAtFrame, getShotMedia])

  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    if (currentVideoUrl) {
      const src720 = video720p(currentVideoUrl)
      if (vid.dataset.loadedUrl !== currentVideoUrl) {
        vid.dataset.loadedUrl = currentVideoUrl
        // Use preloaded video's src (same URL, browser cache hit)
        const preloaded = videoPreloadCache.current[currentVideoUrl]
        if (preloaded && preloaded.readyState >= 3) {
          // Browser has this URL cached from preload — just set src
          vid.src = src720
          vid.load()
        } else {
          vid.src = src720
          vid.load()
        }
      }
      const { localFrame } = getShotAtFrame(currentFrame)
      const targetTime = localFrame / fps
      if (Math.abs(vid.currentTime - targetTime) > 0.15) vid.currentTime = targetTime
      vid.volume = volume
      if (playing) {
        if (vid.readyState >= 3) {
          if (vid.paused) vid.play().catch(() => {})
        } else {
          // Wait for enough data before playing
          const onCanPlay = () => { vid.play().catch(() => {}); vid.removeEventListener('canplay', onCanPlay) }
          vid.addEventListener('canplay', onCanPlay)
        }
      }
      if (!playing && !vid.paused) vid.pause()
    } else {
      if (!vid.paused) vid.pause()
      vid.dataset.loadedUrl = ''
    }
  }, [currentVideoUrl, currentFrame, playing, volume, fps, getShotAtFrame])

  // ── Audio sync ──
  useEffect(() => {
    const { shot: curShot } = getShotAtFrame(currentFrame)
    Object.entries(audioRefs.current).forEach(([id, el]) => {
      if (id !== curShot?.id && el && !el.paused) el.pause()
    })
    if (playing && curShot?.audio_url) {
      const el = audioRefs.current[curShot.id]
      if (el) {
        el.volume = volume
        if (el.paused) {
          const { localFrame } = getShotAtFrame(currentFrame)
          el.currentTime = localFrame / fps
          el.play().catch(() => {})
        }
      }
    }
  }, [currentFrame, playing, volume, fps, getShotAtFrame])

  useEffect(() => {
    if (!playing) Object.values(audioRefs.current).forEach(el => { if (el && !el.paused) el.pause() })
  }, [playing])

  // ── Playback loop ──
  useEffect(() => {
    if (!playing) return
    let lastTime = performance.now()
    let frameAcc = 0
    const interval = 1000 / fps
    let rafId
    const tick = (now) => {
      frameAcc += now - lastTime
      lastTime = now
      while (frameAcc >= interval) {
        frameAcc -= interval
        currentFrameRef.current++
        if (currentFrameRef.current >= totalFrames) {
          if (loop) { currentFrameRef.current = 0 }
          else { currentFrameRef.current = totalFrames - 1; setCurrentFrame(currentFrameRef.current); setPlaying(false); return }
        }
        setCurrentFrame(currentFrameRef.current)
      }
      rafId = requestAnimationFrame(tick)
    }
    currentFrameRef.current = currentFrame
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [playing, fps, totalFrames, loop])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); setPlaying(p => !p) }
      if (e.code === 'ArrowRight') setCurrentFrame(prev => Math.min(prev + 1, totalFrames - 1))
      if (e.code === 'ArrowLeft') setCurrentFrame(prev => Math.max(prev - 1, 0))
      if (e.code === 'Home') setCurrentFrame(0)
      if (e.code === 'End') setCurrentFrame(totalFrames - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [totalFrames])

  // ── Export as MP4 (with WebM fallback for unsupported browsers) ──
  const handleExport = useCallback(async () => {
    if (exporting) return
    setExporting(true)

    const useWebCodecs = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
    const W = 1920, H = 1080
    const expCanvas = document.createElement('canvas')
    expCanvas.width = W
    expCanvas.height = H
    const expCtx = expCanvas.getContext('2d')

    // Pre-load all images with crossOrigin for canvas export
    const preloadImage = (url) => new Promise((resolve) => {
      if (!url) return resolve(null)
      // Check cache first
      const cached = imageCache.current[url] || imageCache.current[thumbUrl(url)]
      if (cached?.complete && cached?.naturalWidth) {
        // If cached image doesn't have crossOrigin, reload it
        if (!cached.crossOrigin) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => resolve(cached) // fallback to cached
          img.src = url
          return
        }
        return resolve(cached)
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })

    addToast?.('Preparazione export...', 'info')

    try {
      // Pre-load all images with CORS
      const imageExportCache = {}
      for (const sh of timelineShots) {
        const url = sh.output_cloud_url || sh.ref_cloud_url || sh.concept_image_url
        if (url && !isVideoUrl(url) && !imageExportCache[url]) {
          imageExportCache[url] = await preloadImage(url)
        }
      }

      // Pre-load video elements
      const exportVideos = {}
      const videoShotUrls = []
      for (const sh of timelineShots) {
        const url = sh.output_cloud_url || sh.ref_cloud_url || sh.concept_image_url
        if (url && isVideoUrl(url) && !exportVideos[url]) videoShotUrls.push(url)
      }
      if (videoShotUrls.length > 0) {
        addToast?.(`Caricamento ${videoShotUrls.length} video...`, 'info')
        for (const origUrl of videoShotUrls) {
          const vid = document.createElement('video')
          vid.crossOrigin = 'anonymous'
          vid.preload = 'auto'
          vid.muted = true
          vid.src = video720p(origUrl)
          await new Promise((resolve) => {
            const onReady = () => { vid.removeEventListener('canplaythrough', onReady); resolve() }
            const onErr = () => { vid.removeEventListener('error', onErr); resolve() }
            vid.addEventListener('canplaythrough', onReady)
            vid.addEventListener('error', onErr)
            vid.load()
          })
          if (vid.readyState >= 2) exportVideos[origUrl] = vid
        }
      }

      // Helper: seek video and wait
      const seekVideo = (vid, time) => new Promise((resolve) => {
        const clampedTime = Math.min(Math.max(time, 0), vid.duration || 0)
        if (Math.abs(vid.currentTime - clampedTime) < 0.02) return resolve()
        const onSeeked = () => { vid.removeEventListener('seeked', onSeeked); resolve() }
        vid.addEventListener('seeked', onSeeked)
        vid.currentTime = clampedTime
      })

      // Helper: draw a single frame
      const drawFrame = async (f) => {
        const { shot, localFrame } = getShotAtFrame(f)
        const mediaUrl = shot?.output_cloud_url || shot?.ref_cloud_url || shot?.concept_image_url

        expCtx.fillStyle = '#111'
        expCtx.fillRect(0, 0, W, H)

        if (mediaUrl && isVideoUrl(mediaUrl)) {
          const vid = exportVideos[mediaUrl]
          if (vid) {
            const targetTime = localFrame / fps
            await seekVideo(vid, targetTime)
            try {
              const vw = vid.videoWidth || W, vh = vid.videoHeight || H
              const scale = Math.min(W / vw, H / vh)
              const dw = vw * scale, dh = vh * scale
              expCtx.drawImage(vid, (W - dw) / 2, (H - dh) / 2, dw, dh)
            } catch (e) { /* frame stays black */ }
          }
        } else if (mediaUrl) {
          const imgToDraw = imageExportCache[mediaUrl]
          if (imgToDraw?.complete && imgToDraw?.naturalWidth) {
            const iw = imgToDraw.naturalWidth, ih = imgToDraw.naturalHeight
            const scale = Math.min(W / iw, H / ih)
            const dw = iw * scale, dh = ih * scale
            expCtx.drawImage(imgToDraw, (W - dw) / 2, (H - dh) / 2, dw, dh)
          }
        }

        // Overlay
        if (shot) {
          const dur = shot.duration_frames || DEFAULT_DURATION_FRAMES
          expCtx.fillStyle = 'rgba(0,0,0,0.5)'
          expCtx.fillRect(0, H - 50, W, 50)
          expCtx.fillStyle = '#fff'
          expCtx.font = 'bold 20px sans-serif'
          expCtx.textAlign = 'left'
          expCtx.fillText(`${shot.code}  —  ${shot.sequence}`, 20, H - 18)
          expCtx.textAlign = 'right'
          expCtx.font = '16px monospace'
          expCtx.fillText(`Frame ${f + 1}/${totalFrames}`, W - 20, H - 18)
        }
      }

      if (useWebCodecs) {
        // ── MP4 export via WebCodecs + mp4-muxer ──
        addToast?.('Exporting MP4... (0%)', 'info')
        const muxer = new Muxer({
          target: new ArrayBufferTarget(),
          video: { codec: 'avc', width: W, height: H },
          fastStart: 'in-memory',
        })

        // Try codecs in order of compatibility
        let encoderConfig = null
        for (const codec of ['avc1.42001f', 'avc1.640028', 'avc1.4d401f']) {
          try {
            const support = await VideoEncoder.isConfigSupported({
              codec, width: W, height: H, bitrate: 8_000_000, framerate: fps,
            })
            if (support.supported) { encoderConfig = { codec, width: W, height: H, bitrate: 8_000_000, framerate: fps }; break }
          } catch (e) { /* try next */ }
        }
        if (!encoderConfig) throw new Error('Nessun codec H.264 supportato. Usa Chrome o Edge.')

        const encoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (e) => console.error('Encoder error:', e),
        })
        encoder.configure(encoderConfig)

        let progressToast = 0
        for (let f = 0; f < totalFrames; f++) {
          const pct = Math.floor((f / totalFrames) * 100)
          if (pct >= progressToast + 5) { progressToast = pct; addToast?.(`Exporting MP4... (${pct}%)`, 'info') }

          await drawFrame(f)
          const { shot } = getShotAtFrame(f)
          const localFrame = f - (timelineShots.slice(0, timelineShots.indexOf(shot)).reduce((s, sh) => s + (sh.duration_frames || DEFAULT_DURATION_FRAMES), 0))
          const timestamp = Math.round(f * (1_000_000 / fps))
          const frame = new VideoFrame(expCanvas, { timestamp })
          encoder.encode(frame, { keyFrame: localFrame === 0 || f === 0 })
          frame.close()
          if (f % 50 === 0) await new Promise(r => setTimeout(r, 0))
        }

        await encoder.flush()
        encoder.close()
        muxer.finalize()

        const buf = muxer.target.buffer
        const blob = new Blob([buf], { type: 'video/mp4' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `movieboard_${fps}fps.mp4`; a.click()
        URL.revokeObjectURL(url)
        addToast?.('Export MP4 completato!', 'success')

      } else {
        // ── Fallback: WebM export via MediaRecorder (Firefox, Safari, older browsers) ──
        addToast?.('Exporting video (WebM)... (0%)', 'info')
        const stream = expCanvas.captureStream(0)
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
            : 'video/webm',
          videoBitsPerSecond: 8_000_000,
        })
        const chunks = []
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

        const done = new Promise(resolve => { recorder.onstop = resolve })
        recorder.start()

        let progressToast = 0
        for (let f = 0; f < totalFrames; f++) {
          const pct = Math.floor((f / totalFrames) * 100)
          if (pct >= progressToast + 5) { progressToast = pct; addToast?.(`Exporting video... (${pct}%)`, 'info') }

          await drawFrame(f)
          const canvasTrack = stream.getVideoTracks()[0]
          if (canvasTrack?.requestFrame) canvasTrack.requestFrame()

          await new Promise(r => setTimeout(r, 1000 / fps))
        }

        recorder.stop()
        await done

        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `movieboard_${fps}fps.webm`; a.click()
        URL.revokeObjectURL(url)
        addToast?.('Export video completato! (WebM — il tuo browser non supporta MP4)', 'success')
      }
    } catch (err) {
      console.error('Export error:', err)
      addToast?.('Export fallito: ' + err.message, 'danger')
    }
    setExporting(false)
  }, [fps, totalFrames, timelineShots, getShotAtFrame, exporting, addToast])

  // ── Handlers ──
  const handleDurationSave = useCallback(async () => {
    if (!selectedShotId || !editDuration) return
    const frames = parseInt(editDuration, 10)
    if (isNaN(frames) || frames < 1) return
    await onUpdateShot(selectedShotId, { duration_frames: frames })
    addToast?.('Duration updated', 'success')
  }, [selectedShotId, editDuration, onUpdateShot, addToast])

  const handleAudioUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedShotId) return
    await onUploadShotAudio(selectedShotId, file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [selectedShotId, onUploadShotAudio])

  const selectShot = useCallback((shotId) => {
    setSelectedShotId(shotId)
    const sh = orderedShots.find(s => s.id === shotId) || timelineShots.find(s => s.id === shotId)
    setEditDuration(String(sh?.duration_frames || DEFAULT_DURATION_FRAMES))
  }, [orderedShots, timelineShots])

  const jumpToShot = useCallback((shotId) => {
    let acc = 0
    for (const sh of timelineShots) {
      if (sh.id === shotId) { setCurrentFrame(acc); return }
      acc += sh.duration_frames || DEFAULT_DURATION_FRAMES
    }
  }, [timelineShots])

  if (orderedShots.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>
        <div style={{ textAlign: 'center' }}>
          <IconTimeline size={48} color="#CBD5E1" />
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>No shots yet</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>Add shots in the Shot Tracker to use the Timeline</div>
        </div>
      </div>
    )
  }

  const shotPositions = useMemo(() => {
    const positions = []
    let acc = 0
    for (const sh of timelineShots) {
      const dur = sh.duration_frames || DEFAULT_DURATION_FRAMES
      positions.push({ shot: sh, startFrame: acc, duration: dur, pct: dur / totalFrames })
      acc += dur
    }
    return positions
  }, [timelineShots, totalFrames])

  const playheadPct = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0
  const currentSec = currentFrame / fps

  // Video preload progress
  const videoPreloadInfo = useMemo(() => {
    const statuses = Object.values(videoPreloadStatus)
    const total = statuses.length
    if (total === 0) return { total: 0, ready: 0, allReady: true }
    const ready = statuses.filter(s => s === 'ready').length
    return { total, ready, allReady: ready >= total }
  }, [videoPreloadStatus])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0F', color: '#E2E8F0', overflow: 'hidden' }}>

      {/* ══ HEADER ══ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #1E293B', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <IconTimeline size={18} color={ACCENT} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Timeline</span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>{timelineShots.length}/{orderedShots.length} shots · {totalFrames}f · {fmt(totalSeconds)}</span>
          {videoPreloadInfo.total > 0 && !videoPreloadInfo.allReady && (
            <span style={{ fontSize: 10, color: ACCENT, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, animation: 'wipPulse 1.5s ease-in-out infinite' }} />
              Buffering video {videoPreloadInfo.ready}/{videoPreloadInfo.total}
            </span>
          )}
          {videoPreloadInfo.total > 0 && videoPreloadInfo.allReady && (
            <span style={{ fontSize: 10, color: '#22C55E' }}>Video pronti (720p)</span>
          )}
          <div style={{ display: 'flex', background: '#1E293B', borderRadius: 6, padding: 2 }}>
            {[{ id: 'player', label: 'Player' }, { id: 'table', label: 'Tabella' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '3px 12px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: tab === t.id ? ACCENT : 'transparent',
                color: tab === t.id ? '#fff' : '#64748B',
                transition: 'all 0.15s ease',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#64748B' }}>FPS</span>
            <select value={fps} onChange={e => setFps(Number(e.target.value))} style={{
              background: '#1E293B', color: '#E2E8F0', border: '1px solid #334155', borderRadius: 5,
              padding: '3px 6px', fontSize: 11, outline: 'none', cursor: 'pointer',
            }}>
              {[12, 24, 25, 30, 60].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#64748B' }}>Vol</span>
            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(parseFloat(e.target.value))}
              style={{ width: 50, accentColor: ACCENT }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#64748B' }}>Zoom</span>
            <input type="range" min="30" max="100" step="5" value={playerZoom} onChange={e => setPlayerZoom(Number(e.target.value))}
              style={{ width: 50, accentColor: ACCENT }} />
            <span style={{ fontSize: 10, color: '#94A3B8', minWidth: 28 }}>{playerZoom}%</span>
          </div>
          <button onClick={() => setLoop(l => !l)} style={{
            background: loop ? ACCENT + '30' : '#1E293B', border: `1px solid ${loop ? ACCENT : '#334155'}`,
            borderRadius: 5, padding: '3px 8px', fontSize: 10, color: loop ? ACCENT : '#94A3B8', cursor: 'pointer', fontWeight: 600,
          }}>Loop</button>
          <button onClick={handleExport} disabled={exporting} style={{
            background: '#1E293B', border: '1px solid #334155', borderRadius: 5,
            padding: '4px 10px', fontSize: 11, color: '#E2E8F0', cursor: 'pointer', fontWeight: 600,
            opacity: exporting ? 0.5 : 1,
          }}>{exporting ? 'Exporting...' : 'Export MP4'}</button>
        </div>
      </div>

      {tab === 'table' ? (
        /* ══ TABLE VIEW ══ */
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 900, background: '#111827', borderRadius: 12, border: '1px solid #1E293B', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #334155' }}>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: 36 }} title="Abilita in timeline">TL</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: 40 }}>#</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: 76 }}>Thumb</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Shot</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', width: 90 }}>Sequence</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: 90 }}>Frames</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: 80 }}>Durata</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: 60 }}>Audio</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: 80 }}>Output</th>
                <th style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: 110 }}>Range</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let accFrame = 0
                let globalIdx = 0
                // Group shots by sequence
                const seqs = []
                let curSeq = null
                for (const shot of orderedShots) {
                  if (shot.sequence !== curSeq) {
                    seqs.push({ seq: shot.sequence, shots: [] })
                    curSeq = shot.sequence
                  }
                  seqs[seqs.length - 1].shots.push(shot)
                }
                const rows = []
                seqs.forEach((group) => {
                  const seqEnabledShots = group.shots.filter(sh => sh.timeline_enabled !== false)
                  const seqTotalFrames = seqEnabledShots.reduce((s, sh) => s + (sh.duration_frames || DEFAULT_DURATION_FRAMES), 0)
                  const seqStartFrame = accFrame
                  group.shots.forEach((shot) => {
                    const isEnabled = shot.timeline_enabled !== false
                    if (isEnabled) globalIdx++
                    const dur = shot.duration_frames || DEFAULT_DURATION_FRAMES
                    const startFrame = accFrame
                    if (isEnabled) accFrame += dur
                    const editVal = tableDurations[shot.id]
                    const isEditing = editVal !== undefined
                    const imgUrl = shot.output_cloud_url || shot.ref_cloud_url || shot.concept_image_url
                    const thumbSrc = imgUrl ? (isVideoUrl(imgUrl) ? videoThumb(imgUrl) : smallThumb(imgUrl)) : null
                    rows.push(
                      <tr key={shot.id} style={{ borderBottom: '1px solid #1E293B', background: globalIdx % 2 === 0 ? '#111827' : 'transparent', opacity: shot.timeline_enabled === false ? 0.4 : 1 }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <input type="checkbox" checked={shot.timeline_enabled !== false}
                            onChange={async () => {
                              const newVal = shot.timeline_enabled === false ? true : false
                              await onUpdateShot(shot.id, { timeline_enabled: newVal })
                            }}
                            style={{ accentColor: ACCENT, width: 15, height: 15, cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>{shot.timeline_enabled !== false ? globalIdx : '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {thumbSrc ? (
                            <img src={thumbSrc} alt="" style={{ width: 60, height: 34, objectFit: 'cover', borderRadius: 4, border: '1px solid #334155' }} />
                          ) : (
                            <div style={{ width: 60, height: 34, background: '#1E293B', borderRadius: 4 }} />
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#F1F5F9', fontSize: 14 }}>{shot.code}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', color: '#94A3B8', fontSize: 13 }}>{shot.sequence}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', height: 48 }}>
                          {isEditing ? (
                            <input value={editVal} autoFocus
                              onFocus={e => e.target.select()}
                              onChange={e => setTableDurations(prev => ({ ...prev, [shot.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                              onBlur={async () => {
                                const frames = parseInt(editVal, 10)
                                if (frames && frames > 0 && frames !== dur) {
                                  await onUpdateShot(shot.id, { duration_frames: frames })
                                  addToast?.(`${shot.code}: ${frames} frames`)
                                }
                                setTableDurations(prev => { const n = { ...prev }; delete n[shot.id]; return n })
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') e.target.blur()
                                if (e.key === 'Escape') setTableDurations(prev => { const n = { ...prev }; delete n[shot.id]; return n })
                              }}
                              style={{ width: 64, background: '#1E293B', border: `1.5px solid ${ACCENT}`, borderRadius: 5, padding: '5px 8px', color: '#F1F5F9', fontSize: 13, textAlign: 'center', outline: 'none', fontFamily: 'inherit', fontWeight: 600 }}
                            />
                          ) : (
                            <span onClick={() => setTableDurations(prev => ({ ...prev, [shot.id]: String(dur) }))}
                              style={{ cursor: 'pointer', padding: '5px 12px', borderRadius: 5, background: '#1E293B', border: '1px solid #334155', fontSize: 13, fontWeight: 600, color: '#F1F5F9', display: 'inline-block', minWidth: 48, textAlign: 'center' }}
                              title="Click to edit">{dur}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#CBD5E1', fontSize: 13, fontFamily: 'monospace' }}>{(dur / fps).toFixed(1)}s</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {shot.audio_url ? (
                            <span style={{ color: '#2DD4BF', fontSize: 15, fontWeight: 700 }} title="Audio">&#9835;</span>
                          ) : (
                            <span style={{ color: '#475569', fontSize: 14 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {shot.output_cloud_url ? (
                            <span style={{ color: '#4ADE80', fontSize: 12, fontWeight: 700 }}>OK</span>
                          ) : (
                            <span style={{ color: '#475569', fontSize: 14 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{startFrame}–{startFrame + dur - 1}</span>
                        </td>
                      </tr>
                    )
                  })
                  // Sequence summary row
                  rows.push(
                    <tr key={`seq-${group.seq}`} style={{ background: '#0D1117', borderBottom: '2px solid #1E293B' }}>
                      <td />
                      <td colSpan={3} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, color: ACCENT }}>{group.seq}</td>
                      <td style={{ padding: '6px 12px', fontSize: 11, color: '#94A3B8' }}>{seqEnabledShots.length}/{group.shots.length} shots</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>{seqTotalFrames}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: ACCENT, fontFamily: 'monospace' }}>{(seqTotalFrames / fps).toFixed(1)}s</td>
                      <td colSpan={2} />
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontSize: 10, color: '#64748B', fontFamily: 'monospace' }}>{seqStartFrame}–{accFrame - 1}</td>
                    </tr>
                  )
                })
                return rows
              })()}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #1E293B', display: 'flex', gap: 24, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>Totale:</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>{totalFrames} frames</span>
            <span style={{ fontSize: 15, color: ACCENT, fontWeight: 700 }}>{fmt(totalSeconds)}</span>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>@ {fps} fps</span>
          </div>
          </div>
        </div>
      ) : (
      /* ══ PLAYER + EDITOR ══ */
      <><div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Player */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', position: 'relative', overflow: 'hidden' }}>
            {/* Fixed 16:9 container with zoom */}
            <div style={{ position: 'relative', width: `${playerZoom}%`, maxHeight: '100%', aspectRatio: '16 / 9', background: '#000' }}>
            <canvas ref={canvasRef} width={1920} height={1080}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: activeVideoShotId ? 'none' : 'block' }} />
            <video ref={videoRef} muted={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: activeVideoShotId ? 'block' : 'none' }} />
            {activeVideoShotId && (() => {
              const { shot, localFrame } = getShotAtFrame(currentFrame)
              const dur = shot?.duration_frames || DEFAULT_DURATION_FRAMES
              return (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 16px', background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'space-between', color: '#fff', pointerEvents: 'none' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{shot?.code} — {shot?.sequence}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13 }}>Frame {localFrame + 1}/{dur}</span>
                </div>
              )
            })()}
            </div>{/* close 16:9 container */}
          </div>

          {/* Transport bar */}
          <div style={{ padding: '8px 16px 10px', background: '#0F172A', borderTop: '1px solid #1E293B', flexShrink: 0 }}>
            <input type="range" min={0} max={Math.max(totalFrames - 1, 1)} value={currentFrame}
              onChange={e => { setCurrentFrame(Number(e.target.value)); if (playing) setPlaying(false) }}
              style={{ width: '100%', accentColor: ACCENT, height: 4, cursor: 'pointer' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => { setPlaying(false); setCurrentFrame(0) }} style={{
                  background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4, fontSize: 14,
                }}>&#9632;</button>
                <button onClick={() => setPlaying(p => !p)} style={{
                  background: ACCENT, border: 'none', borderRadius: '50%', width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  color: '#fff', fontSize: 16,
                }}>{playing ? '||' : '\u25B6'}</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 14, fontFamily: 'monospace', color: '#E2E8F0', fontWeight: 600, letterSpacing: '0.03em' }}>
                  {fmt(currentSec)} <span style={{ color: '#475569' }}>/</span> {fmt(totalSeconds)}
                </span>
                <span style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace', background: '#1E293B', padding: '2px 8px', borderRadius: 4 }}>
                  F{currentFrame + 1}/{totalFrames}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
                  {currentShotInfo?.shot?.code || ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ══ Editor Panel ══ */}
        <div style={{ width: 270, borderLeft: '1px solid #1E293B', background: '#0F172A', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1E293B', fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>
            Shot Properties
          </div>
          {selectedShot ? (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selectedShot.code}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{selectedShot.sequence}</div>
                {selectedShot.description && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, lineHeight: 1.4 }}>{selectedShot.description}</div>}
              </div>

              {(selectedShot.ref_cloud_url || selectedShot.concept_image_url) && (
                <div>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Reference</div>
                  <img src={smallThumb(selectedShot.ref_cloud_url || selectedShot.concept_image_url)}
                    alt="" style={{ width: '100%', borderRadius: 6, border: '1px solid #1E293B' }} />
                </div>
              )}

              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Output</div>
                <input ref={outputFileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file || !selectedShotId) return
                  await onUploadOutput(selectedShotId, file)
                  if (outputFileRef.current) outputFileRef.current.value = ''
                }} style={{ display: 'none' }} />
                {selectedShot.output_cloud_url && !isVideoUrl(selectedShot.output_cloud_url) && (
                  <img src={smallThumb(selectedShot.output_cloud_url)} alt="" style={{ width: '100%', borderRadius: 6, border: '1px solid #1E293B', marginBottom: 6 }} />
                )}
                {selectedShot.output_cloud_url && isVideoUrl(selectedShot.output_cloud_url) && (
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6, padding: '6px 8px', background: '#1E293B', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>{'\u25B6'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedShot.output_cloud_url.split('/').pop()}</span>
                  </div>
                )}
                <button onClick={() => outputFileRef.current?.click()} style={{
                  background: '#1E293B', border: '1px dashed #334155', borderRadius: 6, padding: '8px 0',
                  width: '100%', color: '#64748B', fontSize: 11, cursor: 'pointer', textAlign: 'center',
                }}>{selectedShot.output_cloud_url ? 'Cambia Output' : 'Carica Output'}</button>
                {selectedShot.output_cloud_url && isVideoUrl(selectedShot.output_cloud_url) && (
                  <a href={selectedShot.output_cloud_url} download target="_blank" rel="noopener noreferrer" style={{
                    display: 'block', marginTop: 4, background: '#1E293B', border: '1px solid #334155', borderRadius: 6, padding: '8px 0',
                    width: '100%', color: '#94A3B8', fontSize: 11, cursor: 'pointer', textAlign: 'center', textDecoration: 'none',
                  }}>Download HD</a>
                )}
              </div>

              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Duration (frames)</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={editDuration}
                    onFocus={e => e.target.select()}
                    onChange={e => setEditDuration(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && handleDurationSave()}
                    style={{ flex: 1, background: '#1E293B', border: '1px solid #334155', borderRadius: 5, padding: '5px 8px', color: '#E2E8F0', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={handleDurationSave} style={{
                    background: ACCENT, border: 'none', borderRadius: 5, padding: '5px 10px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>Set</button>
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                  = {((parseInt(editDuration) || DEFAULT_DURATION_FRAMES) / fps).toFixed(2)}s @ {fps}fps
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Audio</div>
                {selectedShot.audio_url ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <audio controls src={selectedShot.audio_url} style={{ width: '100%', height: 28 }} />
                    <button onClick={() => onUpdateShot(selectedShot.id, { audio_url: null }).then(() => addToast?.('Audio removed'))}
                      style={{ background: 'none', border: '1px solid #EF4444', borderRadius: 5, padding: '3px 8px', color: '#EF4444', fontSize: 10, cursor: 'pointer' }}>
                      Rimuovi Audio
                    </button>
                  </div>
                ) : (
                  <div>
                    <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} style={{ display: 'none' }} />
                    <button onClick={() => fileInputRef.current?.click()} style={{
                      background: '#1E293B', border: '1px dashed #334155', borderRadius: 6, padding: '8px 0',
                      width: '100%', color: '#64748B', fontSize: 11, cursor: 'pointer', textAlign: 'center',
                    }}>Carica Audio</button>
                  </div>
                )}
              </div>

              <button onClick={() => jumpToShot(selectedShotId)} style={{
                background: '#1E293B', border: '1px solid #334155', borderRadius: 5, padding: '7px 0',
                color: '#E2E8F0', fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'center',
              }}>Vai allo Shot</button>
              {onGoToShotTasks && (
                <button onClick={() => onGoToShotTasks(selectedShotId)} style={{
                  background: '#1E293B', border: '1px solid #334155', borderRadius: 5, padding: '7px 0',
                  color: ACCENT, fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'center',
                  marginTop: 4,
                }}>Vai ai Task →</button>
              )}
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: '#475569', fontSize: 12 }}>
              Clicca uno shot nella timeline
            </div>
          )}
        </div>
      </div>

      {/* ══ TIMELINE STRIP ══ */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #1E293B', background: '#0F172A' }}>
        <div ref={timelineRef} style={{ position: 'relative', overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ display: 'flex', minWidth: '100%', height: 110, position: 'relative' }}>
            {shotPositions.map(({ shot, startFrame, duration, pct }) => {
              const isActive = currentShotInfo?.shot?.id === shot.id
              const isSelected = selectedShotId === shot.id
              const imgUrl = getShotThumb(shot)
              return (
                <div
                  key={shot.id}
                  onClick={() => selectShot(shot.id)}
                  onDoubleClick={() => { selectShot(shot.id); jumpToShot(shot.id) }}
                  style={{
                    flex: `${pct} 0 0%`, minWidth: 50,
                    borderRight: '1px solid #1E293B',
                    background: isActive ? `${ACCENT}18` : isSelected ? '#1E293B' : '#0F172A',
                    borderTop: isActive ? `2px solid ${ACCENT}` : isSelected ? '2px solid #475569' : '2px solid transparent',
                    cursor: 'pointer', position: 'relative', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                    padding: 6, transition: 'background 0.1s ease',
                  }}
                >
                  {imgUrl && (
                    <img src={imgUrl} alt="" style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', opacity: 0.25, pointerEvents: 'none',
                    }} />
                  )}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? ACCENT : '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {shot.code}
                    </div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
                      {duration}f · {(duration / fps).toFixed(1)}s
                    </div>
                    {shot.audio_url && <span style={{ fontSize: 10, color: '#2DD4BF' }}>&#9835;</span>}
                  </div>
                </div>
              )
            })}
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: `${playheadPct}%`,
              width: 2, background: ACCENT, zIndex: 10, pointerEvents: 'none',
              boxShadow: `0 0 6px ${ACCENT}`,
            }} />
          </div>
        </div>
      </div>
      </>)}

      {/* Hidden audio elements */}
      {timelineShots.filter(s => s.audio_url).map(sh => (
        <audio
          key={sh.id}
          ref={el => { if (el) audioRefs.current[sh.id] = el }}
          src={sh.audio_url}
          preload="auto"
          style={{ display: 'none' }}
        />
      ))}
    </div>
  )
}

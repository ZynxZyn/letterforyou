import { useEffect, useRef, useState } from 'react'

function formatTime(sec) {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function MusicPlayer({ song, onStop }) {
  const audioRef = useRef(null)
  const barRef = useRef(null)
  const seekingRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!song || !audio) return undefined

    const onTime = () => setCurrent(audio.currentTime)
    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('durationchange', onLoaded)
    audio.load()

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('durationchange', onLoaded)
    }
  }, [song])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {})
      setPlaying(true)
    } else {
      audio.pause()
      setPlaying(false)
    }
  }

  const seekTo = (clientX) => {
    const audio = audioRef.current
    const bar = barRef.current
    if (!audio || !bar || !duration || !Number.isFinite(duration)) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
  }

  const onBarDown = (e) => {
    e.preventDefault()
    seekTo(e.clientX)
    seekingRef.current = true
    barRef.current?.setPointerCapture?.(e.pointerId)
  }

  const onBarMove = (e) => {
    if (!seekingRef.current) return
    seekTo(e.clientX)
  }

  const onBarUp = (e) => {
    seekingRef.current = false
    barRef.current?.releasePointerCapture?.(e.pointerId)
  }

  if (!song) {
    return (
      <div className="music-note" aria-label="Surat ini tanpa musik">
        <span aria-hidden="true">{'\u266B'}</span>
        Surat ini tanpa musik.
      </div>
    )
  }

  return (
    <div className="music-player">
      <audio ref={audioRef} src={song.src} loop preload="auto" />
      <button
        type="button"
        className="music-btn"
        onClick={toggle}
        aria-label={playing ? 'Jeda musik' : 'Putar musik'}
      >
        {playing ? '\u2759\u2759' : '\u25B6'}
      </button>
      <div className="music-info">
        <p className="music-title" title={song.title}>
          {song.title}
        </p>
        <p className="music-time">
          {formatTime(current)} / {formatTime(duration)}
        </p>
      </div>
      <div
        ref={barRef}
        className="music-bar"
        role="slider"
        aria-label="Posisi lagu"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration) || 0}
        aria-valuenow={Math.round(current) || 0}
        onPointerDown={onBarDown}
        onPointerMove={onBarMove}
        onPointerUp={onBarUp}
        onPointerCancel={onBarUp}
      >
        <span style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
      </div>
      <button type="button" className="music-btn" onClick={onStop} aria-label="Hentikan musik">
        {'\u2715'}
      </button>
    </div>
  )
}

export default MusicPlayer

import { useEffect, useRef, useState } from 'react'

function formatTime(sec) {
  if (!Number.isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function MusicPlayer({ song, onStop }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!song || !audio) return undefined

    const onTime = () => setCurrent(audio.currentTime)
    const onLoaded = () => {
      setDuration(audio.duration)
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.load()

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
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

  const seek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  if (!song) {
    return (
      <div className="music-note" aria-label="Tidak ada lagu tersedia">
        <span aria-hidden="true">{'\u266B'}</span>
        Tambahkan file lagu ke <code>src/assets/audio/</code> untuk musik.
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
      <div className="music-bar" role="slider" aria-label="Posisi lagu" onClick={seek}>
        <span style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
      </div>
      <button type="button" className="music-btn" onClick={onStop} aria-label="Hentikan musik">
        {'\u2715'}
      </button>
    </div>
  )
}

export default MusicPlayer

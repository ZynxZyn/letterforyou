import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Dashboard from './components/Dashboard'
import PhraseReveal from './components/PhraseReveal'
import Slideshow from './components/Slideshow'
import FloatingLetters from './components/FloatingLetters'
import LetterModal from './components/LetterModal'
import { phrases } from './data/phrases'
import { getLetterRowForCard, getLetterRows, getLetters, loadRemoteLetters } from './data/letters'
import { getLocalSongs, R2_BASE, getSongForLetter, loadRemoteState } from './data/songs'
import './styles/app.css'

const IS_DASHBOARD = new URLSearchParams(window.location.search).has('dashboard')

const STAGE = {
  INTRO: 'intro',
  PHRASES: 'phrases',
  SLIDESHOW: 'slideshow',
  LETTERS: 'letters',
}

function BackgroundMusic({ playing, visible }) {
  const audioRef = useRef(null)
  const [muted, setMuted] = useState(false)
  const song = getLocalSongs()[0] || null

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    if (playing) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [playing])

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.muted) {
      audio.muted = false
      setMuted(false)
      if (audio.paused && playing) audio.play().catch(() => {})
    } else {
      audio.muted = true
      setMuted(true)
    }
  }

  if (!song) return null

  return createPortal(
    <button
      type="button"
      className="slideshow-mute"
      onClick={toggleMute}
      aria-label={muted ? 'Nyalakan suara' : 'Bisukan suara'}
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <audio ref={audioRef} src={song.src} preload="auto" loop />
      {muted ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" />
          <line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
          <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M18 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>,
    document.body
  )
}

const HEARTS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: 4 + (i * 7) % 92,
  size: 14 + ((i * 13) % 22),
  duration: 7 + ((i * 5) % 9),
  delay: -((i * 2.3) % 10),
  blue: i % 2 === 0,
}))

const LEAVE_MS = 450

function App() {
  const [stage, setStage] = useState(STAGE.INTRO)
  const [leaving, setLeaving] = useState(false)
  const [openCard, setOpenCard] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [, setRemoteReady] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    let active = true
    Promise.all([loadRemoteState(), loadRemoteLetters()]).then(() => {
      if (active) setRemoteReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (openCard == null) return undefined
    const t = setTimeout(() => setShowModal(true), 850)
    return () => clearTimeout(t)
  }, [openCard])

  const closeCard = useCallback(() => {
    setOpenCard(null)
    setShowModal(false)
  }, [])

  const goTo = useCallback((next) => {
    if (leaving) return
    setLeaving(true)
    timerRef.current = setTimeout(() => {
      setLeaving(false)
      setStage(next)
      window.scrollTo(0, 0)
    }, LEAVE_MS)
  }, [leaving])

  const opened = openCard == null
    ? null
    : {
        index: openCard,
        ...getLetterRowForCard(openCard + 1),
        song: getSongForLetter(openCard + 1),
      }

  if (IS_DASHBOARD && (import.meta.env.DEV || R2_BASE)) {
    return <Dashboard />
  }

  const reachedSlideshow = stage === STAGE.SLIDESHOW || stage === STAGE.LETTERS

  return (
    <>
      {reachedSlideshow && (
        <BackgroundMusic
          playing={reachedSlideshow && openCard == null}
          visible={openCard == null}
        />
      )}
      <div className={`stage-wrap ${leaving ? 'is-leaving' : ''}`}>
        {stage === STAGE.INTRO && (
          <div className="intro stage-enter">
            <div className="intro-hearts" aria-hidden="true">
              {HEARTS.map((h) => (
                <span
                  key={h.id}
                  className={h.blue ? 'is-blue' : ''}
                  style={{
                    left: `${h.left}%`,
                    fontSize: `${h.size}px`,
                    animationDuration: `${h.duration}s`,
                    animationDelay: `${h.delay}s`,
                  }}
                >
                  {'\u2665'}
                </span>
              ))}
            </div>
            <p className="intro-kicker">LetterForYou</p>
            <h1 className="intro-title">
              Untuk Kalian, <em><span className="tosla-blue">TOSLA</span> <span className="tosla-red">027</span></em>
            </h1>
            <p className="intro-sub">
              Sebuah surat kecil berisi rasa terima kasih yang tak pernah sempat kami ucapkan.
              Mari buka kenangannya bersama.
            </p>
            <button type="button" className="btn-primary" onClick={() => goTo(STAGE.PHRASES)}>
              Mulai Membaca {'\u2665'}
            </button>
          </div>
        )}

        {stage === STAGE.PHRASES && (
          <PhraseReveal phrases={phrases} onComplete={() => goTo(STAGE.SLIDESHOW)} />
        )}

        {stage === STAGE.SLIDESHOW && (
          <Slideshow onComplete={() => goTo(STAGE.LETTERS)} />
        )}

        {stage === STAGE.LETTERS && (
          <FloatingLetters
            count={getLetters().length}
            titles={getLetterRows().map((r) => r.title)}
            onOpen={setOpenCard}
            openedId={openCard}
          />
        )}
      </div>

      {opened && showModal && (
        <LetterModal
          index={opened.index}
          title={opened.title}
          sender={opened.sender}
          message={opened.message}
          song={opened.song}
          onClose={closeCard}
          onStopMusic={closeCard}
        />
      )}
    </>
  )
}

export default App

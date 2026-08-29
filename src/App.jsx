import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PhraseReveal from './components/PhraseReveal'
import Slideshow from './components/Slideshow'
import FloatingLetters from './components/FloatingLetters'
import LetterModal from './components/LetterModal'
import { phrases } from './data/phrases'
import { letter, messages } from './data/messages'
import { getSongForLetter } from './data/songs'
import './styles/app.css'

const STAGE = {
  INTRO: 'intro',
  PHRASES: 'phrases',
  SLIDESHOW: 'slideshow',
  LETTERS: 'letters',
}

const HEARTS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: 4 + (i * 7) % 92,
  size: 14 + ((i * 13) % 22),
  duration: 7 + ((i * 5) % 9),
  delay: -((i * 2.3) % 10),
}))

function seededShuffle(arr, seed) {
  let s = seed
  const rng = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const LEAVE_MS = 450

function App() {
  const [stage, setStage] = useState(STAGE.INTRO)
  const [leaving, setLeaving] = useState(false)
  const [openCard, setOpenCard] = useState(null)
  const timerRef = useRef(null)

  const shuffledMessages = useMemo(() => seededShuffle(messages, 1337), [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

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
        message:
          openCard === 0
            ? letter
            : shuffledMessages[openCard % shuffledMessages.length],
        song: getSongForLetter(openCard + 1),
      }

  return (
    <>
      <div className={`stage-wrap ${leaving ? 'is-leaving' : ''}`}>
        {stage === STAGE.INTRO && (
          <div className="intro stage-enter">
            <div className="intro-hearts" aria-hidden="true">
              {HEARTS.map((h) => (
                <span
                  key={h.id}
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
              Untuk Kalian, <em>Para Pendahulu</em>
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
          <FloatingLetters count={22} onOpen={setOpenCard} />
        )}
      </div>

      {opened && (
        <LetterModal
          index={opened.index}
          message={opened.message}
          song={opened.song}
          onClose={() => setOpenCard(null)}
          onStopMusic={() => setOpenCard(null)}
        />
      )}
    </>
  )
}

export default App

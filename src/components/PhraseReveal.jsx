import { useCallback, useEffect, useMemo, useState } from 'react'

const TYPE_SPEED = 45
const IS_DEV = new URLSearchParams(window.location.search).has('dev')

function TypewriterText({ text, onDone }) {
  const [typed, setTyped] = useState(0)
  const done = typed >= text.length

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      const t = setTimeout(() => {
        setTyped(text.length)
        onDone()
      }, 0)
      return () => clearTimeout(t)
    }
    const t = setInterval(() => {
      setTyped((n) => {
        if (n + 1 >= text.length) {
          clearInterval(t)
          onDone()
          return text.length
        }
        return n + 1
      })
    }, TYPE_SPEED)
    return () => clearInterval(t)
  }, [text, onDone])

  return (
    <p className="phrase-text" aria-label={text}>
      <span aria-hidden="true">
        {text.slice(0, typed)}
        {!done && <span className="phrase-caret" aria-hidden="true" />}
      </span>
    </p>
  )
}

function PhraseReveal({ phrases, onComplete }) {
  const [index, setIndex] = useState(0)
  const [buttonVisible, setButtonVisible] = useState(false)
  const isLast = index === phrases.length - 1

  const finishTyping = useCallback(() => setButtonVisible(true), [])
  const devSkippable = useMemo(() => IS_DEV, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      if (!buttonVisible) return
      e.preventDefault()
      if (index === phrases.length - 1) onComplete()
      else setIndex((i) => i + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, buttonVisible, phrases.length, onComplete])

  const advance = () => {
    if (isLast) onComplete()
    else {
      setButtonVisible(false)
      setIndex((i) => i + 1)
    }
  }

  return (
    <div className="phrase-stage stage-enter">
      {devSkippable && (
        <button type="button" className="btn-dev" onClick={onComplete}>
          {'\u26A1'} Langsung ke Slideshow
        </button>
      )}
      <p className="phrase-count" aria-hidden="true">
        {String(index + 1).padStart(2, '0')} / {String(phrases.length).padStart(2, '0')}
      </p>
      <TypewriterText key={index} text={phrases[index]} onDone={finishTyping} />
      <div className="phrase-progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / phrases.length) * 100}%` }} />
      </div>
      <button
        type="button"
        className={`btn-next ${buttonVisible ? 'is-visible' : ''} ${index % 2 === 1 ? 'btn-next--alt' : ''}`}
        tabIndex={buttonVisible ? 0 : -1}
        onClick={advance}
      >
        {isLast ? 'Buka Kenangan \u2665' : 'Lanjut'}
      </button>
    </div>
  )
}

export default PhraseReveal

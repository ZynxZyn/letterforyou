import { useEffect, useRef } from 'react'
import MusicPlayer from './MusicPlayer'

function LetterModal({ index, title, sender, message, song, onClose, onStopMusic }) {
  const closeRef = useRef(null)
  const cardRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && cardRef.current) {
        const focusable = cardRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={cardRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Tutup surat"
        >
          {'\u2715'}
        </button>
        <h2 id="modal-title" className="modal-title">
          {title || `Surat #${index + 1}`}
        </h2>
        <p className="modal-subtitle">
          {sender ? `dari ${sender}` : 'untuk kalian, para pendahulu'}
        </p>
        <p className="modal-message">{message}</p>
        <MusicPlayer song={song} onStop={onStopMusic} />
      </div>
    </div>
  )
}

export default LetterModal

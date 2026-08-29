import { useEffect, useMemo, useRef } from 'react'

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

const HEARTS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: 4 + (i * 7) % 92,
  size: 14 + ((i * 13) % 22),
  duration: 7 + ((i * 5) % 9),
  delay: -((i * 2.3) % 10),
}))

function buildMotion(count) {
  const rng = mulberry32(20260829)
  const isMobile = window.matchMedia('(max-width: 640px)').matches
  return Array.from({ length: count }, (_, i) => {
    const depth = 0.6 + rng() * 1.4
    const speed = 35 + rng() * 90
    const angle = rng() * Math.PI * 2
    return {
      id: i,
      x: window.innerWidth * (0.05 + rng() * 0.9),
      y: window.innerHeight * (0.1 + rng() * 0.8),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: (rng() - 0.5) * 30,
      rotSpeed: (rng() - 0.5) * 55,
      depth,
      zIndex: Math.round(depth * 10),
      w: isMobile ? 88 : 140,
      h: isMobile ? 116 : 182,
    }
  })
}

function FloatingLetters({ count = 22, onOpen }) {
  const cards = useMemo(() => buildMotion(count), [count])
  const state = useMemo(() => cards.map((c) => ({ ...c })), [cards])
  const driftEls = useRef([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let raf = 0
    let last = performance.now()

    const onResize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      for (const c of state) {
        c.x = clamp(c.x, 0, vw - c.w)
        c.y = clamp(c.y, 0, vh - c.h)
      }
    }
    window.addEventListener('resize', onResize)

    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const vw = window.innerWidth
      const vh = window.innerHeight
      state.forEach((c, i) => {
        const el = driftEls.current[i]
        if (!el) return
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.rot += c.rotSpeed * dt
        if (c.x < 0) {
          c.x = 0
          c.vx = Math.abs(c.vx)
        } else if (c.x > vw - c.w) {
          c.x = vw - c.w
          c.vx = -Math.abs(c.vx)
        }
        if (c.y < 0) {
          c.y = 0
          c.vy = Math.abs(c.vy)
        } else if (c.y > vh - c.h) {
          c.y = vh - c.h
          c.vy = -Math.abs(c.vy)
        }
        el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0) rotate(${c.rot}deg)`
      })
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [state])

  return (
    <div className="letters-stage stage-enter">
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
      <header className="letters-header">
        <h2>
          Surat untuk <em>Kalian</em>
        </h2>
        <p>pilih salah satu surat untuk membukanya {'\u2665'}</p>
      </header>
      {cards.map((card, i) => (
        <div
          key={card.id}
          className="letter-card-wrap"
          style={{ '--depth': card.depth, zIndex: card.zIndex }}
        >
          <div
            ref={(el) => {
              driftEls.current[i] = el
            }}
            className="letter-card-drift"
          >
            <button
              type="button"
              className="letter-card"
              onClick={() => onOpen(card.id)}
              aria-label={`Buka surat nomor ${card.id + 1}`}
            >
              <span className="letter-card-label">Surat {card.id + 1}</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default FloatingLetters

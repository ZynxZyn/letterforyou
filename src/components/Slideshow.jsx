import { useEffect, useMemo, useRef, useState } from 'react'

const images = Object.entries(
  import.meta.glob('../assets/images/*', {
    eager: true,
    query: '?url',
    import: 'default',
  })
).map(([, src]) => src)

const INTERVAL = 4000
const FLY_MS = 3600

function FlyTransition() {
  const streaks = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        x: 1 + ((i * 29) % 98),
        len: 60 + ((i * 29) % 150),
        dur: (0.3 + ((i * 7) % 32) / 100).toFixed(2),
        delay: (((i % 11) * 0.04) + ((i % 5) * 0.015)).toFixed(2),
      })),
    []
  )

  const wake = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const off = i - 5
        return {
          id: i,
          len: 34 + (5 - Math.abs(off)) * 9,
          tilt: off * 5,
          delay: ((Math.abs(off) % 3) * 0.02).toFixed(2),
          red: off % 2 === 0,
        }
      }),
    []
  )

  return (
    <div className="fly-overlay" aria-hidden="true">
      <div className="fly-sky" />
      <div className="fly-bg">
        <div className="fly-atmo" />
        <div className="fly-streaks">
          {streaks.map((s) => (
            <span
              key={s.id}
              style={{
                '--sx': `${s.x}%`,
                '--sl': `${s.len}px`,
                '--sd': `${s.dur}s`,
                '--sdelay': `${s.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="fly-heat" />
      </div>
      <div className="fly-rocket">
        <div className="fly-paper" />
        <div className="fly-wake">
          {wake.map((w) => (
            <span
              key={w.id}
              className={w.red ? 'is-red' : ''}
              style={{
                '--wlen': `${w.len}px`,
                '--wtilt': `${w.tilt}deg`,
                '--wdelay': `${w.delay}s`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="fly-progress">
        <span />
      </div>
      <div className="fly-flash" />
    </div>
  )
}

function Slideshow({ onComplete }) {
  const [current, setCurrent] = useState(0)
  const [flying, setFlying] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (images.length === 0) return undefined
    const t = setInterval(() => setCurrent((c) => (c + 1) % images.length), INTERVAL)
    return () => clearInterval(t)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const flyToLetters = () => {
    if (flying) return
    setFlying(true)
    timerRef.current = setTimeout(onComplete, FLY_MS)
  }

  if (images.length === 0) {
    return (
      <div className="slideshow-empty stage-enter">
        <span className="big-heart" aria-hidden="true">
          {'\u2665'}
        </span>
        <h2>Galeri Kenangan</h2>
        <p>
          Belum ada foto. Tambahkan foto ke folder{' '}
          <code>src/assets/images/</code> dan foto akan muncul otomatis di sini.
        </p>
        <button type="button" className="btn-primary" onClick={flyToLetters}>
          Lanjut ke Surat {'\u2192'}
        </button>
        {flying && <FlyTransition />}
      </div>
    )
  }

  return (
    <div className="slideshow stage-enter">
      <p className="slideshow-index" aria-live="polite">
        {current + 1} / {images.length}
      </p>
      <div className="slideshow-dots" role="tablist" aria-label="Pilih foto">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === current}
            aria-label={`Foto ${i + 1}`}
            className={i === current ? 'is-active' : ''}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>
      {images.map((src, i) => (
        <div
          key={src}
          className={`slide ${i === current ? 'is-active' : ''}`}
          aria-hidden={i !== current}
        >
          <img src={src} alt={`Kenangan ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
        </div>
      ))}
      <div className="slideshow-actions">
        <button type="button" className="btn-primary" onClick={flyToLetters}>
          Lanjut ke Surat {'\u2192'}
        </button>
      </div>
      {flying && <FlyTransition />}
    </div>
  )
}

export default Slideshow

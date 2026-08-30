import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getImageItems, loadRemoteImages } from '../data/images'

const CAROUSEL_MS = 2600
const FLY_MS = 3600

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function animateScrollTo(container, target, duration, onDone) {
  if (!container) return () => {}
  const start = container.scrollTop
  const delta = target - start
  if (Math.abs(delta) < 1) {
    if (onDone) onDone()
    return () => {}
  }
  const t0 = performance.now()
  let raf = 0
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration)
    container.scrollTop = start + delta * easeInOutCubic(p)
    if (p < 1) raf = requestAnimationFrame(step)
    else if (onDone) onDone()
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}

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

function Carousel({ images: imgs, onDone }) {
  const trackRef = useRef(null)
  const loopsRef = useRef(0)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const t = setInterval(() => {
      const track = trackRef.current
      if (!track) return
      const max = track.scrollWidth - track.clientWidth
      if (track.scrollLeft >= max - 8) {
        track.scrollTo({ left: 0, behavior: 'smooth' })
        loopsRef.current += 1
        if (loopsRef.current >= 2 && !doneRef.current) {
          doneRef.current = true
          onDoneRef.current()
        }
      } else {
        track.scrollBy({ left: track.clientWidth * 0.85, behavior: 'smooth' })
      }
    }, CAROUSEL_MS)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="carousel" ref={trackRef} aria-label="Galeri kenangan">
      {imgs.map((item, i) => (
        <img
          key={item.name}
          src={item.src}
          alt={`Kenangan ${i + 1}`}
          loading="lazy"
          draggable="false"
        />
      ))}
    </div>
  )
}

function Slideshow({ onComplete }) {
  const containerRef = useRef(null)
  const sectionRefs = useRef([])
  const timerRef = useRef(null)
  const flyingRef = useRef(false)
  const scrollCancelRef = useRef(null)

  const [flying, setFlying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [items, setItems] = useState(() => getImageItems())
  const reduced = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )
  const isMobile = useMemo(() => window.matchMedia('(max-width: 640px)').matches, [])
  const [autoActive, setAutoActive] = useState(() => !reduced && items.length > 0)
  const autoRef = useRef(autoActive)

  useEffect(() => {
    autoRef.current = autoActive
  }, [autoActive])

  useEffect(() => {
    let active = true
    loadRemoteImages().then(() => {
      if (!active) return
      const imgs = getImageItems()
      setItems(imgs)
      if (imgs.length > 0) setAutoActive((prev) => prev || !reduced)
    })
    return () => {
      active = false
    }
  }, [reduced])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const flyToLetters = useCallback(() => {
    if (flyingRef.current) return
    flyingRef.current = true
    setFlying(true)
    timerRef.current = setTimeout(onComplete, FLY_MS)
  }, [onComplete])

  const scrollToSection = useCallback((el, duration, onDone) => {
    const container = containerRef.current
    if (!container || !el) {
      if (onDone) onDone()
      return
    }
    if (scrollCancelRef.current) scrollCancelRef.current()
    const target =
      container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top
    scrollCancelRef.current = animateScrollTo(container, target, duration, onDone)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const cancel = () => setAutoActive(false)
    el.addEventListener('wheel', cancel, { passive: true })
    el.addEventListener('touchstart', cancel, { passive: true })
    el.addEventListener('pointerdown', cancel)
    return () => {
      el.removeEventListener('wheel', cancel)
      el.removeEventListener('touchstart', cancel)
      el.removeEventListener('pointerdown', cancel)
    }
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible')
        })
      },
      { threshold: 0.25 }
    )
    sectionRefs.current.forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [items.length])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const ratio = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)
        setProgress(Math.min(1, ratio))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    if (!autoActive || items.length === 0) return undefined
    const el = containerRef.current
    if (!el) return undefined
    let raf = 0
    let last = performance.now()
    const speed = isMobile ? 100 : 130

    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const max = el.scrollHeight - el.clientHeight
      if (el.scrollTop < max) {
        el.scrollTop = Math.min(max, el.scrollTop + speed * dt)
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [autoActive, isMobile, items.length])

  const finishAuto = useCallback(() => {
    if (!autoRef.current) return
    const btn = sectionRefs.current[sectionRefs.current.length - 1]
    if (!btn) return
    scrollToSection(btn, 1400, () => {
      timerRef.current = setTimeout(() => {
        if (autoRef.current) flyToLetters()
      }, 1200)
    })
  }, [scrollToSection, flyToLetters])

  const onCarouselDone = useCallback(() => finishAuto(), [finishAuto])

  if (items.length === 0) {
    return (
      <div className="slideshow-empty stage-enter">
        <span className="big-heart" aria-hidden="true">
          {'\u2665'}
        </span>
        <h2>Galeri Kenangan</h2>
        <p>
          Belum ada foto. Tambahkan foto lewat dashboard{' '}
          <code>(?dashboard)</code> atau folder <code>src/assets/images/</code>.
        </p>
        <button type="button" className="btn-primary" onClick={flyToLetters}>
          Lanjut ke Surat {'\u2192'}
        </button>
        {flying && createPortal(<FlyTransition />, document.body)}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`slideshow stage-enter ${flying ? 'is-flying' : ''}`}
    >
      <div className="slideshow-progress" aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      {items.map((item, i) => (
        <section
          key={item.name}
          ref={(el) => {
            sectionRefs.current[i] = el
          }}
          className="slide-section"
          aria-label={`Kenangan ${i + 1}`}
        >
          <img src={item.src} alt={`Kenangan ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
        </section>
      ))}
      <section
        ref={(el) => {
          sectionRefs.current[items.length] = el
        }}
        className="slideshow-end"
      >
        <h2>
          <em>TOSLA</em> SATU
        </h2>
        <p className="slideshow-end-sub">Romong Lakuma Detule Dehasa Mangiso Pasu pasu Ngimbawe Bau-bau Kumantara</p>
        <Carousel images={items} onDone={onCarouselDone} />
        <button type="button" className="btn-primary" onClick={flyToLetters}>
          Berikutnya {'\u2192'}
        </button>
      </section>
      {flying && createPortal(<FlyTransition />, document.body)}
    </div>
  )
}

export default Slideshow

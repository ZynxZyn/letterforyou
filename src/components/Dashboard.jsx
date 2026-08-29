import { useEffect, useState } from 'react'
import { R2_BASE, getLetterSongs, getSongs, loadRemoteState } from '../data/songs'

const LETTER_COUNT = 22
const AUDIO_RE = /\.(mp3|wav|ogg|m4a|flac|aac)$/i
const REMOTE = Boolean(R2_BASE)
const AUTH = { Authorization: `Bearer ${import.meta.env.VITE_R2_KEY || ''}` }

function reloadSoon(ms = 600) {
  setTimeout(() => window.location.reload(), ms)
}

function Dashboard() {
  const [songs, setSongs] = useState([])
  const [mapping, setMapping] = useState({})
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadRemoteState().then(() => {
      setSongs(getSongs())
      setMapping(getLetterSongs())
    })
  }, [])

  const upload = async (file) => {
    const url = REMOTE
      ? `${R2_BASE}/api/upload?name=${encodeURIComponent(file.name)}`
      : `/__upload?name=${encodeURIComponent(file.name)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: REMOTE ? AUTH : undefined,
      body: file,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data && data.error) || 'Upload gagal')
    }
  }

  const onDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    if (busy) return
    const files = Array.from(e.dataTransfer.files).filter((f) => AUDIO_RE.test(f.name))
    if (!files.length) {
      setMessage('Tidak ada file audio yang valid (mp3/wav/ogg/m4a/flac/aac).')
      return
    }
    setBusy(true)
    setMessage(`Mengunggah ${files.length} lagu…`)
    try {
      for (const f of files) await upload(f)
      setMessage('Upload selesai. Halaman dimuat ulang…')
      reloadSoon()
    } catch (err) {
      setMessage(`Gagal: ${err.message}`)
      setBusy(false)
    }
  }

  const saveMapping = async (next) => {
    if (REMOTE) {
      const res = await fetch(`${R2_BASE}/api/config`, {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ letterSongs: next }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan pemetaan')
    } else {
      const res = await fetch('/__setmapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error('Gagal menyimpan pemetaan')
    }
  }

  const onMappingChange = async (num, file) => {
    if (saving) return
    setSaving(num)
    setMessage('Menyimpan pemetaan…')
    try {
      await saveMapping({ ...mapping, [num]: file })
      setMessage('Pemetaan tersimpan. Halaman dimuat ulang…')
      reloadSoon()
    } catch (err) {
      setMessage(`Gagal: ${err.message}`)
      setSaving(null)
    }
  }

  const removeSong = async (file) => {
    setMessage(`Menghapus ${file}…`)
    if (REMOTE) {
      await fetch(`${R2_BASE}/api/delete?name=${encodeURIComponent(file)}`, {
        method: 'DELETE',
        headers: AUTH,
      })
    } else {
      await fetch(`/__delete?name=${encodeURIComponent(file)}`, { method: 'POST' })
    }
    reloadSoon(400)
  }

  return (
    <div className="dashboard stage-enter">
      <header className="dash-topbar">
        <h1 className="dash-title">
          LetterForYou <span className="dash-title-sub">Dashboard</span>
        </h1>
        <div className="dash-topbar-actions">
          <span className={`dash-badge ${REMOTE ? 'is-remote' : ''}`}>
            {REMOTE ? 'Cloudflare R2' : 'Lokal'}
          </span>
          <a className="dash-link" href={REMOTE ? '/' : '/?dev'}>
            {'\u2190'} Kembali ke situs
          </a>
        </div>
      </header>

      {message && <div className="dash-msg">{message}</div>}

      <section className="dash-card">
        <h2 className="dash-card-title">Upload Lagu</h2>
        <p className="dash-card-desc">
          Seret file lagu ke dalam kotak. Format yang didukung: mp3, wav, ogg, m4a, flac, aac.
        </p>
        <div
          className={`dash-dropzone ${dragOver ? 'is-dragover' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {busy ? (
            <p className="dash-drop-text">Mengunggah…</p>
          ) : (
            <p className="dash-drop-text">
              <span className="dash-drop-icon">{'\u2191'}</span>
              <strong>Seret & lepas file lagu di sini</strong>
            </p>
          )}
        </div>
      </section>

      <section className="dash-card">
        <h2 className="dash-card-title">
          Lagu Tersedia <span className="dash-count">{songs.length}</span>
        </h2>
        {songs.length === 0 ? (
          <p className="dash-empty">Belum ada lagu.</p>
        ) : (
          <div className="dash-songs">
            {songs.map((s) => (
              <span key={s.file} className="dash-song" title={s.title}>
                <span className="dash-song-name">{s.file}</span>
                <button
                  type="button"
                  className="dash-song-del"
                  onClick={() => removeSong(s.file)}
                  aria-label={`Hapus ${s.file}`}
                >
                  {'\u2715'}
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="dash-card">
        <h2 className="dash-card-title">
          Lagu per Surat <span className="dash-count">1–{LETTER_COUNT}</span>
        </h2>
        <p className="dash-card-desc">
          Pilih lagu untuk tiap amplop. Pilih «otomatis» untuk memakai giliran.
        </p>
        <div className="dash-grid">
          {Array.from({ length: LETTER_COUNT }, (_, i) => {
            const num = i + 1
            return (
              <div key={num} className="dash-row">
                <label htmlFor={`map-${num}`}>Surat {num}</label>
                <select
                  id={`map-${num}`}
                  value={mapping[num] || ''}
                  disabled={saving === num}
                  onChange={(e) => onMappingChange(num, e.target.value)}
                >
                  <option value="">Otomatis</option>
                  {songs.map((s) => (
                    <option key={s.file} value={s.file}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default Dashboard

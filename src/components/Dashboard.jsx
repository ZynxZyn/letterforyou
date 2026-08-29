import { useEffect, useRef, useState } from 'react'
import {
  createLetter,
  deleteLetter,
  getLetterRows,
  lettersAreSeeded,
  loadRemoteLetters,
  saveLetter,
  seedLetters,
} from '../data/letters'
import { R2_BASE, NO_SONG, getLetterSongs, getSongs, loadRemoteState } from '../data/songs'
import {
  cropAudio,
  decodeBuffer,
  encodeMp3,
  encodeWav,
  fetchAudioBuffer,
  fmtDur,
  parseTime,
} from '../utils/cropAudio'

const AUDIO_RE = /\.(mp3|wav|ogg|m4a|flac|aac)$/i
const REMOTE = Boolean(R2_BASE)
const AUTH = { Authorization: `Bearer ${import.meta.env.VITE_R2_KEY || ''}` }

function reloadSoon(ms = 600) {
  setTimeout(() => window.location.reload(), ms)
}

function Dashboard() {
  const [songs, setSongs] = useState([])
  const [mapping, setMapping] = useState({})
  const [letters, setLetters] = useState([])
  const [seeded, setSeeded] = useState(false)
  const [drafts, setDrafts] = useState({})
  const [songDrafts, setSongDrafts] = useState({})
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [savingLetter, setSavingLetter] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')

  const [cropFile, setCropFile] = useState('')
  const [cropBuf, setCropBuf] = useState(null)
  const [cropDur, setCropDur] = useState(0)
  const [cropStart, setCropStart] = useState('0:00')
  const [cropEnd, setCropEnd] = useState('')
  const [cropFormat, setCropFormat] = useState('mp3')
  const [cropKbps, setCropKbps] = useState('96')
  const [cropBusy, setCropBusy] = useState(false)
  const previewRef = useRef(null)

  useEffect(() => {
    Promise.all([loadRemoteState(), loadRemoteLetters()]).then(() => {
      setSongs(getSongs())
      setMapping(getLetterSongs())
      setLetters(getLetterRows())
      setSeeded(lettersAreSeeded())
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

  const onSaveLetter = async (id) => {
    if (savingLetter || !REMOTE) return
    setSavingLetter(id)
    setMessage(`Menyimpan Surat ${id}…`)
    try {
      const msg = drafts[id] ?? letters.find((r) => r.id === id)?.message ?? ''
      const song = songDrafts[id] ?? mapping[id] ?? ''
      await Promise.all([
        saveLetter(id, msg),
        saveMapping({ ...mapping, [id]: song }),
      ])
      setMessage(`Surat ${id} tersimpan. Halaman dimuat ulang…`)
      reloadSoon()
    } catch (err) {
      setMessage(`Gagal: ${err.message}`)
      setSavingLetter(null)
    }
  }

  const onSeed = async () => {
    if (seeding || !REMOTE) return
    setSeeding(true)
    setMessage('Menyimpan 22 surat bawaan ke Neon…')
    try {
      await seedLetters()
      setMessage('Selesai. Halaman dimuat ulang…')
      reloadSoon()
    } catch (err) {
      setMessage(`Gagal: ${err.message}`)
      setSeeding(false)
    }
  }

  const onAddLetter = async () => {
    if (adding || !REMOTE) return
    setAdding(true)
    setMessage('Menambahkan surat baru…')
    try {
      await createLetter('')
      setMessage('Surat baru ditambahkan. Halaman dimuat ulang…')
      reloadSoon()
    } catch (err) {
      setMessage(`Gagal: ${err.message}`)
      setAdding(false)
    }
  }

  const onDeleteLetter = async (id) => {
    if (!REMOTE) return
    if (!window.confirm(`Hapus Surat ${id}? Tindakan ini tidak bisa dibatalkan.`)) return
    setMessage(`Menghapus Surat ${id}…`)
    try {
      await deleteLetter(id)
      setMessage(`Surat ${id} dihapus. Halaman dimuat ulang…`)
      reloadSoon()
    } catch (err) {
      setMessage(`Gagal: ${err.message}`)
    }
  }

  const onCropPick = async (file) => {
    setCropFile(file)
    setCropBuf(null)
    setCropDur(0)
    if (!file) return
    const song = songs.find((s) => s.file === file)
    if (!song) return
    try {
      const raw = await fetchAudioBuffer(song.src)
      const buf = await decodeBuffer(raw)
      setCropBuf(buf)
      setCropDur(buf.duration)
      setCropStart('0:00')
      setCropEnd(fmtDur(Math.min(90, buf.duration)))
    } catch (err) {
      setMessage(`Gagal memuat lagu: ${err.message}`)
    }
  }

  const onPreview = () => {
    const audio = previewRef.current
    const song = songs.find((s) => s.file === cropFile)
    const start = parseTime(cropStart)
    if (!audio || !song || start == null) return
    audio.src = song.src
    audio.currentTime = start
    const end = parseTime(cropEnd)
    const stop = () => {
      if (end != null && audio.currentTime >= end) {
        audio.pause()
        audio.removeEventListener('timeupdate', stop)
      }
    }
    audio.addEventListener('timeupdate', stop)
    audio.play().catch(() => {})
  }

  const onCropSave = async () => {
    if (!cropBuf || cropBusy) return
    const start = parseTime(cropStart) ?? 0
    const end = parseTime(cropEnd) ?? cropBuf.duration
    if (end <= start) {
      setMessage('Waktu akhir harus lebih besar dari waktu awal.')
      return
    }
    setCropBusy(true)
    setMessage('Memotong lagu…')
    try {
      const cropped = await cropAudio(cropBuf, start, end, { sampleRate: 22050 })
      const blob =
        cropFormat === 'wav' ? encodeWav(cropped) : encodeMp3(cropped, Number(cropKbps))
      const base = cropFile.replace(/\.[^.]+$/, '')
      const name = `${base} [${fmtDur(start)}-${fmtDur(end)}].${cropFormat}`
      await upload(new File([blob], name, { type: blob.type }))
      setMessage(`Lagu terpotong disimpan (${name}). Halaman dimuat ulang…`)
      reloadSoon()
    } catch (err) {
      setMessage(`Gagal memotong: ${err.message}`)
      setCropBusy(false)
    }
  }

  return (
    <div className="dashboard stage-enter">
      <header className="dash-topbar">
        <h1 className="dash-title">
          LetterForYou <span className="dash-title-sub">Dashboard</span>
        </h1>
        <div className="dash-topbar-actions">
          <span className={`dash-badge ${REMOTE ? 'is-remote' : ''}`}>
            {REMOTE ? 'Cloudflare R2 + Neon' : 'Lokal'}
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
        <h2 className="dash-card-title">Potong Lagu</h2>
        <p className="dash-card-desc">
          Pilih lagu, tentukan bagian menit-ke-menit, lalu potong. Output mono 22.05 kHz agar
          ukurannya kecil (MP3 lebih ringkas dari WAV).
        </p>
        <div className="dash-crop">
          <div className="dash-crop-row">
            <label htmlFor="crop-song">Lagu</label>
            <select
              id="crop-song"
              value={cropFile}
              disabled={cropBusy}
              onChange={(e) => onCropPick(e.target.value)}
            >
              <option value="">— pilih lagu —</option>
              {songs.map((s) => (
                <option key={s.file} value={s.file}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          {cropDur > 0 && (
            <>
              <p className="dash-crop-dur">Durasi lagu: {fmtDur(cropDur)}</p>
              <div className="dash-crop-row">
                <label htmlFor="crop-start">Dari</label>
                <input
                  id="crop-start"
                  value={cropStart}
                  disabled={cropBusy}
                  onChange={(e) => setCropStart(e.target.value)}
                  placeholder="0:00"
                />
                <label htmlFor="crop-end">Sampai</label>
                <input
                  id="crop-end"
                  value={cropEnd}
                  disabled={cropBusy}
                  onChange={(e) => setCropEnd(e.target.value)}
                  placeholder={fmtDur(cropDur)}
                />
                <button
                  type="button"
                  className="dash-btn-ghost"
                  onClick={onPreview}
                  title="Putar bagian yang dipilih"
                >
                  {'\u25B6'} Putar
                </button>
              </div>
              <div className="dash-crop-row">
                <label htmlFor="crop-format">Format</label>
                <select
                  id="crop-format"
                  value={cropFormat}
                  disabled={cropBusy}
                  onChange={(e) => setCropFormat(e.target.value)}
                >
                  <option value="mp3">MP3 (kecil)</option>
                  <option value="wav">WAV</option>
                </select>
                <label htmlFor="crop-kbps">Bitrate</label>
                <select
                  id="crop-kbps"
                  value={cropKbps}
                  disabled={cropBusy || cropFormat !== 'mp3'}
                  onChange={(e) => setCropKbps(e.target.value)}
                >
                  <option value="64">64 kbps</option>
                  <option value="96">96 kbps</option>
                  <option value="128">128 kbps</option>
                </select>
                <button
                  type="button"
                  className="dash-add-btn"
                  disabled={cropBusy}
                  onClick={onCropSave}
                >
                  {cropBusy ? 'Memotong…' : 'Potong & Simpan'}
                </button>
              </div>
            </>
          )}
        </div>
        <audio ref={previewRef} style={{ display: 'none' }} />
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
        <div className="dash-card-head">
          <h2 className="dash-card-title">
            Surat & Lagu <span className="dash-count">{letters.length}</span>
          </h2>
          <button
            type="button"
            className="dash-add-btn"
            disabled={!REMOTE || adding}
            onClick={onAddLetter}
          >
            {'\u002B'} Tambah Surat
          </button>
        </div>
        <p className="dash-card-desc">
          {REMOTE
            ? 'Tulis isi surat dan pilih lagunya dalam satu baris, lalu klik Simpan (keduanya tersimpan sekaligus ke Neon + R2).'
            : 'Mode lokal: pengelolaan surat & lagu memerlukan R2 + Neon (set VITE_R2_BASE & secret DATABASE_URL).'}
        </p>
        {REMOTE && !seeded && (
          <div className="dash-banner">
            <p>Database Neon masih kosong — salin 22 surat bawaan agar bisa diedit.</p>
            <button type="button" className="dash-add-btn" disabled={seeding} onClick={onSeed}>
              {seeding ? 'Menyimpan…' : 'Simpan Semua Surat'}
            </button>
          </div>
        )}
        <div className="dash-letters">
          {letters.map((row) => {
            const value = drafts[row.id] ?? row.message
            const songValue = songDrafts[row.id] ?? mapping[row.id] ?? ''
            const dirty = value !== row.message || songValue !== (mapping[row.id] ?? '')
            return (
              <div key={row.id} className="dash-letter">
                <div className="dash-letter-head">
                  <label htmlFor={`letter-${row.id}`}>Surat {row.id}</label>
                  <div className="dash-letter-actions">
                    <button
                      type="button"
                      className="dash-letter-del"
                      disabled={!REMOTE}
                      onClick={() => onDeleteLetter(row.id)}
                      aria-label={`Hapus Surat ${row.id}`}
                    >
                      {'\uD83D\uDDD1'}
                    </button>
                    <button
                      type="button"
                      className="dash-letter-save"
                      disabled={!REMOTE || savingLetter === row.id || !dirty}
                      onClick={() => onSaveLetter(row.id)}
                    >
                      {savingLetter === row.id ? 'Menyimpan…' : 'Simpan'}
                    </button>
                  </div>
                </div>
                <textarea
                  id={`letter-${row.id}`}
                  value={value}
                  disabled={!REMOTE}
                  onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                  rows={3}
                />
                <div className="dash-letter-song">
                  <label htmlFor={`map-${row.id}`}>Lagu</label>
                  <select
                    id={`map-${row.id}`}
                    value={songValue}
                    disabled={!REMOTE || savingLetter === row.id}
                    onChange={(e) => setSongDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                  >
                    <option value="">Otomatis (giliran)</option>
                    <option value={NO_SONG}>Tanpa Lagu</option>
                    {songs.map((s) => (
                      <option key={s.file} value={s.file}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

export default Dashboard

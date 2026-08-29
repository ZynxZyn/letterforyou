const audioFiles = import.meta.glob('../assets/audio/*', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const R2_BASE = (import.meta.env.VITE_R2_BASE || '').replace(/\/+$/, '')

function titleFrom(file) {
  return file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
}

const localSongs = Object.keys(audioFiles)
  .sort()
  .map((path, i) => ({
    id: i + 1,
    file: path.split('/').pop(),
    title: titleFrom(path.split('/').pop()),
    src: audioFiles[path],
  }))

// Atur sendiri pemetaan lagu per surat (mode lokal, tanpa R2).
// Kunci = nomor surat (1-22), nilai = nama file lagu di src/assets/audio/
export const letterSongs = {
  1: 'contoh-melodi.wav',
}

let remoteState = null
let remotePromise = null

export function loadRemoteState() {
  if (!R2_BASE) return Promise.resolve(null)
  if (remoteState) return Promise.resolve(remoteState)
  if (!remotePromise) {
    remotePromise = fetch(`${R2_BASE}/api/state`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((state) => {
        remoteState = state
        return state
      })
  }
  return remotePromise
}

export function getSongs() {
  if (remoteState && remoteState.files) {
    return remoteState.files.map((file, i) => ({
      id: i + 1,
      file,
      title: titleFrom(file),
      src: `${R2_BASE}/audio/${encodeURIComponent(file)}`,
    }))
  }
  return localSongs
}

export function getLetterSongs() {
  if (remoteState && remoteState.letterSongs) return remoteState.letterSongs
  return letterSongs
}

export const NO_SONG = '__none__'

export function getSongForLetter(number) {
  const songs = getSongs()
  const mapped = getLetterSongs()[number]
  if (mapped === NO_SONG) return null
  if (mapped) {
    const found = songs.find((s) => s.file.toLowerCase() === String(mapped).toLowerCase())
    if (found) return found
  }
  return songs.length ? songs[(number - 1) % songs.length] : null
}

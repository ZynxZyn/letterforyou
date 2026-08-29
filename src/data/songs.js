const audioFiles = import.meta.glob('../assets/audio/*', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const songs = Object.keys(audioFiles)
  .sort()
  .map((path, i) => ({
    id: i + 1,
    file: path.split('/').pop(),
    title: path
      .split('/')
      .pop()
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' '),
    src: audioFiles[path],
  }))

// Atur sendiri pemetaan lagu per surat.
// Kunci = nomor surat (1-22), nilai = nama file lagu di src/assets/audio/
// Contoh:
//   1: 'contoh-melodi.wav',
//   2: 'lagu-untuk-surat-2.mp3',
export const letterSongs = {
  1: 'contoh-melodi.wav',
}

export function getSongForLetter(number) {
  const mapped = letterSongs[number]
  if (mapped) {
    const found = songs.find((s) => s.file.toLowerCase() === mapped.toLowerCase())
    if (found) return found
  }
  return songs.length ? songs[(number - 1) % songs.length] : null
}

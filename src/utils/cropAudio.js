import { Mp3Encoder } from '@breezystack/lamejs'

export async function fetchAudioBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal memuat lagu')
  return res.arrayBuffer()
}

export async function decodeBuffer(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()
  try {
    return await ctx.decodeAudioData(arrayBuffer)
  } finally {
    ctx.close()
  }
}

export async function cropAudio(buffer, startSec, endSec, { sampleRate = 22050 } = {}) {
  const start = Math.max(0, Math.min(startSec, buffer.duration))
  const end = Math.max(start + 0.05, Math.min(endSec, buffer.duration))
  const length = Math.max(1, Math.floor((end - start) * sampleRate))
  const offCtx = new OfflineAudioContext(1, length, sampleRate)
  const src = offCtx.createBufferSource()
  src.buffer = buffer
  src.connect(offCtx.destination)
  src.start(0, start, end - start)
  return offCtx.startRendering()
}

function toInt16(float32) {
  const out = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
  }
  return out
}

export function encodeMp3(buffer, kbps = 96) {
  const samples = toInt16(buffer.getChannelData(0))
  const encoder = new Mp3Encoder(1, buffer.sampleRate, kbps)
  const blocks = []
  const BLOCK = 1152
  for (let i = 0; i < samples.length; i += BLOCK) {
    const chunk = encoder.encodeBuffer(samples.subarray(i, i + BLOCK))
    if (chunk.length > 0) blocks.push(new Int8Array(chunk))
  }
  const end = encoder.flush()
  if (end.length > 0) blocks.push(new Int8Array(end))
  return new Blob(blocks, { type: 'audio/mpeg' })
}

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

export function encodeWav(buffer) {
  const data = buffer.getChannelData(0)
  const numSamples = data.length
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const byteRate = buffer.sampleRate * blockAlign
  const buf = new ArrayBuffer(44 + numSamples * bytesPerSample)
  const view = new DataView(buf)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + numSamples * bytesPerSample, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, numSamples * bytesPerSample, true)
  let offset = 44
  for (let i = 0; i < numSamples; i += 1) {
    const s = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

export function fmtDur(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function parseTime(text) {
  const parts = String(text).trim().split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return null
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

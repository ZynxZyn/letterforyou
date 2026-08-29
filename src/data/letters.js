import { letter, messages } from './messages'
import { R2_BASE } from './songs'

export const defaultLetters = [letter, ...messages.slice(0, 21)]

const AUTH = { Authorization: `Bearer ${import.meta.env.VITE_R2_KEY || ''}` }

let remote = null
let remotePromise = null

export function loadRemoteLetters() {
  if (!R2_BASE) return Promise.resolve(null)
  if (remote) return Promise.resolve(remote)
  if (!remotePromise) {
    remotePromise = fetch(`${R2_BASE}/api/letters`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => {
        remote = data
          ? {
              seeded: Boolean(data.seeded),
              rows: Array.isArray(data.letters)
                ? data.letters
                    .map((r) => ({ id: Number(r.id), message: String(r.message) }))
                    .sort((a, b) => a.id - b.id)
                : [],
            }
          : null
        return remote
      })
  }
  return remotePromise
}

export function lettersAreSeeded() {
  return Boolean(remote && remote.seeded)
}

export function getLetterRows() {
  if (!remote || !remote.seeded) {
    return defaultLetters.map((message, i) => ({ id: i + 1, message }))
  }
  return remote.rows
}

export function getLetters() {
  return getLetterRows().map((r) => r.message)
}

export function getLetterForCard(number) {
  const all = getLetters()
  return all[number - 1] || ''
}

async function request(url, body, method = 'POST') {
  const res = await fetch(url, {
    method,
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data && data.error) || 'Request gagal')
  }
  return res.json().catch(() => ({}))
}

export async function saveLetter(id, message) {
  await request(`${R2_BASE}/api/letters`, { letters: { [id]: message } })
}

export async function seedLetters() {
  const letters = {}
  defaultLetters.forEach((msg, i) => {
    letters[i + 1] = msg
  })
  await request(`${R2_BASE}/api/letters`, { letters })
}

export async function createLetter(message = '') {
  const data = await request(`${R2_BASE}/api/letters/create`, { message })
  return data.id
}

export async function deleteLetter(id) {
  await request(`${R2_BASE}/api/letters?id=${encodeURIComponent(id)}`, {}, 'DELETE')
}

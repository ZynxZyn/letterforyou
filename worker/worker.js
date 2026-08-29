import { neon } from '@neondatabase/serverless'

function sanitizeName(name) {
  const base = String(name || '').split('/').pop().split('\\').pop()
  if (!base || base.startsWith('.')) return null
  for (let i = 0; i < base.length; i += 1) {
    const code = base.charCodeAt(i)
    if (code < 32 || code === 127) return null
  }
  return base
}

function mimeFor(name) {
  const ext = name.split('.').pop().toLowerCase()
  const map = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    aac: 'audio/aac',
  }
  return map[ext] || 'application/octet-stream'
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function db(env) {
  return neon(env.DATABASE_URL)
}

async function ensureLettersTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS letters (id integer PRIMARY KEY, message text NOT NULL)`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const cors = { ...CORS }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const handle = (status, payload) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })

    const authed = () =>
      (request.headers.get('Authorization') || '') === `Bearer ${env.API_KEY}`

    try {
      const audioMatch = url.pathname.match(/^\/audio\/(.+)$/)
      if (audioMatch && request.method === 'GET') {
        const name = decodeURIComponent(audioMatch[1])
        const obj = await env.BUCKET.get(name)
        if (!obj) return new Response('not found', { status: 404, headers: cors })
        const baseHeaders = {
          ...cors,
          'Content-Type': mimeFor(name),
          'Cache-Control': 'public, max-age=86400',
          'Accept-Ranges': 'bytes',
        }
        const range = request.headers.get('Range')
        if (range) {
          const match = /^bytes=(\d+)-(\d*)$/.exec(range)
          const start = match ? Math.min(Number(match[1]), obj.size - 1) : 0
          const end =
            match && match[2] ? Math.min(Number(match[2]), obj.size - 1) : obj.size - 1
          if (start > end) {
            return new Response(null, {
              status: 416,
              headers: { ...baseHeaders, 'Content-Range': `bytes */${obj.size}` },
            })
          }
          const sliced = await env.BUCKET.get(name, {
            range: { offset: start, length: end - start + 1 },
          })
          return new Response(sliced.body, {
            status: 206,
            headers: {
              ...baseHeaders,
              'Content-Range': `bytes ${start}-${end}/${obj.size}`,
              'Content-Length': String(end - start + 1),
            },
          })
        }
        return new Response(obj.body, {
          headers: { ...baseHeaders, 'Content-Length': String(obj.size) },
        })
      }

      if (url.pathname === '/api/state') {
        const config = await env.BUCKET.get('config.json')
        const configData = config
          ? JSON.parse(await config.text())
          : { letterSongs: {} }
        const listed = await env.BUCKET.list()
        const files = listed.objects
          .filter((o) => o.key !== 'config.json')
          .sort((a, b) => a.key.localeCompare(b.key))
          .map((o) => o.key)
        return handle(200, { files, letterSongs: configData.letterSongs || {} })
      }

      if (url.pathname === '/api/letters' && request.method === 'GET') {
        const sql = db(env)
        await ensureLettersTable(sql)
        const rows = await sql`SELECT id, message FROM letters ORDER BY id`
        return handle(200, {
          seeded: rows.length > 0,
          letters: rows.map((r) => ({ id: Number(r.id), message: String(r.message) })),
        })
      }

      if (url.pathname === '/api/letters/create' && request.method === 'POST') {
        if (!authed()) return handle(401, { ok: false, error: 'unauthorized' })
        const body = await request.json()
        const sql = db(env)
        await ensureLettersTable(sql)
        const rows =
          await sql`INSERT INTO letters (id, message)
            VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM letters), ${String(body.message || '')})
            RETURNING id`
        return handle(200, { ok: true, id: Number(rows[0].id) })
      }

      if (url.pathname === '/api/letters' && request.method === 'POST') {
        if (!authed()) return handle(401, { ok: false, error: 'unauthorized' })
        const body = await request.json()
        const entries = Object.entries(body.letters || {})
        if (entries.length > 0) {
          const sql = db(env)
          await ensureLettersTable(sql)
          await sql.transaction(
            entries.map(([id, msg]) => sql`INSERT INTO letters (id, message)
              VALUES (${Number(id)}, ${String(msg)})
              ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message`)
          )
        }
        return handle(200, { ok: true })
      }

      if (url.pathname === '/api/letters' && request.method === 'DELETE') {
        if (!authed()) return handle(401, { ok: false, error: 'unauthorized' })
        const id = Number(url.searchParams.get('id'))
        if (Number.isFinite(id)) {
          const sql = db(env)
          await ensureLettersTable(sql)
          await sql`DELETE FROM letters WHERE id = ${id}`
        }
        return handle(200, { ok: true })
      }

      if (!authed()) return handle(401, { ok: false, error: 'unauthorized' })

      if (request.method === 'POST' && url.pathname === '/api/upload') {
        const name = sanitizeName(url.searchParams.get('name'))
        if (!name) return handle(400, { ok: false, error: 'invalid name' })
        await env.BUCKET.put(name, request.body, {
          httpMetadata: { contentType: mimeFor(name) },
        })
        return handle(200, { ok: true })
      }

      if (request.method === 'POST' && url.pathname === '/api/config') {
        const body = await request.json()
        await env.BUCKET.put('config.json', JSON.stringify(body), {
          httpMetadata: { contentType: 'application/json' },
        })
        return handle(200, { ok: true })
      }

      if (request.method === 'DELETE' && url.pathname === '/api/delete') {
        const name = sanitizeName(url.searchParams.get('name'))
        if (name) await env.BUCKET.delete(name)
        return handle(200, { ok: true })
      }

      return handle(404, { ok: false, error: 'not found' })
    } catch (err) {
      return handle(500, { ok: false, error: String((err && err.message) || err) })
    }
  },
}

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const audioDir = path.join(rootDir, 'src', 'assets', 'audio')
const songsFile = path.join(rootDir, 'src', 'data', 'songs.js')

function sanitizeName(name) {
  const base = String(name || '').split('/').pop().split('\\').pop()
  if (!base || base.startsWith('.')) return null
  for (let i = 0; i < base.length; i += 1) {
    const code = base.charCodeAt(i)
    if (code < 32 || code === 127) return null
  }
  return base
}

async function updateMapping(mapping) {
  const src = await readFile(songsFile, 'utf8')
  const lines = Object.entries(mapping)
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`)
    .join('\n')
  const block = `export const letterSongs = {\n${lines}\n}`
  const replaced = src.replace(/export const letterSongs = \{[\s\S]*?\n\}/, block)
  if (replaced === src) {
    throw new Error('Format letterSongs di songs.js tidak dikenali')
  }
  await writeFile(songsFile, replaced)
}

function dashboardPlugin() {
  return {
    name: 'letterforyou-dashboard',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const readBody = () =>
          new Promise((resolve, reject) => {
            const chunks = []
            req.on('data', (chunk) => chunks.push(chunk))
            req.on('end', () => resolve(Buffer.concat(chunks)))
            req.on('error', reject)
          })
        const send = (code, payload) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
        }

        try {
          if (req.method === 'POST' && url.startsWith('/__upload?')) {
            const name = sanitizeName(new URL(url, 'http://x').searchParams.get('name'))
            if (!name) return send(400, { ok: false, error: 'nama file tidak valid' })
            const buf = await readBody()
            if (!buf.length) return send(400, { ok: false, error: 'file kosong' })
            await mkdir(audioDir, { recursive: true })
            await writeFile(path.join(audioDir, name), buf)
            server.ws.send({ type: 'full-reload' })
            return send(200, { ok: true })
          }

          if (req.method === 'POST' && url.startsWith('/__setmapping')) {
            const buf = await readBody()
            const mapping = JSON.parse(buf.toString('utf8') || '{}')
            await updateMapping(mapping)
            server.ws.send({ type: 'full-reload' })
            return send(200, { ok: true })
          }

          if (url.startsWith('/__delete?')) {
            const name = sanitizeName(new URL(url, 'http://x').searchParams.get('name'))
            if (name) {
              await unlink(path.join(audioDir, name)).catch(() => {})
              server.ws.send({ type: 'full-reload' })
            }
            return send(200, { ok: true })
          }
        } catch (err) {
          return send(500, { ok: false, error: String((err && err.message) || err) })
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), dashboardPlugin()],
})

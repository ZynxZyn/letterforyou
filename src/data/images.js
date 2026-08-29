import { R2_BASE } from './songs'

const imageFiles = import.meta.glob(
  ['../assets/images/*.{jpg,jpeg,png,webp,gif}', '!../assets/images/logo-tosla.png'],
  {
    eager: true,
    query: '?url',
    import: 'default',
  }
)

export const defaultImageItems = Object.keys(imageFiles)
  .sort()
  .map((path) => ({ name: path.split('/').pop(), src: imageFiles[path] }))

let remoteImages = null
let remotePromise = null

export function loadRemoteImages() {
  if (!R2_BASE) return Promise.resolve(null)
  if (remoteImages) return Promise.resolve(remoteImages)
  if (!remotePromise) {
    remotePromise = fetch(`${R2_BASE}/api/images`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => {
        remoteImages =
          data && Array.isArray(data.images)
            ? data.images.map((name) => ({
                name,
                src: `${R2_BASE}/images/${encodeURIComponent(name)}`,
              }))
            : null
        return remoteImages
      })
  }
  return remotePromise
}

export function getImageItems() {
  if (R2_BASE && remoteImages) return remoteImages
  return defaultImageItems
}

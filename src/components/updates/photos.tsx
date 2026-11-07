// Photo helpers shared by Updates and Notes: a grid with click-to-enlarge, a picker, and safe file names.
import { useEffect, useRef, useState } from 'preact/hooks'

export const MAX_PHOTO_MB = 15

/** "My Photo (1).HEIC" → "my-photo-1.heic" */
export function safeName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60)
  const ext =
    dot > 0
      ? name
          .slice(dot + 1)
          .replace(/[^\w]/g, '')
          .toLowerCase()
          .slice(0, 8)
      : ''
  return `${base || 'photo'}${ext ? `.${ext}` : ''}`
}

/** A sentence if any file isn't a photo or is too big, otherwise null. */
export function checkPhotos(files: File[]): string | null {
  for (const f of files) {
    if (!f.type.startsWith('image/')) return `“${f.name}” isn’t a photo.`
    if (f.size > MAX_PHOTO_MB * 1024 * 1024)
      return `“${f.name}” is too big. Photos can be up to ${MAX_PHOTO_MB} MB.`
  }
  return null
}

export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/** Thumbnails that open full size in a dialog. */
export function PhotoGrid({ urls, alt }: { urls: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!urls.length) return null
  return (
    <>
      <div class={`photo-grid photo-grid-${Math.min(urls.length, 3)}`}>
        {urls.map((u, i) => (
          <button
            key={u}
            type="button"
            class="photo-thumb"
            onClick={() => setOpen(i)}
            aria-label={`Enlarge photo ${i + 1} of ${urls.length}`}
          >
            <img
              src={u}
              alt={`${alt} (${i + 1} of ${urls.length})`}
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
      </div>
      <Lightbox urls={urls} index={open} onIndex={setOpen} alt={alt} />
    </>
  )
}

function Lightbox({
  urls,
  index,
  onIndex,
  alt,
}: {
  urls: string[]
  index: number | null
  onIndex: (i: number | null) => void
  alt: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (index !== null && !d.open) d.showModal()
    if (index === null && d.open) d.close()
  }, [index])
  const many = urls.length > 1
  const step = (n: number) =>
    index !== null && onIndex((index + n + urls.length) % urls.length)
  return (
    <dialog
      ref={ref}
      class="lightbox"
      onClose={() => onIndex(null)}
      onCancel={() => onIndex(null)}
      onClick={e => e.target === e.currentTarget && onIndex(null)}
      onKeyDown={e => {
        if (!many) return
        if (e.key === 'ArrowRight') step(1)
        if (e.key === 'ArrowLeft') step(-1)
      }}
    >
      {index !== null && (
        <figure class="lightbox-figure">
          <img
            src={urls[index]}
            alt={`${alt} (${index + 1} of ${urls.length})`}
          />
          <figcaption class="lightbox-bar">
            {many ? (
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onClick={() => step(-1)}
              >
                Previous
              </button>
            ) : (
              <span />
            )}
            <span class="small">
              {many ? `${index + 1} of ${urls.length}` : ''}
            </span>
            <span class="row">
              {many && (
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  onClick={() => step(1)}
                >
                  Next
                </button>
              )}
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                onClick={() => onIndex(null)}
              >
                Close
              </button>
            </span>
          </figcaption>
        </figure>
      )}
    </dialog>
  )
}

/** Choose photos, with previews and remove buttons. `files` are new files; `existing` are already-uploaded URLs. */
export function PhotoPicker({
  files,
  onFiles,
  max,
  existing = [],
  onRemoveExisting,
  onError,
}: {
  files: File[]
  onFiles: (f: File[]) => void
  max?: number
  existing?: { key: string; url: string }[]
  onRemoveExisting?: (key: string) => void
  onError: (msg: string | null) => void
}) {
  const previews = useObjectUrls(files)
  const count = existing.length + files.length
  const full = max !== undefined && count >= max
  return (
    <div class="stack photo-picker">
      {count > 0 && (
        <ul class="picker-list">
          {existing.map(p => (
            <li key={p.key}>
              <img src={p.url} alt="" />
              <button
                type="button"
                class="picker-x"
                aria-label="Remove this photo"
                onClick={() => onRemoveExisting?.(p.key)}
              >
                ×
              </button>
            </li>
          ))}
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <img src={previews[i]} alt="" />
              <button
                type="button"
                class="picker-x"
                aria-label={`Remove ${f.name}`}
                onClick={() => onFiles(files.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <label class="btn btn-secondary btn-sm picker-add">
          {count ? 'Add more photos' : 'Choose photos'}
          <input
            type="file"
            accept="image/*"
            multiple
            class="sr-only"
            onChange={e => {
              const picked = Array.from(e.currentTarget.files ?? [])
              e.currentTarget.value = ''
              const problem = checkPhotos(picked)
              if (problem) return onError(problem)
              let next = [...files, ...picked]
              if (max !== undefined && existing.length + next.length > max) {
                next = next.slice(0, Math.max(0, max - existing.length))
                onError(`You can add up to ${max} photos.`)
              } else onError(null)
              onFiles(next)
            }}
          />
        </label>
      )}
    </div>
  )
}

function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const next = files.map(f => URL.createObjectURL(f))
    setUrls(next)
    return () => {
      for (const u of next) URL.revokeObjectURL(u)
    }
  }, [files])
  return urls
}

/** Paragraphs from plain text, keeping single line breaks. */
export function Paragraphs({ text }: { text: string | null | undefined }) {
  if (!text) return null
  return (
    <div class="prose post-text">
      {text
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </div>
  )
}

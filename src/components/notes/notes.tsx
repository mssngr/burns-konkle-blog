import { useEffect, useState } from 'preact/hooks'
import {
  Paragraphs,
  PhotoGrid,
  PhotoPicker,
  safeName,
} from '@/components/updates/photos'
import { AppError, rpc, signedPhotoUrls, supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/time'
import {
  Button,
  ContactFields,
  Empty,
  ErrorText,
  Field,
  Loading,
  Notice,
  saveContact,
  TextArea,
  useAction,
  useAsync,
  useContact,
} from '@/lib/ui'

export const MAX_NOTE_PHOTOS = 4
const PAGE = 20

export interface PublishedNote {
  id: string
  name: string
  body: string
  photos: string[]
  published_at: string
}

/** Signed URLs for one note's photos (the notes bucket is private). */
export function useNotePhotos(paths: string[]) {
  const [urls, setUrls] = useState<string[]>([])
  const key = paths.join('|')
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the joined paths
  useEffect(() => {
    let live = true
    if (!paths.length) return setUrls([])
    signedPhotoUrls('notes', paths)
      .then(u => live && setUrls(u))
      .catch(() => live && setUrls([]))
    return () => {
      live = false
    }
  }, [key])
  return urls
}

// ------------------------------------------------------------------ page

export function Notes() {
  return (
    <div class="stack notes">
      <NoteForm />
      <section class="section stack" aria-labelledby="notes-heading">
        <h2 id="notes-heading" class="h2">
          Notes from family and friends
        </h2>
        <PublishedNotes />
      </section>
    </div>
  )
}

function PublishedNotes() {
  const [notes, setNotes] = useState<PublishedNote[]>([])
  const [more, setMore] = useState(false)
  const older = useAction()
  const load = (before?: string) =>
    rpc<PublishedNote[]>('published_notes', {
      p_limit: PAGE,
      p_before: before ?? null,
    }).then(r => r ?? [])

  const first = useAsync(async () => {
    const rows = await load()
    setNotes(rows)
    setMore(rows.length === PAGE)
    return rows
  })

  async function loadOlder() {
    const rows = await older.run(() =>
      load(notes[notes.length - 1]?.published_at),
    )
    if (!rows) return
    setNotes(n => [...n, ...rows])
    setMore(rows.length === PAGE)
  }

  if (first.loading && !notes.length) return <Loading />
  if (first.error) return <ErrorText error={first.error} />
  if (!notes.length)
    return <Empty>No notes yet. Yours could be the first!</Empty>
  return (
    <div class="stack">
      <div class="note-list">
        {notes.map(n => (
          <NoteCard key={n.id} note={n} />
        ))}
      </div>
      <ErrorText error={older.error} />
      {more && (
        <div class="actions" style="justify-content:center">
          <Button busy={older.busy} onClick={loadOlder}>
            Show older notes
          </Button>
        </div>
      )}
    </div>
  )
}

function NoteCard({ note }: { note: PublishedNote }) {
  const urls = useNotePhotos(note.photos)
  return (
    <article class="card stack note-card">
      <Paragraphs text={note.body} />
      <PhotoGrid urls={urls} alt={`Note from ${note.name}`} />
      <p class="note-sign">
        <span class="note-name">{note.name}</span>
        <span class="meta"> · {fmtDate(note.published_at)}</span>
      </p>
    </article>
  )
}

// ------------------------------------------------------------------ form

function NoteForm() {
  const [contact, setContact] = useContact()
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [done, setDone] = useState<{ photosFailed: boolean } | null>(null)
  const send = useAction()

  async function submit(e: Event) {
    e.preventDefault()
    if (!contact.name.trim())
      return send.setError(new AppError('Please enter your name.'))
    if (!contact.email.trim())
      return send.setError(new AppError('Please enter your email.'))
    if (!body.trim()) return send.setError(new AppError('Please write a note.'))
    const out = await send.run(async () => {
      const r = await rpc<{ id: string; upload_token: string }>('submit_note', {
        p_name: contact.name.trim(),
        p_email: contact.email.trim(),
        p_phone: contact.phone.trim() || null,
        p_consent: contact.consent,
        p_body: body.trim(),
      })
      saveContact(contact)
      // The note is in; photos are best effort from here.
      let photosFailed = false
      if (files.length) {
        const paths: string[] = []
        const used = new Set<string>()
        for (const [i, f] of files.entries()) {
          let name = safeName(f.name)
          if (used.has(name)) name = `${i + 1}-${name}`
          used.add(name)
          const path = `${r.id}/${name}`
          const { error } = await supabase.storage
            .from('notes')
            .upload(path, f, { contentType: f.type, upsert: false })
          if (error) photosFailed = true
          else paths.push(path)
        }
        if (paths.length) {
          try {
            await rpc('attach_note_photos', {
              p_note: r.id,
              p_upload_token: r.upload_token,
              p_paths: paths,
            })
          } catch {
            photosFailed = true
          }
        }
      }
      return { photosFailed }
    })
    if (out) {
      setDone(out)
      setBody('')
      setFiles([])
    }
  }

  if (done) {
    return (
      <section class="card stack" aria-live="polite">
        <Notice
          tone="success"
          title="Thank you for your note! It will appear on the site once Micala or Gabriel approve it."
        />
        {done.photosFailed && (
          <Notice tone="warn">
            <p>
              Your note was sent, but we couldn’t add every photo. You’re
              welcome to send another note with them.
            </p>
          </Notice>
        )}
        <div class="actions">
          <Button onClick={() => setDone(null)}>Write another note</Button>
        </div>
      </section>
    )
  }

  return (
    <form
      class="card stack note-form"
      onSubmit={submit}
      aria-labelledby="note-form-heading"
    >
      <div>
        <h2 id="note-form-heading" class="h3">
          Share a note
        </h2>
        <p class="muted small" style="margin:4px 0 0">
          Nothing is anonymous: your name is shown with your note. Micala or
          Gabriel read every note before it goes up.
        </p>
      </div>
      <ContactFields value={contact} onChange={setContact} />
      <Field label="Your note">
        <TextArea
          rows={6}
          required
          maxLength={5000}
          value={body}
          onInput={e => setBody(e.currentTarget.value)}
        />
      </Field>
      <div class="ff">
        <span class="ff-label">
          Photos
          <span class="ff-optional"> (optional, up to {MAX_NOTE_PHOTOS})</span>
        </span>
        <PhotoPicker
          files={files}
          onFiles={setFiles}
          max={MAX_NOTE_PHOTOS}
          onError={setPhotoError}
        />
        {photoError && <span class="ff-error">{photoError}</span>}
      </div>
      <ErrorText error={send.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={send.busy}>
          Send my note
        </Button>
        {send.busy && files.length > 0 && (
          <span class="meta">Uploading photos…</span>
        )}
      </div>
    </form>
  )
}

import { useEffect, useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import { useNotePhotos } from '@/components/notes/notes'
import { Paragraphs, PhotoGrid } from '@/components/updates/photos'
import { type FamilyStatus, personName } from '@/lib/auth'
import { query, rpc, supabase } from '@/lib/supabase'
import { fmtDateTime } from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Loading,
  Notice,
  StatusPill,
  site,
  useAction,
  useAsync,
  useQueryParam,
} from '@/lib/ui'

type Status = 'pending' | 'published' | 'held'

interface NoteRow {
  id: string
  name: string
  body: string
  photos: string[]
  status: Status
  created_at: string
  decided_by: string | null
  decided_at: string | null
}

const TABS: { key: Status; label: string; empty: string }[] = [
  {
    key: 'pending',
    label: 'Waiting',
    empty: 'No notes waiting. You’re all caught up.',
  },
  { key: 'published', label: 'Published', empty: 'No published notes yet.' },
  { key: 'held', label: 'Held', empty: 'No held notes.' },
]

export function FamilyNotes() {
  return <FamilyGate>{family => <NotesQueue family={family} />}</FamilyGate>
}

function NotesQueue({ family }: { family: FamilyStatus }) {
  const focus = useQueryParam('id')
  const [tab, setTab] = useState<Status>('pending')
  const admin = family.role === 'admin'

  const notes = useAsync(() =>
    query(
      supabase
        .from('notes')
        .select(
          'id, name, body, photos, status, created_at, decided_by, decided_at',
        )
        .order('created_at', { ascending: false })
        .limit(500),
    ).then(r => (r ?? []) as NoteRow[]),
  )

  // Open the tab holding ?id= and scroll to it.
  useEffect(() => {
    if (!focus || !notes.data) return
    const n = notes.data.find(x => x.id === focus)
    if (!n) return
    setTab(n.status)
    requestAnimationFrame(() =>
      document
        .getElementById(`note-${focus}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }, [focus, notes.data])

  const all = notes.data ?? []
  const shown = all.filter(n => n.status === tab)
  const count = (s: Status) => all.filter(n => n.status === s).length
  const missing = focus && notes.data && !notes.data.some(n => n.id === focus)

  const update = (n: NoteRow) =>
    notes.setData(list => list?.map(x => (x.id === n.id ? n : x)))

  return (
    <div class="stack">
      {!admin && (
        <Notice>
          <p>
            You can read every note. Only Micala or Gabriel can publish or hold
            one.
          </p>
        </Notice>
      )}
      <div class="tabs" role="tablist" aria-label="Notes by status">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            class={`tab${tab === t.key ? ' on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {notes.data && <span class="tab-count">{count(t.key)}</span>}
          </button>
        ))}
      </div>
      {missing && (
        <Notice tone="warn">
          That note couldn’t be found. It may have been removed.
        </Notice>
      )}
      {notes.loading && !notes.data ? (
        <Loading />
      ) : notes.error ? (
        <ErrorText error={notes.error} />
      ) : !shown.length ? (
        <Empty>{TABS.find(t => t.key === tab)?.empty}</Empty>
      ) : (
        <div class="stack" role="tabpanel">
          {shown.map(n => (
            <QueueCard
              key={n.id}
              note={n}
              admin={admin}
              focused={n.id === focus}
              onDecided={update}
            />
          ))}
        </div>
      )}
      <p class="meta">
        Published notes appear on the{' '}
        <a href={site('notes/')}>Family &amp; friends notes</a> page.
      </p>
    </div>
  )
}

function QueueCard({
  note,
  admin,
  focused,
  onDecided,
}: {
  note: NoteRow
  admin: boolean
  focused: boolean
  onDecided: (n: NoteRow) => void
}) {
  const urls = useNotePhotos(note.photos)
  const act = useAction()
  const [which, setWhich] = useState<'publish' | 'hold' | null>(null)

  async function decide(decision: 'publish' | 'hold') {
    setWhich(decision)
    const ok = await act.run(
      async () => {
        await rpc('family_decide_note', {
          p_note: note.id,
          p_decision: decision,
        })
        return true
      },
      decision === 'publish'
        ? `Published ${note.name}’s note`
        : `Held ${note.name}’s note`,
    )
    setWhich(null)
    if (ok) {
      onDecided({
        ...note,
        status: decision === 'publish' ? 'published' : 'held',
        decided_at: new Date().toISOString(),
      })
    }
  }

  return (
    <article
      id={`note-${note.id}`}
      class={`card stack queue-card${focused ? ' focused' : ''}`}
    >
      <header class="spread">
        <div>
          <h3 class="card-title">{note.name}</h3>
          <p class="meta" style="margin:0">
            Sent {fmtDateTime(note.created_at)}
            {note.decided_at && note.status !== 'pending' && (
              <>
                {' '}
                · {note.status === 'published' ? 'Published' : 'Held'}{' '}
                {fmtDateTime(note.decided_at)}
                {note.decided_by && ` by ${personName(note.decided_by)}`}
              </>
            )}
          </p>
        </div>
        <StatusPill status={note.status} />
      </header>
      <Paragraphs text={note.body} />
      <PhotoGrid urls={urls} alt={`Note from ${note.name}`} />
      <ErrorText error={act.error} />
      {admin && (
        <div class="actions">
          {note.status !== 'published' && (
            <Button
              variant="primary"
              busy={which === 'publish'}
              disabled={act.busy}
              onClick={() => decide('publish')}
            >
              Publish
            </Button>
          )}
          {note.status !== 'held' && (
            <Button
              variant={note.status === 'published' ? 'danger' : 'secondary'}
              busy={which === 'hold'}
              disabled={act.busy}
              onClick={() => decide('hold')}
            >
              {note.status === 'published' ? 'Unpublish and hold' : 'Hold'}
            </Button>
          )}
          {note.status === 'pending' && (
            <span class="meta">
              Held notes stay private, and {note.name.split(' ')[0]} isn’t told.
            </span>
          )}
        </div>
      )}
    </article>
  )
}

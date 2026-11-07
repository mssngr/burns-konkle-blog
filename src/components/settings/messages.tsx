import { useEffect, useMemo, useState } from 'preact/hooks'
import { personName } from '@/lib/auth'
import { AppError, query, supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Field,
  Input,
  Loading,
  Notice,
  TextArea,
  useAction,
  useAsync,
} from '@/lib/ui'
import { placeholders, updateRow } from './db'
import { Section } from './fields'

interface Template {
  key: string
  audience: 'family' | 'guest'
  description: string
  subject: string
  body: string
  position: number
  updated_at: string
  updated_by: string | null
}

const GROUPS: [Template['audience'], string, string][] = [
  [
    'family',
    'To the family',
    'Sent to Gabriel, Micala, Vincent, and Samantha.',
  ],
  [
    'guest',
    'To guests',
    'Sent to the guest’s email, only if they agreed to emails.',
  ],
]

function TemplateCard({
  saved,
  onSaved,
  onDirty,
  hidden,
}: {
  saved: Template
  hidden: boolean
  onSaved: (t: Template) => void
  onDirty: (key: string, d: boolean) => void
}) {
  const [subject, setSubject] = useState(saved.subject)
  const [body, setBody] = useState(saved.body)
  const save = useAction()
  useEffect(() => {
    setSubject(saved.subject)
    setBody(saved.body)
  }, [saved])
  const dirty = subject !== saved.subject || body !== saved.body
  useEffect(() => {
    onDirty(saved.key, dirty)
  }, [dirty, saved.key, onDirty])

  const known = placeholders(saved.subject, saved.body)
  const now = placeholders(subject, body)
  const missing = known.filter(p => !now.includes(p))
  const added = now.filter(p => !known.includes(p))

  const onSave = () =>
    save.run(async () => {
      if (!subject.trim() || !body.trim())
        throw new AppError('The subject and message can’t be blank.')
      onSaved(
        await updateRow<Template>(
          'message_templates',
          { key: saved.key },
          { subject: subject.trim(), body: body.trim() },
        ),
      )
    }, 'Saved')

  return (
    <details class="set-item set-template" hidden={hidden}>
      <summary>
        <span class="set-item-title">{saved.description}</span>
        <span class="meta set-template-subject">{saved.subject}</span>
        {dirty && <span class="pill pill-yellow">Unsaved</span>}
      </summary>
      <div class="stack set-template-body">
        <p class="meta">
          Key: <code>{saved.key}</code>
          {saved.updated_by &&
            ` · Last changed ${fmtDate(saved.updated_at)} by ${personName(saved.updated_by)}`}
        </p>
        <Field label="Subject">
          <Input
            value={subject}
            onInput={(e: Event) =>
              setSubject((e.currentTarget as HTMLInputElement).value)
            }
          />
        </Field>
        <Field label="Message">
          <TextArea
            rows={6}
            value={body}
            onInput={(e: Event) =>
              setBody((e.currentTarget as HTMLTextAreaElement).value)
            }
          />
        </Field>
        {known.length > 0 && (
          <div class="small">
            <p class="muted set-ph-label">
              Filled in automatically (keep the brackets and spelling exactly):
            </p>
            <ul class="set-ph">
              {known.map(p => (
                <li
                  key={p}
                  class={missing.includes(p) ? 'set-ph-missing' : undefined}
                >
                  <code>{p}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
        {missing.length > 0 && (
          <Notice tone="warn">
            Your edit removes {missing.join(', ')}. That detail won’t appear in
            the email.
          </Notice>
        )}
        {added.length > 0 && (
          <Notice tone="warn">
            {added.join(', ')} {added.length === 1 ? 'is' : 'are'} new here. If
            the site doesn’t fill {added.length === 1 ? 'it' : 'them'} in for
            this message, guests will see the brackets as written.
          </Notice>
        )}
        <ErrorText error={save.error} />
        <div class="actions">
          <Button
            variant="primary"
            size="sm"
            busy={save.busy}
            disabled={!dirty}
            onClick={onSave}
          >
            Save message
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSubject(saved.subject)
                setBody(saved.body)
              }}
            >
              Undo changes
            </Button>
          )}
        </div>
      </div>
    </details>
  )
}

export function MessageSettings({
  onDirty,
}: {
  onDirty: (d: boolean) => void
}) {
  const { data, error, loading, setData } = useAsync(() =>
    query<Template[]>(
      supabase.from('message_templates').select('*').order('position'),
    ),
  )
  const [q, setQ] = useState('')
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const markDirty = useMemo(
    () => (key: string, d: boolean) =>
      setDirtyKeys(prev => {
        if (prev.has(key) === d) return prev
        const next = new Set(prev)
        if (d) next.add(key)
        else next.delete(key)
        return next
      }),
    [],
  )
  useEffect(() => {
    onDirty(dirtyKeys.size > 0)
  }, [dirtyKeys, onDirty])

  if (loading && !data) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!data) return null

  const needle = q.trim().toLowerCase()
  const shown = needle
    ? data.filter(t =>
        [t.key, t.description, t.subject, t.body].some(s =>
          s.toLowerCase().includes(needle),
        ),
      )
    : data

  return (
    <Section
      title="Messages"
      lede={
        <p>
          Every email the site sends. Words in [brackets] are filled in
          automatically. Each message saves on its own.
        </p>
      }
    >
      <Field label="Find a message">
        <Input
          type="search"
          value={q}
          placeholder="Approved, reminder, Meal Train…"
          onInput={(e: Event) =>
            setQ((e.currentTarget as HTMLInputElement).value)
          }
        />
      </Field>
      {shown.length === 0 && <Empty>No messages match “{q}”.</Empty>}
      {GROUPS.map(([audience, title, note]) => {
        const list = data.filter(t => t.audience === audience)
        return (
          <div
            key={audience}
            class="stack"
            hidden={!shown.some(t => t.audience === audience)}
          >
            <div>
              <h3 class="h3">{title}</h3>
              <p class="small muted set-group-note">{note}</p>
            </div>
            {list.map(t => (
              <TemplateCard
                key={t.key}
                saved={t}
                hidden={!shown.includes(t)}
                onDirty={markDirty}
                onSaved={n => setData(data.map(x => (x.key === n.key ? n : x)))}
              />
            ))}
          </div>
        )
      })}
    </Section>
  )
}

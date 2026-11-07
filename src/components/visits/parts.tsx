// Small pieces shared by the visit pages.
import { useEffect, useId, useState } from 'preact/hooks'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Button, Input } from '@/lib/ui'
import type { Attendee } from './types'

export const STEP_NAMES = [
  'Booking type',
  'Date and time',
  'Your details',
  'House rules',
  'Questions',
  'Submit',
]

/** The six steps of "Book a Visit", with the current one highlighted. */
export function Steps({ current }: { current: number }) {
  return (
    <ol class="vsteps" aria-label="Steps">
      {STEP_NAMES.map((name, i) => {
        const n = i + 1
        const state =
          n < current ? 'is-done' : n === current ? 'is-current' : ''
        return (
          <li
            key={name}
            class={state}
            aria-current={n === current ? 'step' : undefined}
          >
            <span class="vsteps-n">{n}</span>
            <span class="vsteps-label">{name}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** People a signed-in guest often brings (from their profile). */
export function useCompanions(): Attendee[] {
  const auth = useAuth()
  const [list, setList] = useState<Attendee[]>([])
  useEffect(() => {
    if (!auth.session || auth.family) return
    supabase
      .from('profiles')
      .select('companions')
      .maybeSingle()
      .then(({ data }) =>
        setList(
          Array.isArray(data?.companions)
            ? (data.companions as Attendee[])
            : [],
        ),
      )
  }, [auth.session, auth.family])
  return list
}

const key = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ')

/** Everyone coming: full name, age for children, relationship to the family. */
export function AttendeeEditor({
  value,
  onChange,
  max,
  companions = [],
  showErrors,
}: {
  value: Attendee[]
  onChange: (v: Attendee[]) => void
  max: number
  companions?: Attendee[]
  showErrors?: boolean
}) {
  const uid = useId()
  const update = (i: number, k: keyof Attendee, v: string) =>
    onChange(value.map((a, j) => (j === i ? { ...a, [k]: v } : a)))
  const full = value.length >= max
  const listed = new Set(value.map(a => key(a.name)))
  const extra = companions.filter(
    c => c.name?.trim() && !listed.has(key(c.name)),
  )

  return (
    <div class="att">
      <ul class="att-list">
        {value.map((a, i) => (
          <li key={i} class="att-row">
            <span class="att-n" aria-hidden="true">
              {i + 1}
            </span>
            <label class="att-field att-name" for={`${uid}-n${i}`}>
              <span class="att-label">Full name</span>
              <Input
                id={`${uid}-n${i}`}
                value={a.name}
                maxLength={80}
                aria-invalid={showErrors && !a.name.trim() ? 'true' : undefined}
                onInput={(e: Event) =>
                  update(i, 'name', (e.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label class="att-field att-age" for={`${uid}-a${i}`}>
              <span class="att-label">Age (children)</span>
              <Input
                id={`${uid}-a${i}`}
                value={a.age ?? ''}
                maxLength={12}
                inputMode="numeric"
                onInput={(e: Event) =>
                  update(i, 'age', (e.currentTarget as HTMLInputElement).value)
                }
              />
            </label>
            <label class="att-field att-rel" for={`${uid}-r${i}`}>
              <span class="att-label">Relationship to the family</span>
              <Input
                id={`${uid}-r${i}`}
                value={a.relationship ?? ''}
                maxLength={80}
                placeholder="Aunt, friend, neighbor…"
                aria-invalid={
                  showErrors && !a.relationship?.trim() ? 'true' : undefined
                }
                onInput={(e: Event) =>
                  update(
                    i,
                    'relationship',
                    (e.currentTarget as HTMLInputElement).value,
                  )
                }
              />
            </label>
            <Button
              size="sm"
              variant="ghost"
              class="att-remove"
              disabled={value.length <= 1}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={`Remove ${a.name || `person ${i + 1}`}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div class="actions">
        <Button
          size="sm"
          disabled={full}
          onClick={() =>
            onChange([...value, { name: '', age: '', relationship: '' }])
          }
        >
          Add a person
        </Button>
        <span class="meta">
          {value.length} of up to {max} {max === 1 ? 'person' : 'people'}
        </span>
      </div>
      {extra.length > 0 && (
        <div class="att-quick">
          <span class="meta">From your profile:</span>
          {extra.map(c => (
            <Button
              key={c.name}
              size="sm"
              variant="quiet"
              disabled={full}
              onClick={() =>
                onChange([
                  ...value.filter(a => a.name.trim()),
                  {
                    name: c.name,
                    age: c.age ?? '',
                    relationship: c.relationship ?? '',
                  },
                ])
              }
            >
              + {c.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Attendees ready to send: blank rows dropped, fields trimmed. */
export const cleanAttendees = (list: Attendee[]): Attendee[] =>
  list
    .filter(a => a.name.trim())
    .map(a => ({
      name: a.name.trim(),
      age: a.age?.trim() || undefined,
      relationship: a.relationship?.trim() ?? '',
    }))

export const attendeesComplete = (list: Attendee[]) =>
  list.length > 0 && list.every(a => a.name.trim() && a.relationship?.trim())

export function PeopleList({ people }: { people: Attendee[] }) {
  if (!people.length) return <p class="muted">No one listed yet.</p>
  return (
    <ul class="people">
      {people.map((a, i) => (
        <li key={i}>
          <strong>{a.name}</strong>
          {a.age && <span class="muted">, age {a.age}</span>}
          {a.relationship && <span class="muted"> · {a.relationship}</span>}
        </li>
      ))}
    </ul>
  )
}

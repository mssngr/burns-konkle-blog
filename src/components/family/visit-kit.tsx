// Shared pieces for the family dashboard, visits admin, and visitors pages.
import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { personName } from '@/lib/auth'
import { AppError, configured, errorMessage, supabase } from '@/lib/supabase'
import {
  addDays,
  clockSteps,
  fmtClock,
  fmtRange,
  fromMT,
  mtDate,
  mtTime,
  todayMT,
} from '@/lib/time'
import {
  Button,
  ErrorText,
  Field,
  Input,
  Loading,
  Notice,
  Select,
  type SlotState,
  TextArea,
  useAction,
  useAsync,
} from '@/lib/ui'

// ------------------------------------------------------------------ types

export interface Question {
  key: string
  label: string
  kind?: string
  required?: boolean
}

export interface BookingType {
  id: number
  position: number
  name: string
  short_name: string
  approval: 'approve' | 'acknowledge'
  questions: Question[]
  start_label: string
  end_label: string
  max_minutes: number | null
  hours_rule: string
  active: boolean
}

export interface Attendee {
  name: string
  age?: string
  relationship?: string
}

export interface Booking {
  id: string
  type_id: number
  visitor_id: string
  name: string
  starts_at: string
  ends_at: string
  status: string
  attendees: Attendee[]
  headcount: number
  answers: Record<string, string>
  preapproved_by: string | null
  preapproved_at: string | null
  decision_note: string | null
  decided_by: string | null
  decided_at: string | null
  cancel_note: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  healthy_at: string | null
  rules_reagree_needed: boolean
  created_at: string
  submitted_at: string | null
}

export const BOOKING_COLUMNS =
  'id, type_id, visitor_id, name, starts_at, ends_at, status, attendees, headcount, answers, preapproved_by, preapproved_at, decision_note, decided_by, decided_at, cancel_note, cancelled_by, cancelled_at, healthy_at, rules_reagree_needed, created_at, submitted_at'

export const FAMILY_ORDER = ['gabriel', 'micala', 'vincent', 'samantha']

// --------------------------------------------------------------- database

/** A database refusal that keeps Postgres's hint (e.g. "over_limit", "over_cap"). */
export class DbError extends AppError {
  hint?: string
}

/** Like rpc() from lib/supabase, but keeps the hint so the UI can offer the right next step. */
export async function call<T = unknown>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!configured) throw new AppError(errorMessage(null))
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    const e = new DbError(errorMessage(error))
    e.hint = error.hint ?? undefined
    throw e
  }
  return (data ?? null) as T
}

/** True when an approval was refused because of a people limit or the weekly cap. */
export const isRoomError = (e: unknown) =>
  e instanceof DbError && (e.hint === 'over_limit' || e.hint === 'over_cap')

let typesCache: Promise<BookingType[]> | null = null
export function loadTypes(): Promise<BookingType[]> {
  typesCache ??= (async () => {
    const { data, error } = await supabase
      .from('booking_types')
      .select('*')
      .order('position')
    if (error) {
      typesCache = null
      throw new AppError(errorMessage(error))
    }
    return data as BookingType[]
  })()
  return typesCache
}

// ----------------------------------------------------------------- display

/** Calendar color for a booking status. */
export function statusColor(status: string): SlotState | null {
  if (status === 'draft') return 'yellow'
  if (status === 'submitted') return 'orange'
  if (status === 'approved') return 'blue'
  return null
}

/** What a yellow request still needs. */
export function missingParts(
  rulesComplete: boolean,
  answersComplete: boolean,
): string[] {
  const out: string[] = []
  if (!rulesComplete) out.push('rules not agreed')
  if (!answersComplete) out.push('questions not answered')
  return out
}

export const names = (people: string[]) => people.map(personName).join(', ')

/** "Ann Lee (6), Aunt" */
export const attendeeLine = (a: Attendee) =>
  `${a.name}${a.age ? ` (${a.age})` : ''}${a.relationship ? `, ${a.relationship}` : ''}`

/** Answers labeled with the type's questions, plus "Bringing" and "Anything else". */
export function answerRows(
  type: BookingType | undefined,
  answers: Record<string, string> | null,
): [string, string][] {
  const a = answers ?? {}
  const rows: [string, string][] = []
  const seen = new Set<string>()
  for (const q of type?.questions ?? []) {
    seen.add(q.key)
    if (a[q.key]?.trim()) rows.push([q.label, a[q.key]])
  }
  if (a.bring?.trim()) rows.push(['Bringing', a.bring])
  if (a.notes?.trim()) rows.push(['Anything else', a.notes])
  seen.add('bring')
  seen.add('notes')
  for (const [k, v] of Object.entries(a))
    if (!seen.has(k) && String(v ?? '').trim()) rows.push([k, String(v)])
  return rows
}

export const FLAG_MEANINGS: [string, string][] = [
  [
    '1st flag',
    'Every future request from this person needs approval from 3 of the 4 (Gabriel, Micala, Vincent, Samantha).',
  ],
  [
    '2nd flag',
    'They can’t request or be approved for anything for 30 days, and their current bookings are cancelled.',
  ],
  ['3rd flag', 'Permanent ban.'],
]

export function FlagMeanings({ next }: { next?: number }) {
  return (
    <ul class="fam-flag-meanings">
      {FLAG_MEANINGS.map(([k, v], i) => (
        <li key={k} class={next === i + 1 ? 'is-next' : undefined}>
          <strong>{k}:</strong> {v}
        </li>
      ))}
    </ul>
  )
}

/** A titled block on a page. */
export function Section({
  id,
  title,
  count,
  children,
  aside,
}: {
  id?: string
  title: ComponentChildren
  count?: number
  children: ComponentChildren
  aside?: ComponentChildren
}) {
  return (
    <section
      class="fam-section"
      id={id}
      aria-labelledby={id ? `${id}-h` : undefined}
    >
      <div class="fam-section-head">
        <h2 id={id ? `${id}-h` : undefined}>
          {title}
          {count ? <span class="fam-count">{count}</span> : null}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** A label/value list. */
export function Facts({
  rows,
}: {
  rows: [ComponentChildren, ComponentChildren][]
}) {
  return (
    <dl class="fam-facts">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// ------------------------------------------------------------------ times

const STEPS = clockSteps('00:00', '23:45')

export function TimeSelect({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={e => onChange(e.currentTarget.value)}
    >
      {STEPS.map(t => (
        <option key={t} value={t}>
          {fmtClock(t)}
        </option>
      ))}
    </Select>
  )
}

export interface When {
  sd: string
  st: string
  ed: string
  et: string
}

/** Round "HH:MM" down to the 15-minute grid. */
const snap = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${String(h).padStart(2, '0')}:${String(m - (m % 15)).padStart(2, '0')}`
}

export const whenFrom = (s: string, e: string): When => ({
  sd: mtDate(s),
  st: snap(mtTime(s)),
  ed: mtDate(e),
  et: snap(mtTime(e)),
})

export const whenStart = (w: When) => fromMT(w.sd, w.st).toISOString()
export const whenEnd = (w: When) => fromMT(w.ed, w.et).toISOString()

/** Start and end, each a Mountain Time date and a 15-minute time. */
export function WhenFields({
  value,
  onChange,
  startLabel = 'Start',
  endLabel = 'End',
}: {
  value: When
  onChange: (w: When) => void
  startLabel?: string
  endLabel?: string
}) {
  const set = (k: keyof When) => (v: string) => onChange({ ...value, [k]: v })
  const valid =
    value.sd &&
    value.ed &&
    fromMT(value.ed, value.et) > fromMT(value.sd, value.st)
  return (
    <div class="stack">
      <div class="fam-when">
        <Field label={startLabel}>
          <div class="fam-dt">
            <Input
              type="date"
              value={value.sd}
              onInput={e => set('sd')(e.currentTarget.value)}
              required
            />
            <TimeSelect
              label={`${startLabel} time`}
              value={value.st}
              onChange={set('st')}
            />
          </div>
        </Field>
        <Field label={endLabel}>
          <div class="fam-dt">
            <Input
              type="date"
              value={value.ed}
              onInput={e => set('ed')(e.currentTarget.value)}
              required
            />
            <TimeSelect
              label={`${endLabel} time`}
              value={value.et}
              onChange={set('et')}
            />
          </div>
        </Field>
      </div>
      <p class="meta">
        {valid
          ? `${fmtRange(whenStart(value), whenEnd(value))} Mountain Time`
          : 'The end needs to be after the start.'}
      </p>
    </div>
  )
}

// ----------------------------------------------------------------- people

export function PeopleEditor({
  value,
  onChange,
}: {
  value: Attendee[]
  onChange: (a: Attendee[]) => void
}) {
  const update = (i: number, k: keyof Attendee, v: string) =>
    onChange(value.map((a, j) => (j === i ? { ...a, [k]: v } : a)))
  return (
    <div class="stack fam-people">
      {value.map((a, i) => (
        <div class="fam-person" key={i}>
          <Input
            aria-label="Full name"
            placeholder="Full name"
            value={a.name}
            onInput={e => update(i, 'name', e.currentTarget.value)}
          />
          <Input
            aria-label="Age (kids)"
            placeholder="Age (kids)"
            value={a.age ?? ''}
            onInput={e => update(i, 'age', e.currentTarget.value)}
          />
          <Input
            aria-label="Relationship"
            placeholder="Relationship"
            value={a.relationship ?? ''}
            onInput={e => update(i, 'relationship', e.currentTarget.value)}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label={`Remove ${a.name || 'person'}`}
          >
            Remove
          </Button>
        </div>
      ))}
      <div>
        <Button
          size="sm"
          onClick={() =>
            onChange([...value, { name: '', age: '', relationship: '' }])
          }
        >
          Add a person
        </Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------- deny with a note

interface CalSlot {
  t: string
  s: SlotState
}

/** Contiguous open (green) stretches in a day of visit_calendar slots. */
function openRuns(slots: CalSlot[]): [string, string][] {
  const step = 15 * 60 * 1000
  const out: [number, number][] = []
  let run: [number, number] | null = null
  for (const sl of slots) {
    const t = new Date(sl.t).getTime()
    if (sl.s === 'green') {
      if (run && run[1] === t) run[1] = t + step
      else {
        if (run) out.push(run)
        run = [t, t + step]
      }
    } else if (run) {
      out.push(run)
      run = null
    }
  }
  if (run) out.push(run)
  return out.map(([s, e]) => [
    new Date(s).toISOString(),
    new Date(e).toISOString(),
  ])
}

/** Suggest an open time: pick a day, see its open stretches for this booking type, tap one to add it to the note. */
export function SuggestTime({
  typeId,
  near,
  onPick,
}: {
  typeId: number
  near: string
  onPick: (text: string) => void
}) {
  const [date, setDate] = useState(() => {
    const d = mtDate(near)
    return d < todayMT() ? todayMT() : d
  })
  const cal = useAsync(
    () =>
      call<{ slots: CalSlot[] }>('visit_calendar', {
        p_type: typeId,
        p_from: date,
        p_days: 1,
      }),
    [typeId, date],
  )
  const runs = cal.data ? openRuns(cal.data.slots) : []
  return (
    <div class="fam-suggest">
      <div class="row">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDate(addDays(date, -1))}
          aria-label="Previous day"
          disabled={date <= todayMT()}
        >
          ‹
        </Button>
        <Input
          type="date"
          value={date}
          onInput={e => e.currentTarget.value && setDate(e.currentTarget.value)}
          aria-label="Day to look at"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Next day"
        >
          ›
        </Button>
      </div>
      {cal.loading && !cal.data ? (
        <Loading label="Looking for open times…" />
      ) : cal.error ? (
        <ErrorText error={cal.error} />
      ) : runs.length ? (
        <div class="row">
          {runs.map(([s, e]) => (
            <button
              key={s}
              type="button"
              class="fam-chip st-green"
              onClick={() =>
                onPick(`An open time that works: ${fmtRange(s, e)}.`)
              }
            >
              {fmtRange(s, e)}
            </button>
          ))}
        </div>
      ) : (
        <p class="meta">No open times that day.</p>
      )}
    </div>
  )
}

/** The note box for a denial, with an optional open-time suggestion. */
export function DenyNote({
  typeId,
  near,
  value,
  onChange,
}: {
  typeId: number
  near: string
  value: string
  onChange: (v: string) => void
}) {
  const [suggest, setSuggest] = useState(false)
  return (
    <div class="stack">
      <Field
        label="Note to the guest"
        optional
        hint="Sent with the denial. You can suggest another time."
      >
        <TextArea
          value={value}
          onInput={e => onChange(e.currentTarget.value)}
          maxLength={1000}
        />
      </Field>
      {suggest ? (
        <SuggestTime
          typeId={typeId}
          near={near}
          onPick={t => onChange(value.trim() ? `${value.trim()} ${t}` : t)}
        />
      ) : (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setSuggest(true)}>
            Suggest an open time
          </Button>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------- flags

/** Add a flag to a visitor (any of the four). A note is required. */
export function FlagForm({
  visitorId,
  name,
  bookingId,
  count,
  onCancel,
  onDone,
}: {
  visitorId: string
  name: string
  bookingId?: string
  count: number
  onCancel: () => void
  onDone: (msg: string) => void
}) {
  const [note, setNote] = useState('')
  const act = useAction()
  const next = count + 1
  async function submit(e: Event) {
    e.preventDefault()
    const r = await act.run(() =>
      call<{ flag_count: number }>('flag_visitor', {
        p_visitor: visitorId,
        p_note: note,
        p_booking: bookingId ?? null,
      }),
    )
    if (r) onDone(`Flagged ${name} (flag ${r.flag_count})`)
  }
  return (
    <form class="fam-inline-form stack" onSubmit={submit}>
      <h3 class="fam-h3">Flag {name}</h3>
      <p class="small">
        This will be flag {next}. Only the four of you see flags and their
        notes. {name} only gets the neutral emails.
      </p>
      <FlagMeanings next={Math.min(next, 3)} />
      {next >= 2 && (
        <Notice tone="warn">
          {next === 2
            ? `${name} won’t be able to request anything for 30 days, and their current bookings will be cancelled.`
            : `${name} will be banned for good, and their current bookings will be cancelled.`}
        </Notice>
      )}
      <Field label="Why?" hint="Required. Only the family sees this.">
        <TextArea
          required
          value={note}
          onInput={e => setNote(e.currentTarget.value)}
          maxLength={2000}
        />
      </Field>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button
          type="submit"
          variant="danger"
          busy={act.busy}
          disabled={!note.trim()}
        >
          Add flag {next}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </form>
  )
}

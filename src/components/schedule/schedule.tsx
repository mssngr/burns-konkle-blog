import { useEffect, useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import { type FamilyStatus, personName } from '@/lib/auth'
import { AppError, query, rpc, supabase } from '@/lib/supabase'
import {
  addDays,
  fmtLongDate,
  fmtRange,
  fmtTime,
  fromMT,
  mtDate,
  mtTime,
  timeAgo,
  todayMT,
} from '@/lib/time'
import {
  Button,
  Check,
  Empty,
  ErrorText,
  Field,
  Input,
  Loading,
  Modal,
  Notice,
  Select,
  TextArea,
  useAction,
  useAsync,
  useQueryParam,
} from '@/lib/ui'

type Kind = 'event' | 'appointment' | 'family' | 'need'

interface Entry {
  id: string
  title: string
  kind: Kind
  starts_at: string
  ends_at: string | null
  location: string | null
  notes: string | null
  help_needed: boolean
  help_description: string | null
  help_requested_at: string | null
  claimed_by: string | null
  claimed_at: string | null
  created_by: string | null
}

const KINDS: Record<Kind, string> = {
  event: 'Event',
  appointment: 'Appointment',
  family: 'Chance to see family',
  need: 'Need',
}

export function Schedule() {
  return <FamilyGate>{family => <ScheduleView family={family} />}</FamilyGate>
}

// ------------------------------------------------------------------ view

function ScheduleView({ family }: { family: FamilyStatus }) {
  const admin = family.role === 'admin'
  const focus = useQueryParam('id')
  const [showPast, setShowPast] = useState(false)
  const [editing, setEditing] = useState<Entry | 'new' | null>(null)
  const [asking, setAsking] = useState<Entry | null>(null)

  const entries = useAsync(() =>
    query(
      supabase
        .from('schedule_entries')
        .select('*')
        .order('starts_at', { ascending: true }),
    ).then(r => (r ?? []) as Entry[]),
  )

  const today = todayMT()
  const all = entries.data ?? []
  const upcoming = all.filter(e => mtDate(e.starts_at) >= today)
  const past = all.filter(e => mtDate(e.starts_at) < today).reverse()
  const openHelp = upcoming.filter(e => e.help_needed && !e.claimed_by).length

  // Show and scroll to ?id=, opening past entries if it's there.
  useEffect(() => {
    if (!focus || !entries.data) return
    const e = entries.data.find(x => x.id === focus)
    if (!e) return
    if (mtDate(e.starts_at) < todayMT()) setShowPast(true)
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById(`entry-${focus}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      ),
    )
  }, [focus, entries.data])

  const put = (e: Entry) =>
    entries.setData(list => {
      const rest = (list ?? []).filter(x => x.id !== e.id)
      return [...rest, e].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    })
  const drop = (id: string) =>
    entries.setData(list => list?.filter(x => x.id !== id))
  const missing =
    focus && entries.data && !entries.data.some(e => e.id === focus)

  return (
    <div class="stack schedule">
      <div class="spread schedule-bar">
        <p class="muted" style="margin:0">
          {admin
            ? 'Add what’s coming up. Mark an entry “Help needed” to ask Vincent and Samantha.'
            : 'Entries are read-only. When Micala or Gabriel ask for help, anyone can claim it.'}
        </p>
        {admin && (
          <Button variant="primary" onClick={() => setEditing('new')}>
            Add an entry
          </Button>
        )}
      </div>

      {openHelp > 0 && (
        <Notice
          tone="warn"
          title={
            openHelp === 1
              ? '1 entry needs help'
              : `${openHelp} entries need help`
          }
        >
          <p>
            Look for “Help needed” below. Claim one to let everyone know you’ve
            got it.
          </p>
        </Notice>
      )}
      {missing && (
        <Notice tone="warn">
          That entry couldn’t be found. It may have been deleted.
        </Notice>
      )}

      {entries.loading && !entries.data ? (
        <Loading />
      ) : entries.error ? (
        <ErrorText error={entries.error} />
      ) : (
        <>
          <section class="stack" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" class="h3">
              Coming up
            </h2>
            {upcoming.length ? (
              <Days
                entries={upcoming}
                today={today}
                family={family}
                focus={focus}
                onEdit={setEditing}
                onAsk={setAsking}
                onSaved={put}
                onDeleted={drop}
              />
            ) : (
              <Empty>
                Nothing on the schedule yet.
                {admin && ' Add the first entry above.'}
              </Empty>
            )}
          </section>

          {past.length > 0 && (
            <section class="stack" aria-label="Past entries">
              <Check checked={showPast} onChange={setShowPast}>
                Show past entries ({past.length})
              </Check>
              {showPast && (
                <Days
                  entries={past}
                  today={today}
                  family={family}
                  focus={focus}
                  onEdit={setEditing}
                  onAsk={setAsking}
                  onSaved={put}
                  onDeleted={drop}
                  past
                />
              )}
            </section>
          )}
        </>
      )}

      {admin && (
        <>
          <Modal
            open={!!editing}
            onClose={() => setEditing(null)}
            title={editing === 'new' ? 'Add an entry' : 'Edit entry'}
          >
            {editing && (
              <EntryForm
                entry={editing === 'new' ? undefined : editing}
                onSaved={e => {
                  put(e)
                  setEditing(null)
                }}
              />
            )}
          </Modal>
          <Modal
            open={!!asking}
            onClose={() => setAsking(null)}
            title="Ask for help"
          >
            {asking && (
              <HelpForm
                entry={asking}
                onSaved={e => {
                  put(e)
                  setAsking(null)
                }}
              />
            )}
          </Modal>
        </>
      )}
    </div>
  )
}

function dayLabel(date: string, today: string) {
  const long = fmtLongDate(fromMT(date, '12:00'))
  if (date === today) return `Today · ${long}`
  if (date === addDays(today, 1)) return `Tomorrow · ${long}`
  return long
}

function Days({
  entries,
  today,
  past,
  ...rest
}: {
  entries: Entry[]
  today: string
  past?: boolean
  family: FamilyStatus
  focus: string | null
  onEdit: (e: Entry) => void
  onAsk: (e: Entry) => void
  onSaved: (e: Entry) => void
  onDeleted: (id: string) => void
}) {
  const days: [string, Entry[]][] = []
  for (const e of entries) {
    const d = mtDate(e.starts_at)
    const last = days[days.length - 1]
    if (last && last[0] === d) last[1].push(e)
    else days.push([d, [e]])
  }
  return (
    <div class={`stack days${past ? ' days-past' : ''}`}>
      {days.map(([d, list]) => (
        <section key={d} class="day" aria-label={dayLabel(d, today)}>
          <h3 class="day-head">{dayLabel(d, today)}</h3>
          <div class="stack">
            {list.map(e => (
              <EntryCard key={e.id} entry={e} {...rest} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ card

function EntryCard({
  entry: e,
  family,
  focus,
  onEdit,
  onAsk,
  onSaved,
  onDeleted,
}: {
  entry: Entry
  family: FamilyStatus
  focus: string | null
  onEdit: (e: Entry) => void
  onAsk: (e: Entry) => void
  onSaved: (e: Entry) => void
  onDeleted: (id: string) => void
}) {
  const admin = family.role === 'admin'
  const act = useAction()
  const [busy, setBusy] = useState<string | null>(null)
  const mine = e.claimed_by === family.person

  const time = !e.ends_at
    ? fmtTime(e.starts_at)
    : mtDate(e.ends_at) === mtDate(e.starts_at)
      ? `${fmtTime(e.starts_at)}–${fmtTime(e.ends_at)}`
      : fmtRange(e.starts_at, e.ends_at)

  async function go(
    key: string,
    fn: () => Promise<Entry | null>,
    success: string,
  ) {
    setBusy(key)
    const out = await act.run(fn, success)
    setBusy(null)
    return out
  }

  async function reload(): Promise<Entry> {
    const rows = await query(
      supabase.from('schedule_entries').select('*').eq('id', e.id),
    )
    if (!rows?.length)
      throw new AppError('That entry is gone. It may have been deleted.')
    return rows[0] as Entry
  }

  const claim = async () => {
    const out = await go(
      'claim',
      async () => {
        await rpc('claim_help', { p_entry: e.id })
        return reload()
      },
      'Thank you! Everyone knows you’ve got it.',
    )
    if (out) onSaved(out)
  }

  const unclaim = async () => {
    const out = await go(
      'unclaim',
      async () => {
        await rpc('unclaim_help', { p_entry: e.id })
        return reload()
      },
      'Unclaimed. It’s open for someone else.',
    )
    if (out) onSaved(out)
  }

  const cancelHelp = async () => {
    if (
      !confirm(
        'Take down this help request? Anyone who claimed it is released.',
      )
    )
      return
    const out = await go(
      'cancel',
      async () => {
        const rows = await query(
          supabase
            .from('schedule_entries')
            .update({
              help_needed: false,
              help_description: null,
              help_requested_at: null,
              claimed_by: null,
              claimed_at: null,
            })
            .eq('id', e.id)
            .select('*'),
        )
        if (!rows?.length)
          throw new AppError('Only Gabriel or Micala can change entries.')
        return rows[0] as Entry
      },
      'Help request taken down',
    )
    if (out) onSaved(out)
  }

  const remove = async () => {
    if (!confirm(`Delete “${e.title}”? This can’t be undone.`)) return
    const out = await go(
      'delete',
      async () => {
        const rows = await query(
          supabase
            .from('schedule_entries')
            .delete()
            .eq('id', e.id)
            .select('id'),
        )
        if (!rows?.length)
          throw new AppError('Only Gabriel or Micala can delete entries.')
        return null
      },
      'Entry deleted',
    )
    if (out === null) onDeleted(e.id)
  }

  return (
    <article
      id={`entry-${e.id}`}
      class={`card entry${e.help_needed ? ' entry-help' : ''}${focus === e.id ? ' focused' : ''}`}
    >
      <div class="entry-time">{time}</div>
      <div class="stack entry-main">
        <header class="entry-head">
          <h4 class="entry-title">{e.title}</h4>
          <span class={`kind kind-${e.kind}`}>{KINDS[e.kind] ?? e.kind}</span>
        </header>
        {e.location && (
          <p class="entry-line">
            <span class="meta">Where:</span> {e.location}
          </p>
        )}
        {e.notes && <p class="entry-line entry-notes">{e.notes}</p>}

        {e.help_needed && (
          <div class="help-box stack">
            <p class="help-title">Help needed</p>
            {e.help_description && (
              <p class="entry-line">{e.help_description}</p>
            )}
            {e.claimed_by ? (
              <p class="entry-line">
                <strong>
                  {mine
                    ? 'You’re taking care of this.'
                    : `${personName(e.claimed_by)} is taking care of this.`}
                </strong>
                {e.claimed_at && (
                  <span class="meta"> Claimed {timeAgo(e.claimed_at)}.</span>
                )}
              </p>
            ) : (
              <p class="entry-line meta">No one has claimed this yet.</p>
            )}
            <div class="actions">
              {!e.claimed_by && (
                <Button
                  variant="primary"
                  size="sm"
                  busy={busy === 'claim'}
                  disabled={act.busy}
                  onClick={claim}
                >
                  Claim
                </Button>
              )}
              {mine && (
                <Button
                  size="sm"
                  busy={busy === 'unclaim'}
                  disabled={act.busy}
                  onClick={unclaim}
                >
                  Unclaim
                </Button>
              )}
            </div>
          </div>
        )}

        <ErrorText error={act.error} />

        {admin && (
          <div class="actions entry-admin">
            <Button
              size="sm"
              variant="ghost"
              disabled={act.busy}
              onClick={() => onEdit(e)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={act.busy}
              onClick={() => onAsk(e)}
            >
              {e.help_needed ? 'Change help request' : 'Help needed'}
            </Button>
            {e.help_needed && (
              <Button
                size="sm"
                variant="ghost"
                busy={busy === 'cancel'}
                disabled={act.busy}
                onClick={cancelHelp}
              >
                Take down help request
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              busy={busy === 'delete'}
              disabled={act.busy}
              onClick={remove}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </article>
  )
}

// ----------------------------------------------------------------- forms

function EntryForm({
  entry,
  onSaved,
}: {
  entry?: Entry
  onSaved: (e: Entry) => void
}) {
  const [title, setTitle] = useState(entry?.title ?? '')
  const [kind, setKind] = useState<Kind>(entry?.kind ?? 'event')
  const [date, setDate] = useState(entry ? mtDate(entry.starts_at) : todayMT())
  const [start, setStart] = useState(entry ? mtTime(entry.starts_at) : '09:00')
  const [end, setEnd] = useState(entry?.ends_at ? mtTime(entry.ends_at) : '')
  const [location, setLocation] = useState(entry?.location ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const save = useAction()

  async function submit(ev: Event) {
    ev.preventDefault()
    if (!title.trim()) return save.setError(new AppError('Please add a title.'))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return save.setError(new AppError('Please pick a date.'))
    if (!/^\d{2}:\d{2}/.test(start))
      return save.setError(new AppError('Please pick a start time.'))
    const startsAt = fromMT(date, start)
    const endsAt = end ? fromMT(date, end) : null
    if (endsAt && endsAt <= startsAt)
      return save.setError(
        new AppError('The end time should be after the start time.'),
      )
    const row = {
      title: title.trim(),
      kind,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      location: location.trim() || null,
      notes: notes.trim() || null,
    }
    const out = await save.run(
      async () => {
        const rows = entry
          ? await query(
              supabase
                .from('schedule_entries')
                .update(row)
                .eq('id', entry.id)
                .select('*'),
            )
          : await query(
              supabase.from('schedule_entries').insert(row).select('*'),
            )
        if (!rows?.length)
          throw new AppError('Only Gabriel or Micala can add or edit entries.')
        return rows[0] as Entry
      },
      entry ? 'Entry saved' : 'Entry added',
    )
    if (out) onSaved(out)
  }

  return (
    <form class="stack" onSubmit={submit}>
      <Field label="Title">
        <Input
          required
          value={title}
          maxLength={140}
          onInput={e => setTitle(e.currentTarget.value)}
        />
      </Field>
      <Field label="Type">
        <Select
          value={kind}
          onChange={e => setKind(e.currentTarget.value as Kind)}
        >
          {(Object.keys(KINDS) as Kind[]).map(k => (
            <option key={k} value={k}>
              {KINDS[k]}
            </option>
          ))}
        </Select>
      </Field>
      <div class="when-grid">
        <Field label="Date" class="when-date">
          <Input
            type="date"
            required
            value={date}
            onInput={e => setDate(e.currentTarget.value)}
          />
        </Field>
        <Field label="Start">
          <Input
            type="time"
            required
            step={300}
            value={start}
            onInput={e => setStart(e.currentTarget.value)}
          />
        </Field>
        <Field label="End" optional>
          <Input
            type="time"
            step={300}
            value={end}
            onInput={e => setEnd(e.currentTarget.value)}
          />
        </Field>
      </div>
      <p class="ff-hint" style="margin:-6px 0 0">
        Mountain Time.
      </p>
      <Field label="Location" optional>
        <Input
          value={location}
          maxLength={200}
          onInput={e => setLocation(e.currentTarget.value)}
        />
      </Field>
      <Field label="Notes" optional>
        <TextArea
          value={notes}
          maxLength={2000}
          onInput={e => setNotes(e.currentTarget.value)}
        />
      </Field>
      <ErrorText error={save.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={save.busy}>
          {entry ? 'Save changes' : 'Add entry'}
        </Button>
      </div>
    </form>
  )
}

function HelpForm({
  entry,
  onSaved,
}: {
  entry: Entry
  onSaved: (e: Entry) => void
}) {
  const [text, setText] = useState(entry.help_description ?? '')
  const save = useAction()

  async function submit(ev: Event) {
    ev.preventDefault()
    if (!text.trim())
      return save.setError(new AppError('Please describe what’s needed.'))
    const out = await save.run(async () => {
      await rpc('request_help', {
        p_entry: entry.id,
        p_description: text.trim(),
      })
      const rows = await query(
        supabase.from('schedule_entries').select('*').eq('id', entry.id),
      )
      return rows?.[0] as Entry
    }, 'Help requested. The family will get an email.')
    if (out) onSaved(out)
  }

  return (
    <form class="stack" onSubmit={submit}>
      <p class="muted" style="margin:0">
        <strong>{entry.title}</strong> · {fmtLongDate(entry.starts_at)} at{' '}
        {fmtTime(entry.starts_at)}
      </p>
      <Field
        label="What’s needed?"
        hint="For example, a ride to the appointment."
      >
        <TextArea
          required
          rows={3}
          maxLength={500}
          value={text}
          onInput={e => setText(e.currentTarget.value)}
        />
      </Field>
      {entry.help_needed && (
        <Notice tone="warn">
          <p>
            Saving sends the request again
            {entry.claimed_by
              ? ` and releases ${personName(entry.claimed_by)}’s claim`
              : ''}
            .
          </p>
        </Notice>
      )}
      <ErrorText error={save.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={save.busy}>
          {entry.help_needed ? 'Update help request' : 'Ask for help'}
        </Button>
      </div>
    </form>
  )
}

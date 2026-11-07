// Admins: block time on the calendars, once or repeating, with a private note.
import { useState } from 'preact/hooks'
import { personName } from '@/lib/auth'
import { query, supabase } from '@/lib/supabase'
import {
  addDays,
  fmtDate,
  fmtDay,
  fmtRange,
  fmtTime,
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
  Select,
  TextArea,
  useAction,
  useAsync,
} from '@/lib/ui'
import { type When, WhenFields, whenEnd, whenStart } from './visit-kit'

interface Block {
  id: string
  calendar: 'visits' | 'meals' | 'all'
  starts_at: string
  ends_at: string
  repeat: 'none' | 'daily' | 'weekly'
  repeat_until: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

const CALENDARS: Record<Block['calendar'], string> = {
  visits: 'Visit calendar',
  meals: 'Meal Train',
  all: 'All calendars',
}

const isCurrent = (b: Block) =>
  b.repeat === 'none'
    ? new Date(b.ends_at) > new Date()
    : !b.repeat_until || b.repeat_until >= todayMT()

function repeatText(b: Block) {
  if (b.repeat === 'none') return 'Once'
  const every = b.repeat === 'daily' ? 'Every day' : 'Every week'
  return b.repeat_until ? `${every} until ${fmtDay(b.repeat_until)}` : every
}

function whenText(b: Block) {
  if (b.repeat === 'none') return fmtRange(b.starts_at, b.ends_at)
  return `${fmtTime(b.starts_at)}–${fmtTime(b.ends_at)}, from ${fmtDate(b.starts_at)}`
}

export function BlocksManager({
  person,
  onChanged,
}: {
  person: string
  onChanged: () => void
}) {
  const list = useAsync(() =>
    query<Block[]>(supabase.from('blocks').select('*').order('starts_at')),
  )
  const [showPast, setShowPast] = useState(false)
  const [adding, setAdding] = useState(false)

  const blocks = (list.data ?? []).filter(b => showPast || isCurrent(b))
  const changed = () => {
    list.reload()
    onChanged()
  }

  return (
    <div class="stack">
      <div class="spread">
        <Check checked={showPast} onChange={setShowPast}>
          Show past blocks
        </Check>
        {!adding && (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            Block time
          </Button>
        )}
      </div>
      {adding && (
        <AddBlock
          person={person}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false)
            changed()
          }}
        />
      )}
      {list.error && <ErrorText error={list.error} />}
      {list.loading && !list.data ? (
        <Loading />
      ) : blocks.length ? (
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Repeats</th>
                <th>Calendar</th>
                <th>Private note</th>
                <th>
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {blocks.map(b => (
                <BlockRow key={b.id} b={b} onDeleted={changed} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No blocked time{showPast ? '' : ' coming up'}.</Empty>
      )}
    </div>
  )
}

function BlockRow({ b, onDeleted }: { b: Block; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const act = useAction()
  async function del() {
    const r = await act.run(async () => {
      await query(supabase.from('blocks').delete().eq('id', b.id))
      return true
    }, 'Block removed')
    if (r) onDeleted()
  }
  return (
    <tr class={isCurrent(b) ? undefined : 'muted'}>
      <td class="fam-nowrap-sm">{whenText(b)}</td>
      <td>{repeatText(b)}</td>
      <td>{CALENDARS[b.calendar]}</td>
      <td>
        {b.note || <span class="muted">None</span>}
        {b.created_by && (
          <div class="meta">Added by {personName(b.created_by)}</div>
        )}
        {act.error ? <ErrorText error={act.error} /> : null}
      </td>
      <td>
        {confirm ? (
          <div class="actions">
            <Button size="sm" variant="danger" busy={act.busy} onClick={del}>
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Keep
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirm(true)}
            aria-label={`Delete block: ${whenText(b)}`}
          >
            Delete
          </Button>
        )}
      </td>
    </tr>
  )
}

function AddBlock({
  person,
  onCancel,
  onDone,
}: {
  person: string
  onCancel: () => void
  onDone: () => void
}) {
  const today = todayMT()
  const [calendar, setCalendar] = useState<Block['calendar']>('all')
  const [when, setWhen] = useState<When>({
    sd: today,
    st: '13:00',
    ed: today,
    et: '15:00',
  })
  const [repeat, setRepeat] = useState<Block['repeat']>('none')
  const [until, setUntil] = useState(addDays(today, 14))
  const [note, setNote] = useState('')
  const act = useAction()

  async function submit(e: Event) {
    e.preventDefault()
    const r = await act.run(async () => {
      await query(
        supabase.from('blocks').insert({
          calendar,
          starts_at: whenStart(when),
          ends_at: whenEnd(when),
          repeat,
          repeat_until: repeat === 'none' || !until ? null : until,
          note: note.trim() || null,
          created_by: person,
        }),
      )
      return true
    }, 'Time blocked')
    if (r) onDone()
  }

  return (
    <form class="fam-inline-form stack" onSubmit={submit}>
      <h3 class="fam-h3">Block time</h3>
      <p class="small">
        Blocked time shows red to guests. Only Gabriel and Micala see the note.
      </p>
      <Field label="Calendar">
        <Select
          value={calendar}
          onChange={e =>
            setCalendar(e.currentTarget.value as Block['calendar'])
          }
        >
          {Object.entries(CALENDARS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <WhenFields value={when} onChange={setWhen} />
      <div class="fam-when">
        <Field label="Repeat">
          <Select
            value={repeat}
            onChange={e => setRepeat(e.currentTarget.value as Block['repeat'])}
          >
            <option value="none">Don’t repeat</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
          </Select>
        </Field>
        {repeat !== 'none' && (
          <Field
            label="Repeat until"
            optional
            hint="Leave empty to repeat with no end."
          >
            <Input
              type="date"
              value={until}
              min={when.sd}
              onInput={e => setUntil(e.currentTarget.value)}
            />
          </Field>
        )}
      </div>
      <Field
        label="Private note"
        optional
        hint="For example, “nap time” or “doctor visit”."
      >
        <TextArea
          value={note}
          onInput={e => setNote(e.currentTarget.value)}
          maxLength={500}
          rows={2}
        />
      </Field>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={act.busy}>
          Block time
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

import { useEffect, useMemo, useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import {
  clockWindow,
  loadMealSettings,
  MealPill,
  type MealSettings,
  type MealSlotDef,
} from '@/components/meals/shared'
import { type FamilyStatus, isAdmin, personName } from '@/lib/auth'
import { query, rpc, supabase } from '@/lib/supabase'
import {
  addDays,
  dayOfWeek,
  fmtDateTime,
  fmtDay,
  fromMT,
  timeAgo,
  todayMT,
} from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Field,
  Legend,
  Loading,
  Modal,
  TextArea,
  useAction,
  useAsync,
  useQueryParam,
} from '@/lib/ui'

interface MealRow {
  id: string
  token: string
  date: string
  slot_key: string
  visitor_id: string
  name: string
  status:
    | 'draft'
    | 'submitted'
    | 'approved'
    | 'denied'
    | 'cancelled'
    | 'expired'
  dish: string | null
  decision_note: string | null
  decided_by: string | null
  decided_at: string | null
  cancel_note: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  created_at: string
  confirmed_at: string | null
}

interface ContactRow {
  visitor_id: string
  email: string
  phone: string | null
}

const COLUMNS =
  'id, token, date, slot_key, visitor_id, name, status, dish, decision_note, decided_by, decided_at, cancel_note, cancelled_by, cancelled_at, created_at, confirmed_at'

export function FamilyMeals() {
  return (
    <FamilyGate>{family => <FamilyMealsInner family={family} />}</FamilyGate>
  )
}

function slotStart(m: MealRow, slots: MealSlotDef[]): number {
  const def = slots.find(s => s.key === m.slot_key)
  return fromMT(m.date, def?.start ?? '00:00').getTime()
}

function FamilyMealsInner({ family }: { family: FamilyStatus }) {
  const focusId = useQueryParam('id')
  const admin = isAdmin(family)
  const today = todayMT()

  const data = useAsync(async () => {
    const [settings, rows] = await Promise.all([
      loadMealSettings(),
      query(
        supabase
          .from('meal_signups')
          .select(COLUMNS)
          .gte('date', addDays(today, -14))
          .order('date')
          .limit(500),
      ),
    ])
    let list = (rows ?? []) as MealRow[]
    if (focusId && !list.some(m => m.id === focusId)) {
      const one = await query(
        supabase
          .from('meal_signups')
          .select(COLUMNS)
          .eq('id', focusId)
          .maybeSingle(),
      )
      if (one) list = [one as MealRow, ...list]
    }
    let contacts: Record<string, ContactRow> = {}
    if (admin && list.length) {
      const ids = [...new Set(list.map(m => m.visitor_id))]
      const cs = await query(
        supabase
          .from('visitor_contacts')
          .select('visitor_id, email, phone')
          .in('visitor_id', ids),
      )
      contacts = Object.fromEntries(
        ((cs ?? []) as ContactRow[]).map(c => [c.visitor_id, c]),
      )
    }
    return { settings, list, contacts }
  }, [admin, focusId])

  useEffect(() => {
    if (!focusId || !data.data) return
    document
      .getElementById(`meal-${focusId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusId, data.data])

  if (data.loading && !data.data) return <Loading />
  if (!data.data) return <ErrorText error={data.error} />
  const { settings, list, contacts } = data.data
  const byStart = (a: MealRow, b: MealRow) =>
    slotStart(a, settings.slots) - slotStart(b, settings.slots)
  const waiting = list
    .filter(m => m.status === 'draft' || m.status === 'submitted')
    .sort(byStart)
  const upcoming = list
    .filter(m => m.status === 'approved' && m.date >= today)
    .sort(byStart)
  const closed = list
    .filter(m => !waiting.includes(m) && !upcoming.includes(m))
    .sort((a, b) => byStart(b, a))
  const focusedClosed = closed.some(m => m.id === focusId)

  const item = (m: MealRow) => (
    <MealItem
      key={m.id}
      meal={m}
      settings={settings}
      contact={contacts[m.visitor_id]}
      focused={m.id === focusId}
      onChange={data.reload}
    />
  )

  return (
    <div class="stack">
      <ErrorText error={data.error} />
      <section class="section stack" aria-labelledby="fm-waiting">
        <h2 id="fm-waiting">Waiting sign-ups</h2>
        {waiting.length ? (
          <ul class="fm-list">{waiting.map(item)}</ul>
        ) : (
          <Empty>No sign-ups waiting.</Empty>
        )}
      </section>

      <section class="section stack" aria-labelledby="fm-upcoming">
        <h2 id="fm-upcoming">Upcoming drop-offs</h2>
        {upcoming.length ? (
          <ul class="fm-list">{upcoming.map(item)}</ul>
        ) : (
          <Empty>No approved drop-offs coming up.</Empty>
        )}
      </section>

      {closed.length > 0 && (
        <details class="section fm-closed" open={focusedClosed}>
          <summary>Past and closed sign-ups ({closed.length})</summary>
          <ul class="fm-list">{closed.map(item)}</ul>
        </details>
      )}

      <OpenDates family={family} admin={admin} signups={list} />
    </div>
  )
}

function MealItem({
  meal: m,
  settings,
  contact,
  focused,
  onChange,
}: {
  meal: MealRow
  settings: MealSettings
  contact?: ContactRow
  focused: boolean
  onChange: () => void
}) {
  const def = settings.slots.find(s => s.key === m.slot_key)
  const [modal, setModal] = useState<'deny' | 'cancel' | null>(null)
  const approve = useAction()

  return (
    <li
      id={`meal-${m.id}`}
      class={`card fm-item${focused ? ' is-focused' : ''}`}
    >
      <div class="spread">
        <div>
          <p class="card-title">{m.name}</p>
          <p class="meta">
            {def?.label ?? m.slot_key}, {fmtDay(m.date)}
            {def && `, ${clockWindow(def.start, def.end)}`}
          </p>
        </div>
        <MealPill status={m.status} />
      </div>

      <dl class="fm-facts">
        {m.dish && (
          <>
            <dt>Bringing</dt>
            <dd>{m.dish}</dd>
          </>
        )}
        {contact && (
          <>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
              {contact.phone && (
                <>
                  {' · '}
                  <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                </>
              )}
            </dd>
          </>
        )}
        <dt>Signed up</dt>
        <dd>{timeAgo(m.created_at)}</dd>
        {m.decided_by && (
          <>
            <dt>{m.status === 'denied' ? 'Denied by' : 'Approved by'}</dt>
            <dd>
              {personName(m.decided_by)}
              {m.decision_note && ` · “${m.decision_note}”`}
            </dd>
          </>
        )}
        {m.cancelled_by && (
          <>
            <dt>Cancelled by</dt>
            <dd>
              {personName(m.cancelled_by)}
              {m.cancelled_at && `, ${fmtDateTime(m.cancelled_at)}`}
              {m.cancel_note && ` · “${m.cancel_note}”`}
            </dd>
          </>
        )}
      </dl>

      {m.status === 'draft' && (
        <p class="small muted">
          Waiting for them to confirm what they’ll bring.
        </p>
      )}
      <ErrorText error={approve.error} />
      {(m.status === 'draft' ||
        m.status === 'submitted' ||
        m.status === 'approved') && (
        <div class="actions">
          {m.status === 'submitted' && (
            <Button
              variant="primary"
              size="sm"
              busy={approve.busy}
              onClick={async () => {
                const ok = await approve.run(
                  () =>
                    rpc('family_decide_meal', {
                      p_meal: m.id,
                      p_approve: true,
                    }).then(() => true),
                  'Approved. They’ll get the drop-off instructions by email.',
                )
                if (ok) onChange()
              }}
            >
              Approve
            </Button>
          )}
          {m.status !== 'approved' && (
            <Button size="sm" onClick={() => setModal('deny')}>
              Deny with a note
            </Button>
          )}
          {m.status === 'approved' && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setModal('cancel')}
            >
              Cancel this drop-off
            </Button>
          )}
        </div>
      )}

      <NoteModal
        open={modal !== null}
        kind={modal ?? 'deny'}
        meal={m}
        onClose={() => setModal(null)}
        onDone={() => {
          setModal(null)
          onChange()
        }}
      />
    </li>
  )
}

function NoteModal({
  open,
  kind,
  meal,
  onClose,
  onDone,
}: {
  open: boolean
  kind: 'deny' | 'cancel'
  meal: MealRow
  onClose: () => void
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  const act = useAction()
  const deny = kind === 'deny'

  async function go() {
    const ok = await act.run(
      () =>
        (deny
          ? rpc('family_decide_meal', {
              p_meal: meal.id,
              p_approve: false,
              p_note: note.trim() || null,
            })
          : rpc('family_cancel_meal', {
              p_meal: meal.id,
              p_note: note.trim() || null,
            })
        ).then(() => true),
      deny
        ? 'Denied. We emailed them your note.'
        : 'Cancelled. We emailed them your note.',
    )
    if (ok) {
      setNote('')
      onDone()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        deny
          ? `Deny ${meal.name}’s sign-up?`
          : `Cancel ${meal.name}’s drop-off?`
      }
    >
      <div class="stack">
        <p>
          {deny
            ? 'The slot opens up again. They’ll get a thank-you email with your note and a link to pick another slot.'
            : 'The slot opens up again. They’ll get an apology email with your note.'}
        </p>
        <Field
          label="Note"
          optional
          hint={
            deny ? 'For example, a slot that would work better.' : undefined
          }
        >
          <TextArea
            value={note}
            maxLength={500}
            onInput={e => setNote(e.currentTarget.value)}
          />
        </Field>
        <ErrorText error={act.error} />
        <div class="actions">
          <Button
            variant={deny ? 'primary' : 'danger'}
            busy={act.busy}
            onClick={go}
          >
            {deny ? 'Deny sign-up' : 'Cancel drop-off'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Back
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------- open dates

const monthStart = (date: string) => `${date.slice(0, 7)}-01`
function addMonths(first: string, n: number): string {
  const [y, m] = first.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-01`
}
const monthFmt = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthName = (first: string) =>
  monthFmt.format(new Date(`${first}T12:00:00Z`))

function OpenDates({
  family,
  admin,
  signups,
}: {
  family: FamilyStatus
  admin: boolean
  signups: MealRow[]
}) {
  const today = todayMT()
  const [month, setMonth] = useState(monthStart(today))
  const next = addMonths(month, 1)
  const dates = useAsync(async () => {
    const rows = await query(
      supabase
        .from('meal_dates')
        .select('date')
        .gte('date', month)
        .lt('date', next),
    )
    return new Set(((rows ?? []) as { date: string }[]).map(r => r.date))
  }, [month])
  const act = useAction()

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of signups)
      if (['draft', 'submitted', 'approved'].includes(m.status))
        c[m.date] = (c[m.date] ?? 0) + 1
    return c
  }, [signups])

  const days = useMemo(() => {
    const out: string[] = []
    for (let d = month; d < next; d = addDays(d, 1)) out.push(d)
    return out
  }, [month, next])

  async function toggle(date: string) {
    const open = dates.data?.has(date)
    if (open && counts[date]) {
      const ok = confirm(
        `${fmtDay(date)} has ${counts[date]} active sign-up${counts[date] > 1 ? 's' : ''}. Closing the date won’t cancel ${counts[date] > 1 ? 'them' : 'it'}. Close it anyway?`,
      )
      if (!ok) return
    }
    const done = await act.run(async () => {
      if (open)
        await query(
          supabase.from('meal_dates').delete().eq('date', date).select(),
        )
      else
        await query(
          supabase
            .from('meal_dates')
            .insert({ date, created_by: family.person })
            .select(),
        )
      return true
    })
    if (done) dates.reload()
  }

  async function openNext14() {
    const rows = Array.from({ length: 14 }, (_, i) => ({
      date: addDays(today, i),
      created_by: family.person,
    }))
    const done = await act.run(async () => {
      await query(
        supabase
          .from('meal_dates')
          .upsert(rows, { onConflict: 'date', ignoreDuplicates: true })
          .select(),
      )
      return true
    }, 'The next 14 days are open for meals.')
    if (done) dates.reload()
  }

  return (
    <section class="section stack" aria-labelledby="fm-dates">
      <div class="spread">
        <h2 id="fm-dates">Open dates</h2>
        {admin && (
          <Button
            size="sm"
            variant="primary"
            busy={act.busy}
            onClick={openNext14}
          >
            Open the next 14 days
          </Button>
        )}
      </div>
      <p class="muted small">
        {admin
          ? 'Tap a date to open or close it for Meal Train sign-ups. Dates that aren’t open show red to guests.'
          : 'Only Gabriel and Micala open and close dates. Dates that aren’t open show red to guests.'}
      </p>
      <Legend
        states={['green', 'red']}
        labels={{ green: 'Open for meals', red: 'Not open' }}
      />
      <ErrorText error={act.error ?? dates.error} />
      <div class="card stack">
        <div class="spread">
          <Button
            size="sm"
            onClick={() => setMonth(addMonths(month, -1))}
            disabled={month <= monthStart(today)}
            aria-label="Previous month"
          >
            ‹
          </Button>
          <h3 class="h3 mc-title">{monthName(month)}</h3>
          <Button
            size="sm"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Next month"
          >
            ›
          </Button>
        </div>
        <div class="mc-grid" aria-busy={dates.loading || undefined}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span class="mc-dow" key={i} aria-hidden="true">
              {d}
            </span>
          ))}
          {Array.from({ length: dayOfWeek(month) }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {days.map(d => {
            const open = !!dates.data?.has(d)
            const past = d < today
            const n = counts[d] ?? 0
            const label = `${fmtDay(d)}: ${open ? 'open' : 'not open'}${n ? `, ${n} sign-up${n > 1 ? 's' : ''}` : ''}`
            const cls = `mc-day ${past ? 'is-past' : open ? 'st-green' : 'st-red'}${d === today ? ' is-today' : ''}`
            const body = (
              <>
                <span class="mc-num">{Number(d.slice(8))}</span>
                {n > 0 && <span class="mc-count">{n}</span>}
              </>
            )
            return admin && !past ? (
              <button
                type="button"
                key={d}
                class={cls}
                aria-label={`${label}. ${open ? 'Close' : 'Open'} this date`}
                aria-pressed={open}
                disabled={act.busy || dates.loading}
                onClick={() => toggle(d)}
              >
                {body}
              </button>
            ) : (
              <span key={d} class={cls} aria-label={label} role="img">
                {body}
              </span>
            )
          })}
        </div>
        <p class="meta">Numbers show active sign-ups on that date.</p>
      </div>
    </section>
  )
}

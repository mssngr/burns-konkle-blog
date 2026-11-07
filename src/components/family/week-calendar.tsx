// The family's week view of the visit calendar: approved and pending bookings with names, plus blocked time.
import { useState } from 'preact/hooks'
import { query, supabase } from '@/lib/supabase'
import {
  addDays,
  fmtDay,
  fmtTime,
  fromMT,
  mtDate,
  todayMT,
  weekStart,
} from '@/lib/time'
import {
  Button,
  ErrorText,
  Legend,
  Loading,
  type SlotState,
  useAsync,
} from '@/lib/ui'
import { type BookingType, call, statusColor } from './visit-kit'

interface CalBooking {
  id: string
  name: string
  type_id: number
  status: string
  starts_at: string
  ends_at: string
  headcount: number
}

interface CalBlock {
  block_id: string
  calendar: string
  starts_at: string
  ends_at: string
  note: string | null
}

interface Item {
  key: string
  color: SlotState
  s: string
  e: string
  title: string
  sub: string
  id?: string
}

/** "10 AM–12 PM", "From 2 PM", "Until 11 AM", or "All day", for the part of [s, e) that falls on this day. */
function dayPart(s: string, e: string, day: string) {
  const startsToday = mtDate(s) === day
  const endsToday = new Date(e) <= fromMT(addDays(day, 1))
  if (startsToday && endsToday) return `${fmtTime(s)}–${fmtTime(e)}`
  if (startsToday) return `From ${fmtTime(s)}`
  if (endsToday) return `Until ${fmtTime(e)}`
  return 'All day'
}

export function WeekCalendar({
  types,
  refresh,
  onOpen,
}: {
  types: BookingType[]
  refresh: number
  onOpen: (id: string) => void
}) {
  const [ws, setWs] = useState(() => weekStart(todayMT()))
  const from = fromMT(ws).toISOString()
  const to = fromMT(addDays(ws, 7)).toISOString()

  const data = useAsync(async () => {
    const [bookings, blocks] = await Promise.all([
      query<CalBooking[]>(
        supabase
          .from('bookings')
          .select('id, name, type_id, status, starts_at, ends_at, headcount')
          .in('status', ['draft', 'submitted', 'approved'])
          .lt('starts_at', to)
          .gt('ends_at', from)
          .order('starts_at'),
      ),
      call<CalBlock[]>('family_block_times', {
        p_calendar: 'visits',
        p_from: from,
        p_to: to,
      }),
    ])
    return { bookings, blocks }
  }, [from, to, refresh])

  const typeName = (id: number) => types.find(t => t.id === id)?.name ?? ''
  const items: Item[] = [
    ...(data.data?.blocks ?? []).map(b => ({
      key: `blk-${b.block_id}-${b.starts_at}`,
      color: 'red' as SlotState,
      s: b.starts_at,
      e: b.ends_at,
      title: b.note || 'Blocked',
      sub: b.calendar === 'all' ? 'All calendars' : 'Visit calendar',
    })),
    ...(data.data?.bookings ?? []).map(b => ({
      key: b.id,
      color: statusColor(b.status) ?? 'blue',
      s: b.starts_at,
      e: b.ends_at,
      title: b.name,
      sub: `${typeName(b.type_id)}${b.headcount ? `, ${b.headcount} ${b.headcount === 1 ? 'person' : 'people'}` : ''}`,
      id: b.id,
    })),
  ].sort((a, b) => a.s.localeCompare(b.s))

  const today = todayMT()
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))

  return (
    <div class="stack">
      <div class="spread">
        <div class="row">
          <Button
            size="sm"
            onClick={() => setWs(addDays(ws, -7))}
            aria-label="Previous week"
          >
            ‹ Prev
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setWs(weekStart(todayMT()))}
            disabled={ws === weekStart(today)}
          >
            This week
          </Button>
          <Button
            size="sm"
            onClick={() => setWs(addDays(ws, 7))}
            aria-label="Next week"
          >
            Next ›
          </Button>
        </div>
        <strong>
          {fmtDay(ws)} – {fmtDay(addDays(ws, 6))}
        </strong>
      </div>
      <Legend
        states={['yellow', 'orange', 'blue', 'red']}
        labels={{
          yellow: 'Not finished',
          orange: 'Waiting for approval',
          blue: 'Approved',
          red: 'Blocked',
        }}
      />
      {data.error && <ErrorText error={data.error} />}
      {data.loading && !data.data ? (
        <Loading />
      ) : (
        <div class="fam-week" aria-busy={data.loading || undefined}>
          {days.map(day => {
            const dayStart = fromMT(day)
            const dayEnd = fromMT(addDays(day, 1))
            const todays = items.filter(
              it => new Date(it.s) < dayEnd && new Date(it.e) > dayStart,
            )
            return (
              <section
                key={day}
                class={`fam-day${day === today ? ' is-today' : ''}`}
                aria-label={fmtDay(day)}
              >
                <h3 class="fam-day-head">{fmtDay(day)}</h3>
                {todays.length ? (
                  <ul>
                    {todays.map(it => (
                      <li key={it.key}>
                        {it.id ? (
                          <button
                            type="button"
                            class={`fam-ev st-${it.color}`}
                            onClick={() => onOpen(it.id as string)}
                          >
                            <span class="fam-ev-time">
                              {dayPart(it.s, it.e, day)}
                            </span>
                            <span class="fam-ev-title">{it.title}</span>
                            <span class="fam-ev-sub">{it.sub}</span>
                          </button>
                        ) : (
                          <div class={`fam-ev st-${it.color}`}>
                            <span class="fam-ev-time">
                              {dayPart(it.s, it.e, day)}
                            </span>
                            <span class="fam-ev-title">{it.title}</span>
                            <span class="fam-ev-sub">{it.sub}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p class="fam-day-empty">Nothing booked</p>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

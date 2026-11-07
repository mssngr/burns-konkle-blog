import { Fragment } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { addDays, fmtClock, fmtDay, mtDate, mtTime, todayMT } from '@/lib/time'
import { STATE_LABELS } from '@/lib/ui'
import { type CalendarSlot, RED_REASONS, type VisitCalendar } from './types'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Open enough to start a request: pending requests don't use up room. */
export const canPick = (s: CalendarSlot) => s.s !== 'red' && s.s !== 'purple'

function describe(s: CalendarSlot): string {
  const when = `${fmtDay(mtDate(s.t))} at ${fmtClock(mtTime(s.t))}`
  const what = s.s === 'red' && s.r ? RED_REASONS[s.r] : STATE_LABELS[s.s]
  return `${when}: ${what}`
}

/**
 * One week of 15-minute slots for a booking type. A 7-day grid on wider screens;
 * on phones, one day at a time with a day picker.
 */
export function WeekCalendar({
  cal,
  from,
  selected,
  focus,
  onPick,
}: {
  cal: VisitCalendar
  from: string
  selected?: { start: Date; end: Date } | null
  /** Show this day on phones (the picked start date). */
  focus?: string
  onPick: (date: string, time: string) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const byKey = new Map<string, CalendarSlot>()
  const times = new Set<string>()
  for (const s of cal.slots) {
    const t = mtTime(s.t)
    byKey.set(`${mtDate(s.t)} ${t}`, s)
    times.add(t)
  }
  const rows = [...times].sort()
  const hours = [...new Set(rows.map(r => r.slice(0, 2)))]

  const today = todayMT()
  // Phones start on the first day from today with an open time.
  const firstDay = () =>
    days.find(
      d => d >= today && cal.slots.some(s => mtDate(s.t) === d && canPick(s)),
    ) ?? (days.includes(today) ? today : from)
  const [day, setDay] = useState(firstDay)
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the day only when the week changes
  useEffect(() => setDay(firstDay()), [from])
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the picked date
  useEffect(() => {
    if (focus && days.includes(focus)) setDay(focus)
  }, [focus])

  const isSel = (s: CalendarSlot) => {
    if (!selected) return false
    const t = new Date(s.t).getTime()
    return t >= selected.start.getTime() && t < selected.end.getTime()
  }

  const cell = (date: string, time: string, compact: boolean) => {
    const s = byKey.get(`${date} ${time}`)
    if (!s) return <span class="wk-cell wk-none" aria-hidden="true" />
    const pick = canPick(s)
    return (
      <button
        type="button"
        class={`wk-cell st-${s.s}${isSel(s) ? ' is-sel' : ''}`}
        disabled={!pick}
        aria-label={describe(s)}
        title={describe(s)}
        onClick={() => onPick(date, time)}
      >
        {!compact && <span class="wk-cell-label">:{time.slice(3)}</span>}
      </button>
    )
  }

  if (!rows.length)
    return <p class="empty-state">No times to show for this week.</p>

  return (
    <div class="wk">
      {/* Phones: one day at a time. */}
      <div class="wk-phone">
        <div class="wk-days" role="tablist" aria-label="Day">
          {days.map(d => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === day}
              class={`wk-day${d === day ? ' is-on' : ''}`}
              onClick={() => setDay(d)}
            >
              <span>{DOW[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
              <strong>{Number(d.slice(8))}</strong>
            </button>
          ))}
        </div>
        <p class="wk-dayname">{fmtDay(day)}</p>
        <div class="wk-hours">
          {hours.map(h => (
            <div class="wk-hour" key={h}>
              <span class="wk-hour-label">{fmtClock(`${h}:00`)}</span>
              <div class="wk-quarters">
                {['00', '15', '30', '45'].map(m =>
                  rows.includes(`${h}:${m}`) ? (
                    <span key={m}>{cell(day, `${h}:${m}`, false)}</span>
                  ) : (
                    <span key={m} />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wider screens: the whole week. */}
      <div class="wk-wide">
        <div
          class="wk-grid"
          style={`grid-template-rows: auto repeat(${rows.length}, var(--wk-row))`}
        >
          <span class="wk-corner" />
          {days.map(d => (
            <span key={d} class={`wk-head${d === today ? ' is-today' : ''}`}>
              {DOW[new Date(`${d}T12:00:00Z`).getUTCDay()]}{' '}
              <strong>{Number(d.slice(8))}</strong>
            </span>
          ))}
          {rows.map(t => (
            <Fragment key={t}>
              <span class={`wk-time${t.endsWith(':00') ? '' : ' is-quiet'}`}>
                {t.endsWith(':00') ? fmtClock(t) : ''}
              </span>
              {days.map(d => (
                <span
                  key={`${d}${t}`}
                  class={`wk-slot${t.endsWith(':00') ? ' is-hour' : ''}`}
                >
                  {cell(d, t, true)}
                </span>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

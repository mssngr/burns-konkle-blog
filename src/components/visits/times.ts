// Which start and end times a booking type allows, all in Mountain Time on 15-minute steps.
// The server re-checks everything; this only keeps the pickers to sensible choices.
import { addDays, clockSteps, fromMT, mtDate, mtTime } from '@/lib/time'
import type { BookingType } from './types'

export const STEP = 15
const MIN = 60_000

export interface Hours {
  start: string
  end: string
}

/** Picked times as wall-clock strings ('' when not chosen yet). */
export interface Times {
  sd: string
  st: string
  ed: string
  et: string
}

export const emptyTimes: Times = { sd: '', st: '', ed: '', et: '' }

export interface Limits {
  hours: Hours
  /** Earliest allowed start (the cutoff), if any. */
  minStart?: Date | null
  /** This start is always allowed (the booking's current start, when proposing a change). */
  keepStart?: string | null
  /** Shortening: new times must fit inside these. */
  inside?: { from: Date; to: Date } | null
}

type T = Pick<BookingType, 'hours_rule' | 'max_minutes'>

/** Can this type start and end on different days? (Stays, trips, long outings.) */
export const spansDays = (t: T) =>
  t.hours_rule !== 'within' &&
  (t.max_minutes == null || t.max_minutes > 24 * 60)

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
const fromMin = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

function clockStarts(t: T, h: Hours): string[] {
  if (t.hours_rule === 'none') return clockSteps('00:00', '23:45', STEP)
  if (t.hours_rule === 'within')
    return clockSteps(h.start, fromMin(toMin(h.end) - STEP), STEP)
  return clockSteps(h.start, h.end, STEP)
}

function clockEnds(t: T, h: Hours): string[] {
  if (t.hours_rule === 'none') return clockSteps('00:00', '23:45', STEP)
  if (t.hours_rule === 'within')
    return clockSteps(fromMin(toMin(h.start) + STEP), h.end, STEP)
  return clockSteps(h.start, h.end, STEP)
}

/** End times on `endDate` that work for a start instant. */
export function endOptions(
  t: T,
  lim: Limits,
  start: Date | null,
  endDate: string,
): string[] {
  if (!start || !endDate) return []
  const max = t.max_minutes ?? Number.POSITIVE_INFINITY
  return clockEnds(t, lim.hours).filter(c => {
    const e = fromMT(endDate, c).getTime()
    const mins = (e - start.getTime()) / MIN
    if (mins <= 0 || mins > max) return false
    if (lim.inside && e > lim.inside.to.getTime()) return false
    return true
  })
}

/** Start times on `date` that are allowed (and, for same-day types, leave room for an end). */
export function startOptions(t: T, lim: Limits, date: string): string[] {
  if (!date) return []
  const same = !spansDays(t)
  return clockStarts(t, lim.hours).filter(c => {
    const s = fromMT(date, c)
    const iso = s.toISOString()
    const kept = lim.keepStart && new Date(lim.keepStart).toISOString() === iso
    if (!kept && lim.minStart && s < lim.minStart) return false
    if (lim.inside && (s < lim.inside.from || s >= lim.inside.to)) return false
    if (same && endOptions(t, lim, s, date).length === 0) return false
    return true
  })
}

/** The first date (from `from`) with any start time left, looking a few days ahead. */
export function firstOpenDate(t: T, lim: Limits, from: string): string {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i)
    if (startOptions(t, lim, d).length) return d
  }
  return from
}

/** The latest date an end can fall on, for the end-date picker. */
export function lastEndDate(
  t: T,
  startDate: string,
  lim: Limits,
): string | undefined {
  if (lim.inside) return mtDate(lim.inside.to)
  if (!spansDays(t) || t.max_minutes == null) return undefined
  return addDays(startDate, Math.ceil(t.max_minutes / (24 * 60)))
}

export const startOf = (v: Times) => (v.sd && v.st ? fromMT(v.sd, v.st) : null)
export const endOf = (v: Times, t: T) => {
  const ed = spansDays(t) ? v.ed : v.sd
  return ed && v.et ? fromMT(ed, v.et) : null
}

/** Both instants when the picked times are complete and allowed. */
export function resolve(
  t: T,
  lim: Limits,
  v: Times,
): { start: Date; end: Date } | null {
  const start = startOf(v)
  const end = endOf(v, t)
  if (!start || !end) return null
  if (!startOptions(t, lim, v.sd).includes(v.st)) return null
  if (!endOptions(t, lim, start, spansDays(t) ? v.ed : v.sd).includes(v.et))
    return null
  return { start, end }
}

/**
 * Fill in sensible defaults after the start changes: same-day types get an end
 * close to their usual length; multi-day types keep the end if it still works.
 */
export function settle(t: T, lim: Limits, v: Times): Times {
  const start = startOf(v)
  if (!start) return v
  if (!spansDays(t)) {
    const ends = endOptions(t, lim, start, v.sd)
    if (ends.includes(v.et)) return { ...v, ed: v.sd }
    const want = Math.min(t.max_minutes ?? 120, 120)
    const target = start.getTime() + want * MIN
    const pick =
      [...ends].reverse().find(c => fromMT(v.sd, c).getTime() <= target) ??
      ends[0] ??
      ''
    return { ...v, ed: v.sd, et: pick }
  }
  const ed = v.ed && v.ed >= v.sd ? v.ed : v.sd
  const ends = endOptions(t, lim, start, ed)
  return { ...v, ed, et: ends.includes(v.et) ? v.et : '' }
}

/** Times for an existing booking, as picker values. */
export const timesOf = (s: string, e: string): Times => ({
  sd: mtDate(s),
  st: mtTime(s),
  ed: mtDate(e),
  et: mtTime(e),
})

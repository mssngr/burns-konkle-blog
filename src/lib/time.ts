// Every time on the site is Mountain Time, whatever the viewer's own time zone.
export const TZ = 'America/Denver'

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

type Parts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function parts(d: Date): Parts {
  const out: Record<string, number> = {}
  for (const p of partsFmt.formatToParts(d))
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  return out as Parts
}

const pad = (n: number) => String(n).padStart(2, '0')

export const toDate = (d: Date | string) =>
  typeof d === 'string' ? new Date(d) : d

/** "YYYY-MM-DD" in Mountain Time. */
export function mtDate(d: Date | string): string {
  const p = parts(toDate(d))
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** "HH:MM" (24-hour) in Mountain Time. */
export function mtTime(d: Date | string): string {
  const p = parts(toDate(d))
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** The instant for a Mountain Time wall-clock date and time. */
export function fromMT(date: string, time = '00:00'): Date {
  const [y, mo, da] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, da, h, mi)
  // Guess, then correct by the zone offset at that guess (twice covers DST edges).
  let t = wall
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(t))
    const asUTC = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second,
    )
    t += wall - asUTC
  }
  return new Date(t)
}

export const todayMT = () => mtDate(new Date())

/** Add days to a "YYYY-MM-DD" date. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Day of week (0 = Sunday) for a "YYYY-MM-DD" date. */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** The Sunday that starts the week containing this date. */
export const weekStart = (date: string) => addDays(date, -dayOfWeek(date))

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts })
const dateFmt = fmt({ weekday: 'short', month: 'short', day: 'numeric' })
const longDateFmt = fmt({ weekday: 'long', month: 'long', day: 'numeric' })
const timeFmt = fmt({ hour: 'numeric', minute: '2-digit' })

/** "Tue, Nov 10" */
export const fmtDate = (d: Date | string) => dateFmt.format(toDate(d))
/** "Tuesday, November 10" */
export const fmtLongDate = (d: Date | string) => longDateFmt.format(toDate(d))
/** "10:00 AM" (drops ":00" for whole hours: "10 AM") */
export const fmtTime = (d: Date | string) =>
  timeFmt.format(toDate(d)).replace(':00', '')
/** "Tue, Nov 10 at 10 AM" */
export const fmtDateTime = (d: Date | string) =>
  `${fmtDate(d)} at ${fmtTime(d)}`

/** "Tue, Nov 10, 10 AM–12 PM" or "Tue, Nov 10 at 2 PM to Thu, Nov 12 at 11 AM" */
export function fmtRange(s: Date | string, e: Date | string): string {
  return mtDate(s) === mtDate(e)
    ? `${fmtDate(s)}, ${fmtTime(s)}–${fmtTime(e)}`
    : `${fmtDateTime(s)} to ${fmtDateTime(e)}`
}

/** Format a "YYYY-MM-DD" date (no time) as "Tue, Nov 10". */
export const fmtDay = (date: string) => fmtDate(fromMT(date, '12:00'))

/** "HH:MM" → "9 AM" */
export function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const hr = ((h + 11) % 12) + 1
  return `${hr}${m ? `:${pad(m)}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}

/** Every "HH:MM" from start to end (inclusive) in steps of `step` minutes. */
export function clockSteps(start: string, end: string, step = 15): string[] {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  }
  const out: string[] = []
  for (let t = toMin(start); t <= toMin(end); t += step)
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`)
  return out
}

/** Relative "2 hours ago" style text for activity feeds. */
export function timeAgo(d: Date | string): string {
  const s = (Date.now() - toDate(d).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} hr ago`
  if (s < 86400 * 7) return `${Math.round(s / 86400)} days ago`
  return fmtDate(d)
}

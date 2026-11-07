// Shared bits for the Meal Train pages (guest and family).
import { query, supabase } from '@/lib/supabase'
import { fmtTime } from '@/lib/time'
import { Legend, type SlotState } from '@/lib/ui'

export interface MealSlotDef {
  key: string
  label: string
  start: string
  end: string
}

export interface MealSettings {
  slots: MealSlotDef[]
  dietary: string[]
  thanks: string
  blackoutMessage: string
}

const DEFAULT_BLACKOUT =
  'Booking is closed from midnight to 4 AM Mountain Time so the family can rest. Please come back after 4 AM. Thank you!'

/** Slot times, dietary needs, and the blackout message, from public settings. */
export async function loadMealSettings(): Promise<MealSettings> {
  const rows = await query(
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['meal_slots', 'dietary_needs', 'dietary_thanks', 'blackout']),
  )
  const v = Object.fromEntries(
    (rows ?? []).map(r => [r.key, r.value]),
  ) as Record<string, unknown>
  return {
    slots: (v.meal_slots as MealSlotDef[]) ?? [],
    dietary: (v.dietary_needs as string[]) ?? [],
    thanks: typeof v.dietary_thanks === 'string' ? v.dietary_thanks : '',
    blackoutMessage:
      (v.blackout as { message?: string } | undefined)?.message ??
      DEFAULT_BLACKOUT,
  }
}

/** "9 AM", "1 PM" → "9–11 AM" / "11 AM–1 PM" style window. */
export function timeWindow(start: Date | string, end: Date | string): string {
  const a = fmtTime(start)
  const b = fmtTime(end)
  const [aT, aP] = a.split(/\s+/)
  const [bT, bP] = b.split(/\s+/)
  return aP === bP ? `${aT}–${bT} ${bP}` : `${a}–${b}`
}

/** "13:00" → "1 PM"-style labels for a slot defined in settings. */
export function clockWindow(start: string, end: string): string {
  const fmt = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
  }
  const [aT, aP] = fmt(start).split(' ')
  const [bT, bP] = fmt(end).split(' ')
  return aP === bP ? `${aT}–${bT} ${bP}` : `${aT} ${aP}–${bT} ${bP}`
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/** The Meal Train's meanings for the site-wide colors. No blue: one person per slot. */
export const MEAL_STATES: SlotState[] = [
  'green',
  'yellow',
  'orange',
  'purple',
  'red',
]
export const MEAL_LABELS: Partial<Record<SlotState, string>> = {
  green: 'No one signed up',
  yellow: 'Signed up, but not yet confirmed with what they’ll bring',
  orange: 'Confirmed with what they’ll bring; waiting for approval',
  purple: 'Approved; locked, with the person’s name shown',
  red: 'Blocked by an Admin, paused, or a date that isn’t open',
}

export const MealLegend = () => (
  <Legend states={MEAL_STATES} labels={MEAL_LABELS} />
)

/** The family's dietary needs, word for word, with the thank-you line. */
export function DietaryNeeds({
  settings,
  heading = 'Dietary needs',
}: {
  settings: MealSettings
  heading?: string
}) {
  return (
    <div class="diet">
      {heading && <h2 class="h3">{heading}</h2>}
      <ul class="diet-list">
        {settings.dietary.map(d => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      {settings.thanks && <p class="diet-thanks">{settings.thanks}</p>}
    </div>
  )
}

export function DropOffNote() {
  return (
    <p class="dropoff-note">
      <strong>A drop-off, not a visit.</strong> Please leave food in the cooler
      out front, then knock or ring the bell. No need to wait for an answer. A
      Meal Train drop-off is not an invitation inside.
    </p>
  )
}

/** Sign-up status as a pill in the Meal Train's colors (approved is purple here, never blue). */
const MEAL_STATUS: Record<string, [string, string]> = {
  draft: ['Not confirmed yet', 'yellow'],
  submitted: ['Waiting for approval', 'orange'],
  approved: ['Approved', 'purple'],
  denied: ['Not approved', 'muted'],
  cancelled: ['Cancelled', 'muted'],
  expired: ['Released', 'muted'],
}

export function MealPill({ status }: { status: string }) {
  const [text, tone] = MEAL_STATUS[status] ?? [status, 'muted']
  return <span class={`pill pill-${tone}`}>{text}</span>
}

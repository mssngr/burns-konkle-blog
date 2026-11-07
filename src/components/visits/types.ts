// Shapes returned by the visit functions (see supabase/migrations/*_rules_and_visits.sql).

import { query, supabase } from '@/lib/supabase'
import type { SlotState } from '@/lib/ui'

export type HoursRule = 'within' | 'endpoints' | 'none'

export interface Question {
  key: string
  label: string
  kind: 'text' | 'textarea'
  required: boolean
}

export interface BookingType {
  id: number
  position: number
  name: string
  short_name: string
  description: string
  limit_group: string
  limit_text: string
  max_minutes: number | null
  length_text: string
  approval: 'approve' | 'acknowledge'
  hours_rule: HoursRule
  start_label: string
  end_label: string
  questions: Question[]
  active: boolean
}

export interface Attendee {
  name: string
  age?: string
  relationship?: string
}

export interface RuleItem {
  id: string
  title: string
  body: string
  kind: 'rule' | 'confirmation'
  agreed: boolean
  label: 'New' | 'Updated' | null
}

export interface PendingChange {
  id: string
  proposed_by: 'guest' | 'family'
  starts_at: string
  ends_at: string
  attendees: Attendee[] | null
  note: string | null
}

export type VisitStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'denied'
  | 'cancelled'
  | 'expired'

export interface VisitRequest {
  id: string
  token: string
  status: VisitStatus
  name: string
  type: BookingType
  starts_at: string
  ends_at: string
  attendees: Attendee[]
  answers: Record<string, string>
  decision_note: string | null
  cancel_note: string | null
  healthy_at: string | null
  rules_complete: boolean
  answers_complete: boolean
  rules_reagree_needed: boolean
  max_people: number
  rules: RuleItem[]
  pending_change: PendingChange | null
}

export interface CalendarSlot {
  t: string
  s: SlotState
  r: 'paused' | 'closed' | 'blocked' | 'week_full' | null
}

export interface VisitCalendar {
  type: number
  from: string
  to: string
  paused: boolean
  blackout: boolean
  weeks: Record<string, number>
  weekly_cap: number
  slots: CalendarSlot[]
}

export interface VisitSettings {
  hours: { start: string; end: string }
  cutoffHours: number
  blackoutMessage: string
  rulesUpdatedAt: string | null
}

const DEFAULT_BLACKOUT =
  'Booking is closed from midnight to 4 AM Mountain Time so the family can rest. Please come back after 4 AM. Thank you!'

/** The public settings the visit pages need. */
export async function loadVisitSettings(): Promise<VisitSettings> {
  const rows = await query<{ key: string; value: unknown }[]>(
    supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'visiting_hours',
        'cutoff_hours',
        'blackout',
        'rules_updated_at',
      ]),
  )
  const v = Object.fromEntries(rows.map(r => [r.key, r.value])) as {
    visiting_hours?: { start?: string; end?: string }
    cutoff_hours?: number
    blackout?: { message?: string }
    rules_updated_at?: unknown
  }
  return {
    hours: {
      start: v.visiting_hours?.start ?? '09:00',
      end: v.visiting_hours?.end ?? '19:00',
    },
    cutoffHours: Number(v.cutoff_hours ?? 3),
    blackoutMessage: v.blackout?.message ?? DEFAULT_BLACKOUT,
    rulesUpdatedAt:
      typeof v.rules_updated_at === 'string' ? v.rules_updated_at : null,
  }
}

export const loadBookingTypes = () =>
  query<BookingType[]>(
    supabase
      .from('booking_types')
      .select('*')
      .eq('active', true)
      .order('position'),
  )

export const isTrip = (t: Pick<BookingType, 'approval'>) =>
  t.approval === 'acknowledge'

export const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? ''

/** Heading for the attendee list, in the words each type asks for. */
export function peopleLabel(t: BookingType): string {
  if (t.id === 3) return 'Everyone traveling with you, including children'
  if (t.id === 4 || t.id === 5)
    return 'Every person who will be present, including children'
  return 'Everyone coming, including children'
}

export const RED_REASONS: Record<NonNullable<CalendarSlot['r']>, string> = {
  paused: 'Booking is paused',
  closed: 'Too soon or outside visiting hours',
  blocked: 'Blocked by the family',
  week_full: 'This week is full',
}

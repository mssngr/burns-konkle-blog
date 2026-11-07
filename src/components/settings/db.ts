// Writes for the Settings page. Admins edit config tables directly (RLS allows it; triggers log every change).
import { AppError, errorMessage, query, supabase } from '@/lib/supabase'

const NOT_SAVED =
  'That wasn’t saved. Only Gabriel or Micala can change settings.'

type Values = Record<string, unknown>

/** Update one row and return it. RLS hides refusals as "0 rows", so treat that as an error. */
export async function updateRow<T = Values>(
  table: string,
  match: Values,
  values: Values,
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .update(values)
    .match(match)
    .select()
  if (error) throw new AppError(errorMessage(error))
  if (!data?.length) throw new AppError(NOT_SAVED)
  return data[0] as T
}

export async function insertRow<T = Values>(
  table: string,
  values: Values,
): Promise<T> {
  const { data, error } = await supabase.from(table).insert(values).select()
  if (error) {
    if (/duplicate key/i.test(error.message))
      throw new AppError('That key is already used. Please pick another.')
    throw new AppError(errorMessage(error))
  }
  if (!data?.length) throw new AppError(NOT_SAVED)
  return data[0] as T
}

export type SettingsMap = Record<string, unknown>

export async function loadSettings(keys: string[]): Promise<SettingsMap> {
  const rows = await query<{ key: string; value: unknown }[]>(
    supabase.from('settings').select('key, value').in('key', keys),
  )
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

/** JSON with object keys sorted, so Postgres's jsonb key order doesn't count as a change. */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, (x as Record<string, unknown>)[k]]),
        )
      : x,
  )

export const same = (a: unknown, b: unknown) => canon(a) === canon(b)

/** Save the settings whose value changed. Returns how many were saved. */
export async function saveSettings(
  saved: SettingsMap,
  draft: SettingsMap,
): Promise<number> {
  const changed = Object.keys(draft).filter(k => !same(saved[k], draft[k]))
  for (const key of changed)
    await updateRow('settings', { key }, { value: draft[key] })
  return changed.length
}

/** "Watering the garden" → "watering_the_garden" */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)

export const KEY_RE = /^[a-z0-9_]+$/

export const isClock = (s: unknown) =>
  typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

/** "HH:MM" → minutes since midnight */
export const clockMin = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

/** Move item i by d (−1 up, +1 down) in a copy of the list. */
export function moved<T>(list: T[], i: number, d: number): T[] {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const out = list.slice()
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/** "2880" → "2 days"; "90" → "1 hr 30 min" */
export function fmtMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return ''
  if (min > 0 && min % 1440 === 0)
    return `${min / 1440} day${min === 1440 ? '' : 's'}`
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ') || '0 min'
}

/** Every [placeholder] in a text, in order, once each. */
export function placeholders(...texts: string[]): string[] {
  const out = new Set<string>()
  for (const t of texts)
    for (const m of t.matchAll(/\[[^\][\n]+\]/g)) out.add(m[0])
  return [...out]
}

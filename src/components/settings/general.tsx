import { useEffect, useState } from 'preact/hooks'
import { AppError } from '@/lib/supabase'
import { fmtClock } from '@/lib/time'
import {
  Check,
  ErrorText,
  Field,
  Input,
  Loading,
  TextArea,
  useAction,
  useAsync,
} from '@/lib/ui'
import {
  clockMin,
  isClock,
  loadSettings,
  type SettingsMap,
  same,
  saveSettings,
} from './db'
import { ClockInput, IntInput, Section } from './fields'

const KEYS = [
  'visiting_hours',
  'blackout',
  'cutoff_hours',
  'weekly_cap',
  'incomplete_reminder_hours',
  'incomplete_expiry_hours',
  'profile_skip_days',
  'meal_confirm_hours',
  'test_mode',
  'site_url',
  'photo_notice',
]

interface Hours {
  start: string
  end: string
}
interface Blackout extends Hours {
  message: string
}

const NUMBERS: [key: string, label: string, hint: string, min: number][] = [
  [
    'cutoff_hours',
    'Booking cutoff (hours ahead)',
    'Visit requests must start at least this many hours from now. Meal Train is exempt.',
    0,
  ],
  [
    'weekly_cap',
    'Weekly visitor cap',
    'Unique visitors per week, Sunday through Saturday.',
    1,
  ],
  [
    'incomplete_reminder_hours',
    'Unfinished request reminder (hours)',
    'Email a guest whose request isn’t finished after this many hours.',
    1,
  ],
  [
    'incomplete_expiry_hours',
    'Unfinished request expiry (hours)',
    'Release an unfinished request after this many hours, or at the cutoff.',
    1,
  ],
  [
    'profile_skip_days',
    'Profile skip (days)',
    'Guests with a profile and a visit approved this recently skip the rules and general questions.',
    0,
  ],
  [
    'meal_confirm_hours',
    'Meal Train confirm window (hours)',
    'Release a Meal Train sign-up that isn’t confirmed after this many hours, or when the slot starts.',
    1,
  ],
]

function validate(d: SettingsMap) {
  const vh = d.visiting_hours as Hours
  const bo = d.blackout as Blackout
  if (!isClock(vh.start) || !isClock(vh.end))
    throw new AppError('Please set both visiting hours.')
  if (clockMin(vh.start) >= clockMin(vh.end))
    throw new AppError('Visiting hours must end after they start.')
  if (!isClock(bo.start) || !isClock(bo.end))
    throw new AppError('Please set both blackout times.')
  if (clockMin(bo.start) >= clockMin(bo.end))
    throw new AppError(
      'The blackout must end after it starts, within the same day (for example 00:00 to 04:00).',
    )
  if (!bo.message.trim())
    throw new AppError('Please write the blackout message guests see.')
  for (const [key, label, , min] of NUMBERS) {
    const n = d[key]
    if (typeof n !== 'number' || !Number.isInteger(n) || n < min)
      throw new AppError(
        `${label}: please enter a whole number of at least ${min}.`,
      )
  }
  if (
    (d.incomplete_reminder_hours as number) >=
    (d.incomplete_expiry_hours as number)
  )
    throw new AppError(
      'The unfinished-request reminder should come before the expiry.',
    )
  if (!/^https?:\/\/[^\s/]+/.test(String(d.site_url)))
    throw new AppError('The site URL must start with https://')
  if (!String(d.photo_notice).trim())
    throw new AppError('Please write the photo notice.')
}

export function GeneralSettings({
  onDirty,
}: {
  onDirty: (d: boolean) => void
}) {
  const {
    data: saved,
    error,
    loading,
    setData,
  } = useAsync(() => loadSettings(KEYS))
  const [draft, setDraft] = useState<SettingsMap | null>(null)
  const save = useAction()

  useEffect(() => {
    if (saved) setDraft(saved)
  }, [saved])

  const dirty = !!saved && !!draft && !same(saved, draft)
  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  if (loading && !saved) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!saved || !draft) return null

  const set = (key: string, value: unknown) =>
    setDraft({ ...draft, [key]: value })
  const vh = draft.visiting_hours as Hours
  const bo = draft.blackout as Blackout

  const onSave = () =>
    save.run(async () => {
      const clean = {
        ...draft,
        site_url: String(draft.site_url).trim().replace(/\/+$/, ''),
        photo_notice: String(draft.photo_notice).trim(),
        blackout: { ...bo, message: bo.message.trim() },
      }
      validate(clean)
      await saveSettings(saved, clean)
      setData(clean)
    }, 'Saved')

  return (
    <Section
      title="General"
      lede="Hours, limits, timing, and site-wide text. Every change is recorded in the activity log."
      onSave={onSave}
      busy={save.busy}
      error={save.error}
      dirty={dirty}
    >
      <fieldset class="set-fieldset">
        <legend>Visiting hours</legend>
        <p class="small muted">
          House visits start and end inside these hours. Stays and outings
          arrive, depart, pick up, and drop off inside them. Mountain Time.
        </p>
        <div class="set-grid">
          <Field
            label="Start"
            hint={isClock(vh.start) ? fmtClock(vh.start) : undefined}
          >
            <ClockInput
              value={vh.start}
              onChange={v => set('visiting_hours', { ...vh, start: v })}
            />
          </Field>
          <Field
            label="End"
            hint={isClock(vh.end) ? fmtClock(vh.end) : undefined}
          >
            <ClockInput
              value={vh.end}
              onChange={v => set('visiting_hours', { ...vh, end: v })}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset class="set-fieldset">
        <legend>Overnight blackout</legend>
        <p class="small muted">
          No new requests, sign-ups, or changes between these times. Mountain
          Time.
        </p>
        <div class="set-grid">
          <Field
            label="From"
            hint={isClock(bo.start) ? fmtClock(bo.start) : undefined}
          >
            <ClockInput
              value={bo.start}
              onChange={v => set('blackout', { ...bo, start: v })}
            />
          </Field>
          <Field
            label="Until"
            hint={isClock(bo.end) ? fmtClock(bo.end) : undefined}
          >
            <ClockInput
              value={bo.end}
              onChange={v => set('blackout', { ...bo, end: v })}
            />
          </Field>
        </div>
        <Field label="Message guests see during the blackout">
          <TextArea
            value={bo.message}
            onInput={(e: Event) =>
              set('blackout', {
                ...bo,
                message: (e.currentTarget as HTMLTextAreaElement).value,
              })
            }
          />
        </Field>
      </fieldset>

      <fieldset class="set-fieldset">
        <legend>Limits and timing</legend>
        <div class="set-grid">
          {NUMBERS.map(([key, label, hint, min]) => (
            <Field key={key} label={label} hint={hint}>
              <IntInput
                value={draft[key] as number | null}
                min={min}
                onChange={v => set(key, v)}
              />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset class="set-fieldset">
        <legend>Site</legend>
        <Check
          checked={draft.test_mode === true}
          onChange={v => set('test_mode', v)}
        >
          Show the test-mode banner on every page
        </Check>
        <Field
          label="Site URL used in emails"
          hint="Every link in an email starts with this. No slash at the end."
        >
          <Input
            type="url"
            inputMode="url"
            value={String(draft.site_url ?? '')}
            onInput={(e: Event) =>
              set('site_url', (e.currentTarget as HTMLInputElement).value)
            }
          />
        </Field>
        <Field
          label="Photo notice"
          hint="Shown at the top of every calendar page."
        >
          <TextArea
            rows={4}
            value={String(draft.photo_notice ?? '')}
            onInput={(e: Event) =>
              set(
                'photo_notice',
                (e.currentTarget as HTMLTextAreaElement).value,
              )
            }
          />
        </Field>
      </fieldset>
    </Section>
  )
}

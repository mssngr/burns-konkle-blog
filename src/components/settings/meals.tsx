import { useEffect, useState } from 'preact/hooks'
import { AppError, query, supabase } from '@/lib/supabase'
import { fmtClock } from '@/lib/time'
import {
  Button,
  ErrorText,
  Field,
  Input,
  Loading,
  Select,
  TextArea,
  useAction,
  useAsync,
} from '@/lib/ui'
import {
  clockMin,
  fmtMinutes,
  isClock,
  KEY_RE,
  loadSettings,
  same,
  saveSettings,
  slug,
} from './db'
import { ClockInput, IntInput, RowTools, Section } from './fields'

interface Slot {
  key: string
  label: string
  start: string
  end: string
}
interface Reminder {
  minutes: number | null
  template: string
}
interface Template {
  key: string
  description: string
}

interface Draft {
  meal_slots: Slot[]
  dietary_needs: string
  dietary_thanks: string
  dietary_summary: string
  visit_reminders: Reminder[]
  meal_reminders: Reminder[]
}

const KEYS = [
  'meal_slots',
  'dietary_needs',
  'dietary_thanks',
  'dietary_summary',
  'visit_reminders',
  'meal_reminders',
]

async function load() {
  const [s, templates] = await Promise.all([
    loadSettings(KEYS),
    query<Template[]>(
      supabase
        .from('message_templates')
        .select('key, description')
        .eq('audience', 'guest')
        .order('position'),
    ),
  ])
  const draft: Draft = {
    meal_slots: s.meal_slots as Slot[],
    dietary_needs: (s.dietary_needs as string[]).join('\n'),
    dietary_thanks: String(s.dietary_thanks ?? ''),
    dietary_summary: String(s.dietary_summary ?? ''),
    visit_reminders: s.visit_reminders as Reminder[],
    meal_reminders: s.meal_reminders as Reminder[],
  }
  return { saved: s, draft, templates }
}

const toSettings = (d: Draft) => ({
  meal_slots: d.meal_slots.map(s => ({
    key: s.key.trim(),
    label: s.label.trim(),
    start: s.start,
    end: s.end,
  })),
  dietary_needs: d.dietary_needs
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean),
  dietary_thanks: d.dietary_thanks.trim(),
  dietary_summary: d.dietary_summary.trim(),
  visit_reminders: d.visit_reminders,
  meal_reminders: d.meal_reminders,
})

function validate(s: ReturnType<typeof toSettings>) {
  if (!s.meal_slots.length)
    throw new AppError('Please keep at least one Meal Train slot.')
  const keys = new Set<string>()
  for (const slot of s.meal_slots) {
    if (!slot.label) throw new AppError('Every Meal Train slot needs a label.')
    if (!KEY_RE.test(slot.key))
      throw new AppError(
        `${slot.label}: the key uses only lowercase letters, numbers, and underscores.`,
      )
    if (keys.has(slot.key))
      throw new AppError(`Two slots share the key “${slot.key}”.`)
    keys.add(slot.key)
    if (!isClock(slot.start) || !isClock(slot.end))
      throw new AppError(`${slot.label}: please set both times.`)
    if (clockMin(slot.start) >= clockMin(slot.end))
      throw new AppError(`${slot.label}: the slot must end after it starts.`)
  }
  if (!s.dietary_needs.length)
    throw new AppError('Please list at least one dietary need.')
  if (!s.dietary_summary)
    throw new AppError('Please write the short dietary summary used in emails.')
  for (const [list, what] of [
    [s.visit_reminders, 'Visit'],
    [s.meal_reminders, 'Meal Train'],
  ] as const) {
    const seen = new Set<string>()
    for (const r of list) {
      if (r.minutes == null || !Number.isInteger(r.minutes) || r.minutes < 1)
        throw new AppError(
          `${what} reminders: minutes before must be a whole number, at least 1.`,
        )
      if (!r.template)
        throw new AppError(
          `${what} reminders: pick a message for each reminder.`,
        )
      if (seen.has(r.template))
        throw new AppError(
          `${what} reminders: each reminder needs a different message.`,
        )
      seen.add(r.template)
    }
  }
}

function Reminders({
  list,
  onChange,
  templates,
  what,
  lookahead,
}: {
  list: Reminder[]
  onChange: (l: Reminder[]) => void
  templates: Template[]
  what: string
  lookahead: string
}) {
  const set = (i: number, r: Partial<Reminder>) =>
    onChange(list.map((x, j) => (j === i ? { ...x, ...r } : x)))
  return (
    <fieldset class="set-fieldset">
      <legend>{what} reminders</legend>
      <p class="small muted">
        Sent before each approved{' '}
        {what === 'Visit'
          ? 'visit, stay arrival, or outing pickup'
          : 'drop-off'}
        . If a booking comes in late, only the closest reminder goes out.
        Reminders are checked from {lookahead} ahead.
      </p>
      {list.map((r, i) => (
        <div key={i} class="set-q">
          <div class="set-grid set-grid-narrow">
            <Field label="Minutes before" hint={fmtMinutes(r.minutes)}>
              <IntInput
                value={r.minutes}
                min={1}
                onChange={v => set(i, { minutes: v })}
              />
            </Field>
            <Field label="Message">
              <Select
                value={r.template}
                onChange={(e: Event) =>
                  set(i, {
                    template: (e.currentTarget as HTMLSelectElement).value,
                  })
                }
              >
                <option value="">Pick a message</option>
                {templates.map(t => (
                  <option key={t.key} value={t.key}>
                    {t.description} ({t.key})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <RowTools
            index={i}
            count={list.length}
            what="reminder"
            onMove={d =>
              onChange(
                list.map((x, j) =>
                  j === i ? list[i + d] : j === i + d ? list[i] : x,
                ),
              )
            }
            onRemove={() => onChange(list.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <div class="actions">
        <Button
          size="sm"
          onClick={() => onChange([...list, { minutes: 60, template: '' }])}
        >
          Add a reminder
        </Button>
      </div>
    </fieldset>
  )
}

export function MealSettings({ onDirty }: { onDirty: (d: boolean) => void }) {
  const { data, error, loading, setData } = useAsync(load)
  const [draft, setDraft] = useState<Draft | null>(null)
  const save = useAction()

  useEffect(() => {
    if (data) setDraft(data.draft)
  }, [data])
  const dirty = !!data && !!draft && !same(data.draft, draft)
  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  if (loading && !data) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!data || !draft) return null

  const savedKeys = new Set((data.saved.meal_slots as Slot[]).map(s => s.key))
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft({ ...draft, [k]: v })
  const setSlot = (i: number, s: Partial<Slot>) =>
    set(
      'meal_slots',
      draft.meal_slots.map((x, j) => (j === i ? { ...x, ...s } : x)),
    )

  const onSave = () =>
    save.run(async () => {
      const next = toSettings(draft)
      validate(next)
      await saveSettings(data.saved, next)
      const fresh = { ...next, dietary_needs: next.dietary_needs.join('\n') }
      setData({ ...data, saved: { ...data.saved, ...next }, draft: fresh })
    }, 'Saved')

  return (
    <Section
      title="Meal Train"
      lede="Drop-off slots, dietary needs, and reminder timing for meals and visits."
      onSave={onSave}
      busy={save.busy}
      error={save.error}
      dirty={dirty}
    >
      <fieldset class="set-fieldset">
        <legend>Slots</legend>
        <p class="small muted">
          The same slots are offered on every Meal Train date. Removing a slot
          doesn’t cancel sign-ups already in it, so cancel those first.
        </p>
        {draft.meal_slots.map((s, i) => {
          const fixed = savedKeys.has(s.key)
          return (
            <div key={i} class="set-q">
              <div class="set-grid set-grid-4">
                <Field label="Label">
                  <Input
                    value={s.label}
                    onInput={(e: Event) => {
                      const label = (e.currentTarget as HTMLInputElement).value
                      setSlot(
                        i,
                        fixed ? { label } : { label, key: slug(label) },
                      )
                    }}
                  />
                </Field>
                <Field
                  label="Key"
                  hint={fixed ? 'Fixed once saved' : undefined}
                >
                  <Input
                    value={s.key}
                    readOnly={fixed}
                    onInput={(e: Event) =>
                      setSlot(i, {
                        key: (e.currentTarget as HTMLInputElement).value,
                      })
                    }
                  />
                </Field>
                <Field
                  label="Start"
                  hint={isClock(s.start) ? fmtClock(s.start) : undefined}
                >
                  <ClockInput
                    value={s.start}
                    onChange={v => setSlot(i, { start: v })}
                  />
                </Field>
                <Field
                  label="End"
                  hint={isClock(s.end) ? fmtClock(s.end) : undefined}
                >
                  <ClockInput
                    value={s.end}
                    onChange={v => setSlot(i, { end: v })}
                  />
                </Field>
              </div>
              <RowTools
                index={i}
                count={draft.meal_slots.length}
                what={s.label || 'slot'}
                onMove={d => {
                  const l = draft.meal_slots.slice()
                  ;[l[i], l[i + d]] = [l[i + d], l[i]]
                  set('meal_slots', l)
                }}
                onRemove={() =>
                  set(
                    'meal_slots',
                    draft.meal_slots.filter((_, j) => j !== i),
                  )
                }
              />
            </div>
          )
        })}
        <div class="actions">
          <Button
            size="sm"
            onClick={() =>
              set('meal_slots', [
                ...draft.meal_slots,
                { key: '', label: '', start: '12:00', end: '13:00' },
              ])
            }
          >
            Add a slot
          </Button>
        </div>
      </fieldset>

      <fieldset class="set-fieldset">
        <legend>Dietary needs</legend>
        <Field
          label="Dietary needs"
          hint="One per line. Shown word for word on the Meal Train."
        >
          <TextArea
            rows={6}
            value={draft.dietary_needs}
            onInput={(e: Event) =>
              set(
                'dietary_needs',
                (e.currentTarget as HTMLTextAreaElement).value,
              )
            }
          />
        </Field>
        <Field label="Thank-you line" hint="Shown under the dietary needs.">
          <Input
            value={draft.dietary_thanks}
            onInput={(e: Event) =>
              set('dietary_thanks', (e.currentTarget as HTMLInputElement).value)
            }
          />
        </Field>
        <Field
          label="Short summary for emails"
          hint="Fills [dietary needs] in the Meal Train sign-up email."
        >
          <TextArea
            rows={3}
            value={draft.dietary_summary}
            onInput={(e: Event) =>
              set(
                'dietary_summary',
                (e.currentTarget as HTMLTextAreaElement).value,
              )
            }
          />
        </Field>
      </fieldset>

      <Reminders
        what="Visit"
        lookahead="3 days"
        list={draft.visit_reminders}
        templates={data.templates}
        onChange={l => set('visit_reminders', l)}
      />
      <Reminders
        what="Meal Train"
        lookahead="2 days"
        list={draft.meal_reminders}
        templates={data.templates}
        onChange={l => set('meal_reminders', l)}
      />
    </Section>
  )
}

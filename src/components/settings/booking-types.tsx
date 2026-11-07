import { useEffect, useState } from 'preact/hooks'
import { AppError, query, supabase } from '@/lib/supabase'
import {
  Button,
  Check,
  ErrorText,
  Field,
  Input,
  Loading,
  Notice,
  Select,
  TextArea,
  useAction,
  useAsync,
} from '@/lib/ui'
import { fmtMinutes, KEY_RE, moved, same, slug, updateRow } from './db'
import { IntInput, RowTools, Section } from './fields'

interface Question {
  key: string
  label: string
  kind: 'text' | 'textarea'
  required: boolean
}

interface BookingType {
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
  hours_rule: 'within' | 'endpoints' | 'none'
  questions: Question[]
  active: boolean
}

interface Group {
  key: string
  label: string
  max_people: number
  type_ids: number[]
  position: number
}

const EDITABLE = [
  'name',
  'short_name',
  'description',
  'limit_text',
  'max_minutes',
  'length_text',
  'active',
  'questions',
] as const
const pick = (t: BookingType) =>
  Object.fromEntries(EDITABLE.map(k => [k, t[k]]))

const HOURS: Record<BookingType['hours_rule'], string> = {
  within: 'Starts and ends inside visiting hours, same day',
  endpoints: 'Arrives and leaves inside visiting hours; may run overnight',
  none: 'Any time',
}

function validate(t: BookingType) {
  for (const [k, label] of [
    ['name', 'Name'],
    ['short_name', 'Short name'],
    ['description', 'Description'],
    ['limit_text', 'Limit text'],
    ['length_text', 'Length text'],
  ] as const) {
    if (!String(t[k]).trim())
      throw new AppError(`${t.name || 'This type'}: ${label} can’t be blank.`)
  }
  if (
    t.max_minutes != null &&
    (!Number.isInteger(t.max_minutes) || t.max_minutes < 15)
  )
    throw new AppError(
      `${t.name}: the max length must be at least 15 minutes, or blank for no cap.`,
    )
  const keys = new Set<string>()
  for (const q of t.questions) {
    if (!q.label.trim())
      throw new AppError(`${t.name}: every question needs a label.`)
    if (!KEY_RE.test(q.key))
      throw new AppError(
        `${t.name}: question keys use only lowercase letters, numbers, and underscores.`,
      )
    if (keys.has(q.key))
      throw new AppError(`${t.name}: two questions share the key “${q.key}”.`)
    keys.add(q.key)
  }
}

function TypeCard({
  saved,
  onSaved,
}: {
  saved: BookingType
  onSaved: (t: BookingType) => void
}) {
  const [t, setT] = useState(saved)
  const save = useAction()
  useEffect(() => setT(saved), [saved])
  const dirty = !same(pick(t), pick(saved))
  const set = <K extends keyof BookingType>(k: K, v: BookingType[K]) =>
    setT({ ...t, [k]: v })
  const setQ = (i: number, q: Partial<Question>) =>
    set(
      'questions',
      t.questions.map((x, j) => (j === i ? { ...x, ...q } : x)),
    )
  const text = (k: 'name' | 'short_name' | 'limit_text' | 'length_text') => ({
    value: t[k],
    onInput: (e: Event) => set(k, (e.currentTarget as HTMLInputElement).value),
  })

  const onSave = () =>
    save.run(async () => {
      const clean: BookingType = {
        ...t,
        name: t.name.trim(),
        short_name: t.short_name.trim(),
        description: t.description.trim(),
        limit_text: t.limit_text.trim(),
        length_text: t.length_text.trim(),
        questions: t.questions.map(q => ({
          ...q,
          label: q.label.trim(),
          key: q.key.trim(),
        })),
      }
      validate(clean)
      onSaved(
        await updateRow<BookingType>(
          'booking_types',
          { id: t.id },
          pick(clean),
        ),
      )
    }, 'Saved')

  return (
    <article class="set-item stack" aria-label={saved.name}>
      <div class="spread">
        <h3 class="set-item-title">
          <span class="muted">{saved.id}.</span> {saved.name}
        </h3>
        {!t.active && <span class="pill pill-muted">Hidden from guests</span>}
      </div>
      <p class="meta">
        {saved.approval === 'approve'
          ? 'Needs approval'
          : 'Acknowledged, not approved'}{' '}
        · {HOURS[saved.hours_rule]}
      </p>
      <div class="set-grid">
        <Field label="Name">
          <Input {...text('name')} />
        </Field>
        <Field
          label="Short name"
          hint="Used inside emails: “Your request for [type] on …”"
        >
          <Input {...text('short_name')} />
        </Field>
      </div>
      <Field label="Description">
        <TextArea
          rows={2}
          value={t.description}
          onInput={(e: Event) =>
            set('description', (e.currentTarget as HTMLTextAreaElement).value)
          }
        />
      </Field>
      <div class="set-grid">
        <Field
          label="Limit text"
          hint="How the people limit is described to guests."
        >
          <Input {...text('limit_text')} />
        </Field>
        <Field
          label="Length text"
          hint="How the length limit is described to guests."
        >
          <Input {...text('length_text')} />
        </Field>
        <Field
          label="Max length (minutes)"
          hint={
            t.max_minutes
              ? `${fmtMinutes(t.max_minutes)} per request`
              : 'Blank means no cap'
          }
        >
          <IntInput
            value={t.max_minutes}
            min={15}
            placeholder="No cap"
            onChange={v => set('max_minutes', v)}
          />
        </Field>
      </div>
      <Check checked={t.active} onChange={v => set('active', v)}>
        Guests can request this type
      </Check>

      <fieldset class="set-fieldset">
        <legend>Extra questions</legend>
        <p class="small muted">
          Asked after the general questions. Answers are saved under the key, so
          changing a key hides earlier answers.
        </p>
        {t.questions.length === 0 && (
          <p class="small muted">No extra questions.</p>
        )}
        {t.questions.map((q, i) => (
          <div key={i} class="set-q">
            <div class="set-grid">
              <Field label="Question">
                <Input
                  value={q.label}
                  onInput={(e: Event) => {
                    const label = (e.currentTarget as HTMLInputElement).value
                    const wasAuto = !q.key || q.key === slug(q.label)
                    setQ(
                      i,
                      wasAuto && !saved.questions.some(s => s.key === q.key)
                        ? { label, key: slug(label) }
                        : { label },
                    )
                  }}
                />
              </Field>
              <Field label="Key">
                <Input
                  value={q.key}
                  onInput={(e: Event) =>
                    setQ(i, {
                      key: (e.currentTarget as HTMLInputElement).value,
                    })
                  }
                />
              </Field>
              <Field label="Answer box">
                <Select
                  value={q.kind}
                  onChange={(e: Event) =>
                    setQ(i, {
                      kind: (e.currentTarget as HTMLSelectElement)
                        .value as Question['kind'],
                    })
                  }
                >
                  <option value="text">One line</option>
                  <option value="textarea">Several lines</option>
                </Select>
              </Field>
            </div>
            <div class="spread">
              <Check
                checked={q.required}
                onChange={v => setQ(i, { required: v })}
              >
                Required
              </Check>
              <RowTools
                index={i}
                count={t.questions.length}
                what={q.label || 'question'}
                onMove={d => set('questions', moved(t.questions, i, d))}
                onRemove={() =>
                  set(
                    'questions',
                    t.questions.filter((_, j) => j !== i),
                  )
                }
              />
            </div>
          </div>
        ))}
        <div class="actions">
          <Button
            size="sm"
            onClick={() =>
              set('questions', [
                ...t.questions,
                { key: '', label: '', kind: 'text', required: false },
              ])
            }
          >
            Add a question
          </Button>
        </div>
      </fieldset>

      <ErrorText error={save.error} />
      <div class="actions">
        <Button
          variant="primary"
          busy={save.busy}
          disabled={!dirty}
          onClick={onSave}
          aria-label={`Save ${saved.name}`}
        >
          Save this type
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setT(saved)}>
            Undo changes
          </Button>
        )}
      </div>
    </article>
  )
}

function Groups({
  saved,
  types,
  onSaved,
}: {
  saved: Group[]
  types: BookingType[]
  onSaved: (g: Group[]) => void
}) {
  const [groups, setGroups] = useState(saved)
  const save = useAction()
  useEffect(() => setGroups(saved), [saved])
  const dirty = !same(groups, saved)
  const set = (i: number, g: Partial<Group>) =>
    setGroups(groups.map((x, j) => (j === i ? { ...x, ...g } : x)))
  const typeName = (id: number) =>
    types.find(t => t.id === id)?.name ?? `Type ${id}`

  const onSave = () =>
    save.run(async () => {
      for (const g of groups) {
        if (!g.label.trim()) throw new AppError('Every limit needs a label.')
        if (!Number.isInteger(g.max_people) || g.max_people < 1)
          throw new AppError(`${g.label}: the max must be at least 1 person.`)
      }
      const out: Group[] = []
      for (const [i, g] of groups.entries()) {
        out.push(
          same(g, saved[i])
            ? g
            : await updateRow<Group>(
                'capacity_groups',
                { key: g.key },
                { label: g.label.trim(), max_people: g.max_people },
              ),
        )
      }
      onSaved(out)
    }, 'Saved')

  return (
    <article class="set-item stack" aria-label="People limits">
      <h3 class="set-item-title">People limits</h3>
      <Notice>
        Limits count guests only, including kids. The family at home is never
        counted. Each limit covers the booking types listed under it.
      </Notice>
      {groups.map((g, i) => (
        <div key={g.key} class="set-q">
          <div class="set-grid set-grid-wide">
            <Field
              label="Label"
              hint={`Covers: ${g.type_ids.map(typeName).join(', ')}`}
            >
              <Input
                value={g.label}
                onInput={(e: Event) =>
                  set(i, { label: (e.currentTarget as HTMLInputElement).value })
                }
              />
            </Field>
            <Field label="Max people">
              <IntInput
                value={g.max_people}
                min={1}
                onChange={v => set(i, { max_people: v ?? 0 })}
              />
            </Field>
          </div>
        </div>
      ))}
      <ErrorText error={save.error} />
      <div class="actions">
        <Button
          variant="primary"
          busy={save.busy}
          disabled={!dirty}
          onClick={onSave}
        >
          Save limits
        </Button>
      </div>
    </article>
  )
}

async function load() {
  const [types, groups] = await Promise.all([
    query<BookingType[]>(
      supabase.from('booking_types').select('*').order('position'),
    ),
    query<Group[]>(
      supabase.from('capacity_groups').select('*').order('position'),
    ),
  ])
  return { types, groups }
}

export function BookingTypeSettings() {
  const { data, error, loading, setData } = useAsync(load)
  if (loading && !data) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!data) return null
  return (
    <Section
      title="Booking types and limits"
      lede="What guests can request, how long, and how many people. Each type and the limits save on their own."
    >
      {data.types.map(t => (
        <TypeCard
          key={t.id}
          saved={t}
          onSaved={n =>
            setData({
              ...data,
              types: data.types.map(x => (x.id === n.id ? n : x)),
            })
          }
        />
      ))}
      <Groups
        saved={data.groups}
        types={data.types}
        onSaved={groups => setData({ ...data, groups })}
      />
    </Section>
  )
}

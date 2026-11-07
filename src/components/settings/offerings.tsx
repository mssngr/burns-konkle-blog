import { useEffect, useState } from 'preact/hooks'
import { AppError, query, supabase } from '@/lib/supabase'
import {
  Button,
  Check,
  ErrorText,
  Field,
  Input,
  Loading,
  Select,
  useAction,
  useAsync,
} from '@/lib/ui'
import { insertRow, KEY_RE, moved, same, slug, updateRow } from './db'
import { RowTools, Section } from './fields'

interface Option {
  key: string
  label: string
  destination: string
  active: boolean
  position: number
}

async function load() {
  const [options, types] = await Promise.all([
    query<Option[]>(
      supabase.from('offer_options').select('*').order('position'),
    ),
    query<{ id: number; name: string }[]>(
      supabase.from('booking_types').select('id, name').order('position'),
    ),
  ])
  return { options, types }
}

function Destination({
  value,
  onChange,
  types,
}: {
  value: string
  onChange: (v: string) => void
  types: { id: number; name: string }[]
}) {
  return (
    <Select
      value={value}
      onChange={(e: Event) =>
        onChange((e.currentTarget as HTMLSelectElement).value)
      }
    >
      <option value="meal">Meal Train</option>
      {types.map(t => (
        <option key={t.id} value={`visit:${t.id}`}>
          Visit calendar: {t.name}
        </option>
      ))}
      <option value="review">The family reviews it</option>
    </Select>
  )
}

export function OfferingSettings({
  onDirty,
}: {
  onDirty: (d: boolean) => void
}) {
  const { data, error, loading, setData } = useAsync(load)
  const [list, setList] = useState<Option[] | null>(null)
  const [add, setAdd] = useState({
    label: '',
    key: '',
    destination: 'review',
    auto: true,
  })
  const save = useAction()
  const adding = useAction()

  useEffect(() => {
    if (data) setList(data.options)
  }, [data])
  const dirty = !!data && !!list && !same(data.options, list)
  useEffect(() => {
    onDirty(dirty || !!add.label.trim())
  }, [dirty, add.label, onDirty])

  if (loading && !data) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!data || !list) return null

  const set = (i: number, o: Partial<Option>) =>
    setList(list.map((x, j) => (j === i ? { ...x, ...o } : x)))

  const onSave = () =>
    save.run(async () => {
      if (list.some(o => !o.label.trim()))
        throw new AppError('Every option needs a label.')
      const out: Option[] = []
      for (const [i, o] of list.entries()) {
        const next = {
          label: o.label.trim(),
          destination: o.destination,
          active: o.active,
          position: i + 1,
        }
        const before = data.options.find(x => x.key === o.key)
        out.push(
          before &&
            same({ ...before, key: undefined }, { ...next, key: undefined })
            ? before
            : await updateRow<Option>('offer_options', { key: o.key }, next),
        )
      }
      setData({ ...data, options: out })
    }, 'Saved')

  const onAdd = () =>
    adding.run(async () => {
      const label = add.label.trim()
      const key = add.key.trim()
      if (!label) throw new AppError('Please write the label guests will see.')
      if (!KEY_RE.test(key))
        throw new AppError(
          'The key uses only lowercase letters, numbers, and underscores.',
        )
      if (data.options.some(o => o.key === key))
        throw new AppError('That key is already used. Please pick another.')
      const row = await insertRow<Option>('offer_options', {
        key,
        label,
        destination: add.destination,
        active: true,
        position: Math.max(0, ...data.options.map(o => o.position)) + 1,
      })
      setData({ ...data, options: [...data.options, row] })
      setList([...list, row])
      setAdd({ label: '', key: '', destination: 'review', auto: true })
    }, 'Added')

  return (
    <Section
      title="Offerings form"
      lede="The checklist on the Offer help form, and where each choice sends the guest next."
      onSave={onSave}
      busy={save.busy}
      error={save.error}
      dirty={dirty}
    >
      <ol class="set-list">
        {list.map((o, i) => (
          <li key={o.key} class="set-item stack">
            <div class="set-grid set-grid-wide">
              <Field label="Label" hint={`Key: ${o.key}`}>
                <Input
                  value={o.label}
                  onInput={(e: Event) =>
                    set(i, {
                      label: (e.currentTarget as HTMLInputElement).value,
                    })
                  }
                />
              </Field>
              <Field label="Sends the guest to">
                <Destination
                  value={o.destination}
                  types={data.types}
                  onChange={v => set(i, { destination: v })}
                />
              </Field>
            </div>
            <div class="spread">
              <Check checked={o.active} onChange={v => set(i, { active: v })}>
                Show on the form
              </Check>
              <RowTools
                index={i}
                count={list.length}
                what={o.label}
                onMove={d => setList(moved(list, i, d))}
              />
            </div>
          </li>
        ))}
      </ol>

      <fieldset class="set-fieldset">
        <legend>Add an option</legend>
        <div class="set-grid">
          <Field label="Label">
            <Input
              value={add.label}
              onInput={(e: Event) => {
                const label = (e.currentTarget as HTMLInputElement).value
                setAdd({ ...add, label, key: add.auto ? slug(label) : add.key })
              }}
            />
          </Field>
          <Field label="Key" hint="Fixed once added.">
            <Input
              value={add.key}
              onInput={(e: Event) =>
                setAdd({
                  ...add,
                  key: (e.currentTarget as HTMLInputElement).value,
                  auto: false,
                })
              }
            />
          </Field>
          <Field label="Sends the guest to">
            <Destination
              value={add.destination}
              types={data.types}
              onChange={v => setAdd({ ...add, destination: v })}
            />
          </Field>
        </div>
        <ErrorText error={adding.error} />
        <div class="actions">
          <Button busy={adding.busy} onClick={onAdd}>
            Add option
          </Button>
        </div>
      </fieldset>
    </Section>
  )
}

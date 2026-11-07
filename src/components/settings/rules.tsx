import { useEffect, useState } from 'preact/hooks'
import { AppError, query, supabase } from '@/lib/supabase'
import { fmtDate, fmtLongDate } from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Field,
  Input,
  Loading,
  Modal,
  Notice,
  TextArea,
  useAction,
  useAsync,
} from '@/lib/ui'
import { insertRow, moved, updateRow } from './db'
import { RowTools, Section } from './fields'

interface Rule {
  id: string
  position: number
  title: string
  body: string
  kind: 'rule' | 'confirmation'
  active: boolean
  revision: number
  updated_at: string
}

async function load() {
  const [rules, updated, upcoming] = await Promise.all([
    query<Rule[]>(
      supabase.from('rules').select('*').order('position').order('created_at'),
    ),
    query<{ value: string } | null>(
      supabase
        .from('settings')
        .select('value')
        .eq('key', 'rules_updated_at')
        .maybeSingle(),
    ),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .gt('starts_at', new Date().toISOString()),
  ])
  return {
    rules,
    updatedAt: updated?.value ?? null,
    upcoming: upcoming.count ?? 0,
  }
}

/** Put the active rules in this order (positions 1…n), writing only rows that moved. */
async function renumber(order: Rule[]) {
  for (const [i, r] of order.entries()) {
    if (r.position !== i + 1)
      await updateRow('rules', { id: r.id }, { position: i + 1 })
  }
}

/** Where a new or restored rule goes: just before the final confirmation. */
function withInserted(active: Rule[], rule: Rule) {
  const at = active.findIndex(r => r.kind === 'confirmation')
  const out = active.filter(r => r.id !== rule.id)
  out.splice(at < 0 ? out.length : at, 0, rule)
  return out
}

type Pending =
  | { kind: 'edit'; rule: Rule; title: string; body: string }
  | { kind: 'add'; title: string; body: string }
  | { kind: 'remove'; rule: Rule }
  | { kind: 'restore'; rule: Rule }

export function RulesSettings({ onDirty }: { onDirty: (d: boolean) => void }) {
  const { data, error, loading, reload } = useAsync(load)
  const [editing, setEditing] = useState<
    Record<string, { title: string; body: string }>
  >({})
  const [adding, setAdding] = useState({ title: '', body: '' })
  const [pending, setPending] = useState<Pending | null>(null)
  const act = useAction()
  const move = useAction()

  const dirty =
    Object.keys(editing).length > 0 ||
    !!adding.title.trim() ||
    !!adding.body.trim()
  useEffect(() => {
    onDirty(dirty)
  }, [dirty, onDirty])

  if (loading && !data) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!data) return null

  const active = data.rules.filter(r => r.active)
  const removed = data.rules.filter(r => !r.active)

  const onMove = (i: number, d: number) =>
    move.run(async () => {
      await renumber(moved(active, i, d))
      await reload()
    })

  const confirm = () =>
    act.run(async () => {
      const p = pending
      if (!p) return
      if (p.kind === 'edit') {
        await updateRow(
          'rules',
          { id: p.rule.id },
          { title: p.title.trim(), body: p.body.trim() },
        )
        const { [p.rule.id]: _, ...rest } = editing
        setEditing(rest)
      } else if (p.kind === 'add') {
        const rule = await insertRow<Rule>('rules', {
          title: p.title.trim(),
          body: p.body.trim(),
          kind: 'rule',
          position: active.length + 1,
        })
        await renumber(withInserted(active, rule))
        setAdding({ title: '', body: '' })
      } else if (p.kind === 'remove') {
        await updateRow('rules', { id: p.rule.id }, { active: false })
        await renumber(active.filter(r => r.id !== p.rule.id))
      } else {
        const rule = await updateRow<Rule>(
          'rules',
          { id: p.rule.id },
          { active: true },
        )
        await renumber(withInserted(active, rule))
      }
      setPending(null)
      await reload()
    }, 'Saved')

  const askSave = (rule: Rule) => {
    const e = editing[rule.id]
    if (!e.title.trim() || !e.body.trim()) {
      act.setError(new AppError('Each rule needs a title and text.'))
      return
    }
    if (e.title.trim() === rule.title && e.body.trim() === rule.body) {
      const { [rule.id]: _, ...rest } = editing
      setEditing(rest)
      return
    }
    act.setError(null)
    setPending({ kind: 'edit', rule, title: e.title, body: e.body })
  }

  const askAdd = () => {
    if (!adding.title.trim() || !adding.body.trim()) {
      act.setError(new AppError('A new rule needs a title and text.'))
      return
    }
    act.setError(null)
    setPending({ kind: 'add', ...adding })
  }

  const reagree = (
    <p>
      Guests with upcoming approved visits will be asked to agree again, by
      email
      {data.upcoming > 0 ? (
        <>
          {' '}
          (<strong>{data.upcoming}</strong> upcoming approved{' '}
          {data.upcoming === 1 ? 'visit' : 'visits'} right now).
        </>
      ) : (
        <> (none right now).</>
      )}{' '}
      The rule will show as “Updated” until they do.
    </p>
  )

  return (
    <Section
      title="House rules"
      lede={
        <>
          <p>
            Guests agree to each rule, in this order, before a request is
            finished. Last updated:{' '}
            <strong>
              {data.updatedAt ? fmtLongDate(data.updatedAt) : 'never'}
            </strong>
            .
          </p>
          <p>
            Changing a rule’s wording or adding a rule asks guests with upcoming
            approved visits to agree again. Reordering or removing a rule
            doesn’t.
          </p>
        </>
      }
    >
      <ErrorText error={move.error} />
      {!pending && <ErrorText error={act.error} />}
      {active.length === 0 && <Empty>No active rules.</Empty>}
      <ol class="set-list">
        {active.map((r, i) => {
          const e = editing[r.id]
          return (
            <li key={r.id} class="set-item stack">
              <div class="spread">
                <p class="set-item-title">
                  <span class="muted">{i + 1}.</span> {r.title}
                  {r.kind === 'confirmation' && (
                    <span class="pill pill-muted set-pill">
                      Final confirmation
                    </span>
                  )}
                </p>
                {!e && (
                  <RowTools
                    index={i}
                    count={active.length}
                    what={r.title}
                    onMove={d => onMove(i, d)}
                    onRemove={() => setPending({ kind: 'remove', rule: r })}
                  />
                )}
              </div>
              {e ? (
                <div class="stack">
                  <Field label="Title">
                    <Input
                      value={e.title}
                      onInput={(ev: Event) =>
                        setEditing({
                          ...editing,
                          [r.id]: {
                            ...e,
                            title: (ev.currentTarget as HTMLInputElement).value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Text">
                    <TextArea
                      rows={5}
                      value={e.body}
                      onInput={(ev: Event) =>
                        setEditing({
                          ...editing,
                          [r.id]: {
                            ...e,
                            body: (ev.currentTarget as HTMLTextAreaElement)
                              .value,
                          },
                        })
                      }
                    />
                  </Field>
                  <div class="actions">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => askSave(r)}
                    >
                      Save wording
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const { [r.id]: _, ...rest } = editing
                        setEditing(rest)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p class="set-item-body">{r.body}</p>
                  <div class="spread">
                    <span class="meta">
                      Wording from {fmtDate(r.updated_at)}
                      {r.revision > 1 && ` · version ${r.revision}`}
                    </span>
                    <Button
                      size="sm"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          [r.id]: { title: r.title, body: r.body },
                        })
                      }
                    >
                      Edit
                    </Button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ol>
      {move.busy && <Loading label="Moving…" />}

      <fieldset class="set-fieldset">
        <legend>Add a rule</legend>
        <p class="small muted">
          New rules go just before the final confirmation.
        </p>
        <Field label="Title">
          <Input
            value={adding.title}
            onInput={(e: Event) =>
              setAdding({
                ...adding,
                title: (e.currentTarget as HTMLInputElement).value,
              })
            }
          />
        </Field>
        <Field label="Text">
          <TextArea
            rows={4}
            value={adding.body}
            onInput={(e: Event) =>
              setAdding({
                ...adding,
                body: (e.currentTarget as HTMLTextAreaElement).value,
              })
            }
          />
        </Field>
        <div class="actions">
          <Button onClick={askAdd}>Add rule</Button>
        </div>
      </fieldset>

      {removed.length > 0 && (
        <details class="set-details">
          <summary>Removed rules ({removed.length})</summary>
          <ul class="set-list">
            {removed.map(r => (
              <li key={r.id} class="set-item spread">
                <span>
                  <strong>{r.title}</strong>
                  <span class="meta"> · {r.body.slice(0, 80)}</span>
                </span>
                <Button
                  size="sm"
                  onClick={() => setPending({ kind: 'restore', rule: r })}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Modal
        open={!!pending}
        onClose={() => {
          setPending(null)
          act.setError(null)
        }}
        title={
          pending?.kind === 'edit'
            ? 'Save the new wording?'
            : pending?.kind === 'add'
              ? 'Add this rule?'
              : pending?.kind === 'remove'
                ? 'Remove this rule?'
                : 'Restore this rule?'
        }
      >
        {pending && (
          <div class="stack">
            {pending.kind === 'remove' ? (
              <p>
                “{pending.rule.title}” will no longer show to guests or be asked
                of them. Nobody needs to agree again. You can restore it later.
              </p>
            ) : (
              <>
                {pending.kind === 'edit' && (
                  <p>
                    “{pending.rule.title}” will be marked{' '}
                    <strong>Updated</strong> and the rules page’s “Last updated”
                    date changes to today.
                  </p>
                )}
                {pending.kind === 'add' && (
                  <p>
                    “{pending.title.trim()}” will be added just before the final
                    confirmation.
                  </p>
                )}
                {pending.kind === 'restore' && (
                  <p>
                    “{pending.rule.title}” will come back just before the final
                    confirmation, marked Updated.
                  </p>
                )}
                <Notice tone="warn">{reagree}</Notice>
              </>
            )}
            <ErrorText error={act.error} />
            <div class="actions">
              <Button
                variant={pending.kind === 'remove' ? 'danger' : 'primary'}
                busy={act.busy}
                onClick={confirm}
              >
                {pending.kind === 'edit'
                  ? 'Save wording'
                  : pending.kind === 'add'
                    ? 'Add rule'
                    : pending.kind === 'remove'
                      ? 'Remove rule'
                      : 'Restore rule'}
              </Button>
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Section>
  )
}

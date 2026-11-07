// Activity log: every approval, denial, change, flag, pause, and settings edit, newest first.
import { Fragment } from 'preact'
import { useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import { personName } from '@/lib/auth'
import { query, supabase } from '@/lib/supabase'
import { fmtDateTime, timeAgo } from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Field,
  Input,
  Loading,
  Select,
} from '@/lib/ui'
import { ilikeTerm, PAGE, useDebounced, usePaged } from './paged'

interface Entry {
  id: number
  at: string
  actor: string
  action: string
  summary: string
  details: Record<string, unknown>
}

const AREAS: [string, string][] = [
  ['', 'All areas'],
  ['visit', 'Visits'],
  ['meal', 'Meal Train'],
  ['offer', 'Offers of help'],
  ['note', 'Notes'],
  ['schedule', 'Family schedule'],
  ['visitor', 'Visitors and flags'],
  ['pause', 'Pause'],
  ['settings', 'Settings'],
  ['week', 'Weekly cap'],
]
const AREA_LABEL = Object.fromEntries(AREAS)

// Bookkeeping columns that change with every edit; shown only in the raw view.
const NOISE = new Set(['updated_at', 'updated_by'])

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const humanize = (k: string) =>
  (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ')
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Settings edits are logged by a database trigger as "Updated <id> in <table>"; say it in words instead.
const TABLES: Record<string, [string, string]> = {
  settings: ['setting', 'key'],
  rules: ['rule', 'title'],
  booking_types: ['booking type', 'name'],
  capacity_groups: ['people limit', 'label'],
  message_templates: ['message', 'description'],
  offer_options: ['Offerings option', 'label'],
  family: ['family account', 'display_name'],
  meal_dates: ['Meal Train date', 'date'],
}

function title(e: Entry): string {
  const d = e.details ?? {}
  const table = typeof d.table === 'string' ? d.table : null
  if (!table || !e.action.startsWith('settings.')) return e.summary
  const before = isObj(d.old) ? d.old : null
  const after = isObj(d.new) ? d.new : null
  const [what, field] = TABLES[table] ?? [humanize(table), 'key']
  const raw = (after ?? before)?.[field]
  const name =
    table === 'settings' && typeof raw === 'string' ? humanize(raw) : raw
  const verb = !before
    ? 'Added'
    : !after
      ? 'Removed'
      : before.active === true && after.active === false
        ? 'Turned off'
        : before.active === false && after.active === true
          ? 'Turned on'
          : 'Changed'
  return `${verb} ${what}${name != null && name !== '' ? ` “${name}”` : ''}`
}

function Value({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === '')
    return <span class="muted">empty</span>
  if (typeof v === 'boolean') return <>{v ? 'Yes' : 'No'}</>
  if (typeof v === 'number') return <>{v}</>
  if (typeof v === 'string')
    return <span class="log-str">{ISO.test(v) ? fmtDateTime(v) : v}</span>
  const flat = (x: unknown) => x === null || typeof x !== 'object'
  // Short lists and flat objects read better as lists than as JSON.
  if (Array.isArray(v) && v.length <= 12 && v.every(flat))
    return (
      <ul class="log-values">
        {v.map((x, i) => (
          <li key={i}>
            <Value v={x} />
          </li>
        ))}
      </ul>
    )
  if (isObj(v) && Object.values(v).every(flat))
    return (
      <dl class="kv kv-inline">
        {Object.entries(v).map(([k, x]) => (
          <Fragment key={k}>
            <dt>{humanize(k)}</dt>
            <dd>
              <Value v={x} />
            </dd>
          </Fragment>
        ))}
      </dl>
    )
  return <pre class="log-json">{JSON.stringify(v, null, 2)}</pre>
}

function Pairs({ obj }: { obj: Record<string, unknown> }) {
  const keys = Object.keys(obj).filter(k => !NOISE.has(k))
  if (!keys.length) return <p class="small muted">No details.</p>
  return (
    <dl class="kv">
      {keys.map(k => (
        <Fragment key={k}>
          <dt>{humanize(k)}</dt>
          <dd>
            <Value v={obj[k]} />
          </dd>
        </Fragment>
      ))}
    </dl>
  )
}

function Details({ e }: { e: Entry }) {
  const d = e.details ?? {}
  const {
    old: before,
    new: after,
    table,
    ...rest
  } = d as { old?: unknown; new?: unknown; table?: string }
  let body = <Pairs obj={rest} />
  if (isObj(before) && isObj(after)) {
    const keys = [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].filter(k => !NOISE.has(k) && !same(before[k], after[k]))
    body = keys.length ? (
      <div class="log-diff">
        {keys.map(k => (
          <div key={k} class="log-diff-row">
            <p class="log-diff-key">{humanize(k)}</p>
            <div class="log-diff-cols">
              <div>
                <span class="meta">Before</span>
                <Value v={before[k]} />
              </div>
              <div>
                <span class="meta">After</span>
                <Value v={after[k]} />
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p class="small muted">Nothing changed but the time stamp.</p>
    )
  } else if (isObj(after)) {
    body = (
      <>
        <p class="small muted">Added:</p>
        <Pairs obj={after} />
      </>
    )
  } else if (isObj(before)) {
    body = (
      <>
        <p class="small muted">Removed:</p>
        <Pairs obj={before} />
      </>
    )
  }
  return (
    <div class="log-details stack">
      {table && (
        <p class="small muted">
          Table: <code>{table}</code>
        </p>
      )}
      {body}
      <details class="log-raw">
        <summary class="small">Raw details</summary>
        <pre class="log-json">{JSON.stringify(d, null, 2)}</pre>
      </details>
    </div>
  )
}

function Activity() {
  const [area, setArea] = useState('')
  const [q, setQ] = useState('')
  const term = useDebounced(ilikeTerm(q))
  const [open, setOpen] = useState<Set<number>>(new Set())

  const { rows, loading, loadingMore, more, error, loadMore } = usePaged<Entry>(
    before => {
      let r = supabase
        .from('activity')
        .select('*')
        .order('id', { ascending: false })
        .limit(PAGE)
      if (before != null) r = r.lt('id', before)
      if (area) r = r.like('action', `${area}.%`)
      if (term) {
        const ors = [
          `summary.ilike.*${term}*`,
          `actor.ilike.*${term}*`,
          `action.ilike.*${term}*`,
        ]
        if ('the site'.startsWith(term.toLowerCase()))
          ors.push('actor.eq.system')
        r = r.or(ors.join(','))
      }
      return query<Entry[]>(r)
    },
    `${area}|${term}`,
  )

  const toggle = (id: number) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div class="stack">
      <div class="log-filters">
        <Field label="Search">
          <Input
            type="search"
            placeholder="What happened, who, or action"
            value={q}
            onInput={(e: Event) =>
              setQ((e.currentTarget as HTMLInputElement).value)
            }
          />
        </Field>
        <Field label="Area">
          <Select
            value={area}
            onChange={(e: Event) =>
              setArea((e.currentTarget as HTMLSelectElement).value)
            }
          >
            {AREAS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <ErrorText error={error} />
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>
          {term || area ? 'Nothing matches.' : 'Nothing has happened yet.'}
        </Empty>
      ) : (
        <ul class="log-list" aria-label="Activity">
          {rows.map(e => {
            const isOpen = open.has(e.id)
            const [a, ...verb] = e.action.split('.')
            return (
              <li key={e.id} class="log-item">
                <button
                  type="button"
                  class="log-row"
                  aria-expanded={isOpen}
                  aria-controls={`log-${e.id}`}
                  onClick={() => toggle(e.id)}
                >
                  <span class="log-main">
                    <span class="log-title">{title(e)}</span>
                    <span class="meta log-sub">
                      {personName(e.actor)} · {AREA_LABEL[a] ?? humanize(a)}
                      {verb.length > 0 &&
                        `: ${verb.join('.').replace(/_/g, ' ')}`}
                    </span>
                  </span>
                  <span class="log-side">
                    <time
                      class="meta"
                      dateTime={e.at}
                      title={fmtDateTime(e.at)}
                    >
                      {fmtDateTime(e.at)}
                    </time>
                    <span class="meta log-ago">{timeAgo(e.at)}</span>
                  </span>
                  <span class="log-chevron" aria-hidden="true" />
                </button>
                {isOpen && (
                  <div id={`log-${e.id}`}>
                    <Details e={e} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {more && !loading && (
        <div class="actions">
          <Button busy={loadingMore} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

export function ActivityApp() {
  return <FamilyGate admin>{() => <Activity />}</FamilyGate>
}

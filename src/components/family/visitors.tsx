// /family/visitors/: everyone who has asked for something, their flags, and their bookings.
import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import { type FamilyStatus, personName } from '@/lib/auth'
import { query, supabase } from '@/lib/supabase'
import { fmtDateTime, fmtDay, fmtRange, mtDate, timeAgo } from '@/lib/time'
import {
  Button,
  Check,
  Empty,
  ErrorText,
  Field,
  Input,
  Loading,
  Modal,
  Notice,
  StatusPill,
  site,
  toast,
  useAction,
  useAsync,
} from '@/lib/ui'
import {
  call,
  Facts,
  FlagForm,
  FlagMeanings,
  loadTypes,
  Section,
} from './visit-kit'

interface VisitorRow {
  visitor_id: string
  name: string
  banned_until: string | null
  banned_forever: boolean
  flag_count: number
}

interface Contact {
  visitor_id: string
  email: string
  phone: string | null
  email_consent: boolean
}

interface Flag {
  id: string
  flagged_by: string
  note: string
  booking_id: string | null
  created_at: string
  removed_at: string | null
  removed_by: string | null
}

const bannedNow = (v: VisitorRow) =>
  v.banned_forever ||
  (!!v.banned_until && new Date(v.banned_until) > new Date())

function BanPill({ v }: { v: VisitorRow }) {
  if (v.banned_forever)
    return <span class="pill pill-red">Banned for good</span>
  if (v.banned_until && new Date(v.banned_until) > new Date())
    return (
      <span class="pill pill-red">
        Paused until {fmtDay(mtDate(v.banned_until))}
      </span>
    )
  return null
}

export function Visitors() {
  return <FamilyGate>{family => <VisitorsPage family={family} />}</FamilyGate>
}

function setUrlId(id: string | null) {
  const u = new URL(location.href)
  if (id) u.searchParams.set('id', id)
  else u.searchParams.delete('id')
  history.replaceState(null, '', u)
}

function VisitorsPage({ family }: { family: FamilyStatus }) {
  const admin = family.role === 'admin'
  const [search, setSearch] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [openId, setOpenId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('id'),
  )

  const data = useAsync(async () => {
    const [visitors, contacts] = await Promise.all([
      query<VisitorRow[]>(
        supabase.from('visitor_flags').select('*').order('name').limit(2000),
      ),
      admin
        ? query<Contact[]>(
            supabase
              .from('visitor_contacts')
              .select('visitor_id, email, phone, email_consent'),
          )
        : Promise.resolve([]),
    ])
    return { visitors, contacts: new Map(contacts.map(c => [c.visitor_id, c])) }
  }, [admin])

  const q = search.trim().toLowerCase()
  const rows = (data.data?.visitors ?? [])
    .filter(v => !flaggedOnly || v.flag_count > 0)
    .filter(v => {
      if (!q) return true
      const c = data.data?.contacts.get(v.visitor_id)
      return [v.name, c?.email, c?.phone].some(x =>
        x?.toLowerCase().includes(q),
      )
    })
    .sort((a, b) => b.flag_count - a.flag_count || a.name.localeCompare(b.name))

  const open = (id: string) => {
    setOpenId(id)
    setUrlId(id)
  }
  const close = () => {
    setOpenId(null)
    setUrlId(null)
  }
  const current = data.data?.visitors.find(v => v.visitor_id === openId)

  return (
    <div class="stack">
      <Section id="flags-help" title="What flags do">
        <div class="card">
          <FlagMeanings />
          <p class="meta">
            Any of the four can flag a visitor, with a note. Flags don’t expire.
            Gabriel or Micala can remove a flag added by mistake.
          </p>
        </div>
      </Section>

      <Section
        id="visitors"
        title="Visitors"
        count={data.data?.visitors.filter(v => v.flag_count > 0).length}
      >
        <div class="fam-filters">
          <Field label="Search" class="fam-search">
            <Input
              type="search"
              value={search}
              onInput={e => setSearch(e.currentTarget.value)}
              placeholder={admin ? 'Name, email, or phone' : 'Name'}
            />
          </Field>
          <Check checked={flaggedOnly} onChange={setFlaggedOnly}>
            Flagged only
          </Check>
        </div>
        {data.error && <ErrorText error={data.error} />}
        {data.loading && !data.data ? (
          <Loading />
        ) : rows.length ? (
          <div class="table-wrap">
            <table class="table fam-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Flags</th>
                  {admin && <th>Contact</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(v => {
                  const c = data.data?.contacts.get(v.visitor_id)
                  return (
                    <tr key={v.visitor_id}>
                      <td>
                        <button
                          type="button"
                          class="linklike fam-link"
                          onClick={() => open(v.visitor_id)}
                        >
                          {v.name}
                        </button>
                      </td>
                      <td>
                        <div class="row">
                          {v.flag_count > 0 ? (
                            <span class="pill pill-red">
                              {v.flag_count}{' '}
                              {v.flag_count === 1 ? 'flag' : 'flags'}
                            </span>
                          ) : (
                            <span class="muted">None</span>
                          )}
                          <BanPill v={v} />
                        </div>
                      </td>
                      {admin && (
                        <td class="fam-contact">
                          {c ? (
                            <>
                              <a href={`mailto:${c.email}`}>{c.email}</a>
                              {c.phone && <div class="meta">{c.phone}</div>}
                            </>
                          ) : (
                            <span class="muted">–</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            {q || flaggedOnly ? 'No one matches.' : 'No visitors yet.'}
          </Empty>
        )}
      </Section>

      <Modal
        open={!!openId}
        onClose={close}
        title={current?.name ?? 'Visitor'}
        wide
      >
        {openId && (
          <VisitorDetail
            id={openId}
            family={family}
            contact={data.data?.contacts.get(openId)}
            onChanged={() => data.reload()}
          />
        )}
      </Modal>
    </div>
  )
}

interface VisitorBooking {
  id: string
  type_id: number
  starts_at: string
  ends_at: string
  status: string
  headcount: number
}

function VisitorDetail({
  id,
  family,
  contact,
  onChanged,
}: {
  id: string
  family: FamilyStatus
  contact?: Contact
  onChanged: () => void
}) {
  const admin = family.role === 'admin'
  const [flagging, setFlagging] = useState(false)
  const d = useAsync(async () => {
    const [v, flags, bookings, types] = await Promise.all([
      query<VisitorRow | null>(
        supabase
          .from('visitor_flags')
          .select('*')
          .eq('visitor_id', id)
          .maybeSingle(),
      ),
      query<Flag[]>(
        supabase
          .from('flags')
          .select('*')
          .eq('visitor_id', id)
          .order('created_at'),
      ),
      query<VisitorBooking[]>(
        supabase
          .from('bookings')
          .select('id, type_id, starts_at, ends_at, status, headcount')
          .eq('visitor_id', id)
          .order('starts_at', { ascending: false }),
      ),
      loadTypes(),
    ])
    return { v, flags, bookings, types }
  }, [id])

  if (!d.data) return d.error ? <ErrorText error={d.error} /> : <Loading />
  const { v, flags, bookings, types } = d.data
  if (!v) return <Notice tone="warn">We couldn’t find that visitor.</Notice>
  const active = flags.filter(f => !f.removed_at)

  const changed = (msg: string) => {
    toast(msg)
    setFlagging(false)
    d.reload()
    onChanged()
  }

  const facts: [string, ComponentChildren][] = [
    ['Flags', `${v.flag_count}`],
    [
      'Can book',
      bannedNow(v)
        ? v.banned_forever
          ? 'No, banned for good'
          : `No, paused until ${fmtDateTime(v.banned_until as string)}`
        : v.flag_count === 1
          ? 'Yes, but each request needs 3 of 4 approvals'
          : 'Yes',
    ],
  ]
  if (admin && contact) {
    facts.push([
      'Email',
      <a href={`mailto:${contact.email}`}>{contact.email}</a>,
    ])
    facts.push([
      'Phone',
      contact.phone ? (
        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
      ) : (
        <span class="muted">Not given</span>
      ),
    ])
  }

  return (
    <div class="stack fam-detail">
      <div class="row">
        <BanPill v={v} />
      </div>
      <Facts rows={facts} />

      <div class="fam-box">
        <div class="spread">
          <h3 class="fam-h3">Flags</h3>
          {!flagging && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setFlagging(true)}
            >
              Add a flag
            </Button>
          )}
        </div>
        {flagging && (
          <FlagForm
            visitorId={v.visitor_id}
            name={v.name}
            count={active.length}
            onCancel={() => setFlagging(false)}
            onDone={changed}
          />
        )}
        {flags.length ? (
          <ul class="fam-plain">
            {flags.map(f => (
              <FlagItem
                key={f.id}
                f={f}
                admin={admin}
                onRemoved={() => changed('Flag removed')}
              />
            ))}
          </ul>
        ) : (
          <p class="meta">No flags.</p>
        )}
      </div>

      <div class="fam-box">
        <h3 class="fam-h3">Bookings</h3>
        {bookings.length ? (
          <ul class="fam-plain">
            {bookings.map(b => (
              <li key={b.id} class="spread">
                <span>
                  <a href={site(`family/visits/?id=${b.id}`)}>
                    {types.find(t => t.id === b.type_id)?.name ?? 'Booking'}
                  </a>
                  <span class="meta"> {fmtRange(b.starts_at, b.ends_at)}</span>
                </span>
                <StatusPill
                  status={b.status}
                  label={
                    b.status === 'approved' &&
                    types.find(t => t.id === b.type_id)?.approval ===
                      'acknowledge'
                      ? 'Acknowledged'
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p class="meta">No bookings.</p>
        )}
      </div>
    </div>
  )
}

function FlagItem({
  f,
  admin,
  onRemoved,
}: {
  f: Flag
  admin: boolean
  onRemoved: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const act = useAction()
  async function remove() {
    const r = await act.run(() => call('remove_flag', { p_flag: f.id }))
    if (r !== undefined) onRemoved()
  }
  return (
    <li class={f.removed_at ? 'fam-removed' : undefined}>
      <p class="small">{f.note}</p>
      <p class="meta">
        {personName(f.flagged_by)}, {fmtDateTime(f.created_at)}
        {f.booking_id && (
          <>
            {' '}
            · <a href={site(`family/visits/?id=${f.booking_id}`)}>booking</a>
          </>
        )}
        {f.removed_at &&
          `. Removed by ${personName(f.removed_by)} ${timeAgo(f.removed_at)}`}
      </p>
      {admin && !f.removed_at && (
        <div class="actions">
          {confirm ? (
            <>
              <Button
                size="sm"
                variant="danger"
                busy={act.busy}
                onClick={remove}
              >
                Remove this flag
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirm(false)}
              >
                Keep
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
              Remove
            </Button>
          )}
        </div>
      )}
      <ErrorText error={act.error} />
    </li>
  )
}

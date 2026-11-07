// /family/visits/: every booking with filters and full details, the family week calendar, and (Admins) blocks.
import { useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import type { FamilyStatus } from '@/lib/auth'
import { query, supabase } from '@/lib/supabase'
import { fmtRange } from '@/lib/time'
import {
  Empty,
  ErrorText,
  Field,
  Loading,
  Modal,
  Select,
  StatusPill,
  useAsync,
} from '@/lib/ui'
import { BlocksManager } from './blocks'
import { BookingDetail } from './booking-detail'
import { BOOKING_COLUMNS, type Booking, loadTypes, Section } from './visit-kit'
import { WeekCalendar } from './week-calendar'

type Filter = 'waiting' | 'upcoming' | 'past' | 'all'

const FILTERS: [Filter, string][] = [
  ['waiting', 'Waiting'],
  ['upcoming', 'Upcoming approved'],
  ['past', 'Past'],
  ['all', 'All'],
]

export function VisitsAdmin() {
  return <FamilyGate>{family => <VisitsPage family={family} />}</FamilyGate>
}

function setUrlId(id: string | null) {
  const u = new URL(location.href)
  if (id) u.searchParams.set('id', id)
  else u.searchParams.delete('id')
  history.replaceState(null, '', u)
}

function VisitsPage({ family }: { family: FamilyStatus }) {
  const admin = family.role === 'admin'
  const [filter, setFilter] = useState<Filter>('waiting')
  const [type, setType] = useState('')
  const [openId, setOpenId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('id'),
  )
  const [refresh, setRefresh] = useState(0)
  const types = useAsync(loadTypes)

  const list = useAsync(async () => {
    const now = new Date().toISOString()
    let q = supabase.from('bookings').select(BOOKING_COLUMNS)
    if (type) q = q.eq('type_id', Number(type))
    if (filter === 'waiting')
      q = q.in('status', ['draft', 'submitted']).order('starts_at')
    else if (filter === 'upcoming')
      q = q.eq('status', 'approved').gt('ends_at', now).order('starts_at')
    else if (filter === 'past')
      q = q.lte('ends_at', now).order('starts_at', { ascending: false })
    else q = q.order('starts_at', { ascending: false })
    const bookings = await query<Booking[]>(q.limit(300))
    const ids = [...new Set(bookings.map(b => b.visitor_id))]
    const flags = ids.length
      ? await query<{ visitor_id: string; flag_count: number }[]>(
          supabase
            .from('visitor_flags')
            .select('visitor_id, flag_count')
            .in('visitor_id', ids)
            .gt('flag_count', 0),
        )
      : []
    return {
      bookings,
      flags: new Map(flags.map(f => [f.visitor_id, f.flag_count])),
    }
  }, [filter, type, refresh])

  const open = (id: string) => {
    setOpenId(id)
    setUrlId(id)
  }
  const close = () => {
    setOpenId(null)
    setUrlId(null)
  }
  const changed = () => setRefresh(n => n + 1)

  const openName = list.data?.bookings.find(b => b.id === openId)?.name
  const typeList = types.data ?? []
  const typeName = (id: number) => typeList.find(t => t.id === id)?.name ?? ''

  return (
    <div class="stack">
      <Section id="bookings" title="Bookings">
        <div class="fam-filters">
          <fieldset class="fam-tabs">
            <legend class="sr-only">Show</legend>
            {FILTERS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                class="fam-tab"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <Field label="Type" class="fam-type-filter">
            <Select value={type} onChange={e => setType(e.currentTarget.value)}>
              <option value="">All types</option>
              {typeList.map(t => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {list.error && <ErrorText error={list.error} />}
        {list.loading && !list.data ? (
          <Loading />
        ) : list.data?.bookings.length ? (
          <div class="table-wrap" aria-busy={list.loading || undefined}>
            <table class="table fam-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Type</th>
                  <th>When</th>
                  <th>People</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.data.bookings.map(b => {
                  const flags = list.data?.flags.get(b.visitor_id) ?? 0
                  return (
                    <tr key={b.id}>
                      <td>
                        <button
                          type="button"
                          class="linklike fam-link"
                          onClick={() => open(b.id)}
                        >
                          {b.name}
                        </button>
                        {flags > 0 && (
                          <span class="pill pill-red fam-flag-pill">
                            {flags} {flags === 1 ? 'flag' : 'flags'}
                          </span>
                        )}
                      </td>
                      <td>{typeName(b.type_id)}</td>
                      <td class="fam-nowrap-sm">
                        {fmtRange(b.starts_at, b.ends_at)}
                      </td>
                      <td>{b.headcount || '–'}</td>
                      <td>
                        <StatusPill
                          status={b.status}
                          label={
                            b.status === 'approved' &&
                            typeList.find(t => t.id === b.type_id)?.approval ===
                              'acknowledge'
                              ? 'Acknowledged'
                              : undefined
                          }
                        />
                        {b.status === 'draft' && b.preapproved_by && (
                          <div class="meta">Approved early</div>
                        )}
                        {b.rules_reagree_needed && (
                          <div class="meta">Needs to re-agree</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No bookings here.</Empty>
        )}
        {list.data && list.data.bookings.length >= 300 && (
          <p class="meta">
            Showing the first 300. Filter by type to narrow it down.
          </p>
        )}
      </Section>

      <Section id="week" title="Week calendar">
        <WeekCalendar types={typeList} refresh={refresh} onOpen={open} />
      </Section>

      {admin && (
        <Section id="blocks" title="Blocked time">
          <BlocksManager person={family.person} onChanged={changed} />
        </Section>
      )}

      <Modal
        open={!!openId}
        onClose={close}
        title={openName ? `Booking: ${openName}` : 'Booking'}
        wide
      >
        {openId &&
          (types.data ? (
            <BookingDetail
              id={openId}
              family={family}
              types={types.data}
              onChanged={changed}
            />
          ) : types.error ? (
            <ErrorText error={types.error} />
          ) : (
            <Loading />
          ))}
      </Modal>
    </div>
  )
}

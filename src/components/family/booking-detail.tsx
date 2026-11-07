// One booking, in full, with every family action on it.
import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { type FamilyStatus, personName } from '@/lib/auth'
import { query, supabase } from '@/lib/supabase'
import { fmtDateTime, fmtRange, timeAgo } from '@/lib/time'
import {
  Button,
  Check,
  ErrorText,
  Field,
  Loading,
  Notice,
  StatusPill,
  site,
  TextArea,
  toast,
  useAction,
  useAsync,
} from '@/lib/ui'
import {
  type Attendee,
  answerRows,
  BOOKING_COLUMNS,
  type Booking,
  type BookingType,
  call,
  DenyNote,
  Facts,
  FlagForm,
  isRoomError,
  missingParts,
  PeopleEditor,
  type When,
  WhenFields,
  whenEnd,
  whenFrom,
  whenStart,
} from './visit-kit'

interface Change {
  id: string
  proposed_by: string
  starts_at: string
  ends_at: string
  attendees: Attendee[] | null
  note: string | null
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn'
  created_at: string
  decided_at: string | null
  decided_by: string | null
  decision_note: string | null
}

interface Rule {
  id: string
  position: number
  title: string
  kind: string
  revision: number
}

interface Agreement {
  rule_id: string
  revision: number
  agreed_at: string
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

interface Detail {
  b: Booking
  approvals: { person: string; at: string }[]
  changes: Change[]
  rules: Rule[]
  agreements: Agreement[]
  flags: Flag[]
  contact: {
    email: string
    phone: string | null
    email_consent: boolean
  } | null
}

async function loadDetail(id: string, admin: boolean): Promise<Detail | null> {
  const b = await query<Booking | null>(
    supabase
      .from('bookings')
      .select(BOOKING_COLUMNS)
      .eq('id', id)
      .maybeSingle(),
  )
  if (!b) return null
  const [approvals, changes, rules, agreements, flags, contact] =
    await Promise.all([
      query<Detail['approvals']>(
        supabase
          .from('booking_approvals')
          .select('person, at')
          .eq('booking_id', id)
          .order('at'),
      ),
      query<Change[]>(
        supabase
          .from('booking_changes')
          .select('*')
          .eq('booking_id', id)
          .order('created_at', { ascending: false }),
      ),
      query<Rule[]>(
        supabase
          .from('rules')
          .select('id, position, title, kind, revision')
          .eq('active', true)
          .order('position'),
      ),
      query<Agreement[]>(
        supabase
          .from('rule_agreements')
          .select('rule_id, revision, agreed_at')
          .eq('booking_id', id),
      ),
      query<Flag[]>(
        supabase
          .from('flags')
          .select('*')
          .eq('visitor_id', b.visitor_id)
          .order('created_at'),
      ),
      admin
        ? query<Detail['contact']>(
            supabase
              .from('visitor_contacts')
              .select('email, phone, email_consent')
              .eq('visitor_id', b.visitor_id)
              .maybeSingle(),
          )
        : Promise.resolve(null),
    ])
  return { b, approvals, changes, rules, agreements, flags, contact }
}

type Mode = null | 'deny' | 'cancel' | 'shorten' | 'change' | 'decline' | 'flag'

export function BookingDetail({
  id,
  family,
  types,
  onChanged,
}: {
  id: string
  family: FamilyStatus
  types: BookingType[]
  onChanged: () => void
}) {
  const admin = family.role === 'admin'
  const detail = useAsync(() => loadDetail(id, admin), [id, admin])
  const [mode, setMode] = useState<Mode>(null)
  const act = useAction()

  if (!detail.data) {
    if (detail.error) return <ErrorText error={detail.error} />
    if (detail.loading) return <Loading />
    return <Notice tone="warn">We couldn’t find that booking.</Notice>
  }

  const { b, approvals, changes, rules, agreements, flags, contact } =
    detail.data
  const type = types.find(t => t.id === b.type_id)
  const ack = type?.approval === 'acknowledge'
  const verb = ack ? 'Acknowledge' : 'Approve'
  const activeFlags = flags.filter(f => !f.removed_at)
  const flagged = activeFlags.length === 1
  const waiting = b.status === 'draft' || b.status === 'submitted'
  const live = waiting || b.status === 'approved'
  const pending = changes.find(c => c.status === 'pending')
  const votes = approvals.map(a => a.person)
  const voted = votes.includes(family.person)
  const agreedMap = new Map(agreements.map(a => [a.rule_id, a]))
  const agreedCount = rules.filter(
    r => (agreedMap.get(r.id)?.revision ?? 0) >= r.revision,
  ).length
  const rulesDone = agreedCount === rules.length
  const answers = answerRows(type, b.answers)
  const answersDone =
    b.attendees.length > 0 &&
    b.attendees.every(a => a.name?.trim() && a.relationship?.trim()) &&
    !!b.answers?.bring?.trim() &&
    (type?.questions ?? []).every(
      q => !q.required || !!b.answers?.[q.key]?.trim(),
    )
  const canApprove =
    waiting &&
    (flagged ? !voted : admin && !(b.status === 'draft' && b.preapproved_by))

  const facts: [string, ComponentChildren][] = [
    ['Type', type?.name ?? `Type ${b.type_id}`],
    ['When', `${fmtRange(b.starts_at, b.ends_at)} (Mountain Time)`],
    ['People', String(b.headcount || b.attendees.length || 1)],
    b.submitted_at
      ? ['Sent', fmtDateTime(b.submitted_at)]
      : ['Started', fmtDateTime(b.created_at)],
  ]
  if (b.preapproved_by && b.status === 'draft')
    facts.push([
      'Held approval',
      `${personName(b.preapproved_by)} approved early. Released when they finish.`,
    ])
  if (b.decided_by)
    facts.push([
      b.status === 'denied' ? 'Denied by' : 'Decided by',
      `${personName(b.decided_by)}${b.decided_at ? `, ${fmtDateTime(b.decided_at)}` : ''}`,
    ])
  if (b.decision_note) facts.push(['Denial note', b.decision_note])
  if (b.cancelled_by)
    facts.push([
      'Cancelled by',
      `${personName(b.cancelled_by)}${b.cancelled_at ? `, ${fmtDateTime(b.cancelled_at)}` : ''}`,
    ])
  if (b.cancel_note) facts.push(['Cancel or shorten note', b.cancel_note])
  if (b.healthy_at) facts.push(['Healthy confirmed', fmtDateTime(b.healthy_at)])

  const done = (msg: string) => {
    toast(msg)
    setMode(null)
    detail.reload()
    onChanged()
  }

  async function approve() {
    const r = await act.run(() =>
      call<{ status: string; votes: number; needed: number }>(
        'family_decide_visit',
        {
          p_booking: b.id,
          p_decision: ack ? 'acknowledge' : 'approve',
        },
      ),
    )
    if (!r) return
    done(
      r.status === 'approved'
        ? ack
          ? 'Trip acknowledged'
          : 'Approved'
        : r.status === 'held'
          ? `${verb}d early. Held until they finish.`
          : `Vote recorded: ${r.votes} of ${r.needed}`,
    )
  }

  async function respond(c: Change, accept: boolean, note?: string) {
    const r = await act.run(() =>
      call('family_respond_change', {
        p_change: c.id,
        p_accept: accept,
        p_note: note ?? null,
      }),
    )
    if (r !== undefined)
      done(
        accept
          ? 'Change approved. The guest was emailed.'
          : 'Change declined. The guest was emailed.',
      )
  }

  return (
    <div class="stack fam-detail">
      <div class="row">
        <StatusPill
          status={b.status}
          label={ack && b.status === 'approved' ? 'Acknowledged' : undefined}
        />
        {activeFlags.length > 0 && (
          <a
            class="pill pill-red"
            href={site(`family/visitors/?id=${b.visitor_id}`)}
          >
            {activeFlags.length} {activeFlags.length === 1 ? 'flag' : 'flags'}
          </a>
        )}
        {b.rules_reagree_needed && (
          <span class="pill pill-yellow">Needs to re-agree to rules</span>
        )}
        {b.healthy_at && <span class="pill pill-green">Healthy confirmed</span>}
      </div>

      <Facts rows={facts} />

      {admin && contact && (
        <div class="fam-box">
          <h3 class="fam-h3">Contact</h3>
          <Facts
            rows={[
              [
                'Email',
                <a href={`mailto:${contact.email}`}>{contact.email}</a>,
              ],
              [
                'Phone',
                contact.phone ? (
                  <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                ) : (
                  <span class="muted">Not given</span>
                ),
              ],
              ['Email consent', contact.email_consent ? 'Yes' : 'No'],
            ]}
          />
        </div>
      )}

      {/* ---------------------------------------------------------- actions */}
      {mode === null && (
        <div class="actions fam-detail-actions">
          {canApprove && (
            <Button variant="primary" busy={act.busy} onClick={approve}>
              {flagged
                ? `Vote to approve (${votes.length} of 3)`
                : b.status === 'draft'
                  ? `${verb} early`
                  : verb}
            </Button>
          )}
          {admin && waiting && (
            <Button
              variant="danger"
              disabled={act.busy}
              onClick={() => setMode('deny')}
            >
              Deny
            </Button>
          )}
          {admin &&
            (b.status === 'submitted' || b.status === 'approved') &&
            !pending && (
              <Button onClick={() => setMode('change')}>
                Propose a change
              </Button>
            )}
          {admin && live && (
            <Button onClick={() => setMode('shorten')}>Shorten</Button>
          )}
          {admin && live && (
            <Button variant="danger" onClick={() => setMode('cancel')}>
              Cancel booking
            </Button>
          )}
          <Button variant="ghost" onClick={() => setMode('flag')}>
            Flag visitor
          </Button>
        </div>
      )}
      {mode === null && b.status === 'draft' && (
        <p class="meta">
          Still needs:{' '}
          {missingParts(rulesDone, answersDone).join(' and ') ||
            'only the guest’s final send'}
          .{canApprove && ' You can approve now; it’s held until they finish.'}
        </p>
      )}
      {mode === null && act.error ? (
        <div class="stack">
          <ErrorText error={act.error} />
          {admin && isRoomError(act.error) && (
            <div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setMode('deny')}
              >
                Deny with a note
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {mode === 'deny' && (
        <DenyForm b={b} onCancel={() => setMode(null)} onDone={done} />
      )}
      {mode === 'cancel' && (
        <CancelForm b={b} onCancel={() => setMode(null)} onDone={done} />
      )}
      {mode === 'shorten' && (
        <ShortenForm
          b={b}
          type={type}
          onCancel={() => setMode(null)}
          onDone={done}
        />
      )}
      {mode === 'change' && (
        <ChangeForm
          b={b}
          type={type}
          onCancel={() => setMode(null)}
          onDone={done}
        />
      )}
      {mode === 'flag' && (
        <FlagForm
          visitorId={b.visitor_id}
          name={b.name}
          bookingId={b.id}
          count={activeFlags.length}
          onCancel={() => setMode(null)}
          onDone={done}
        />
      )}

      {/* --------------------------------------------------------- details */}
      <div class="fam-box">
        <h3 class="fam-h3">Who’s coming</h3>
        {b.attendees.length ? (
          <ul class="fam-people-list">
            {b.attendees.map(a => (
              <li key={a.name}>
                <strong>{a.name}</strong>
                {a.age && <span class="muted"> (age {a.age})</span>}
                {a.relationship && <span>, {a.relationship}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p class="meta">
            Not answered yet. {b.name} stands in for the group.
          </p>
        )}
      </div>

      <div class="fam-box">
        <h3 class="fam-h3">Answers</h3>
        {answers.length ? (
          <Facts rows={answers} />
        ) : (
          <p class="meta">No answers yet.</p>
        )}
      </div>

      <div class="fam-box">
        <h3 class="fam-h3">
          Rules agreed: {agreedCount} of {rules.length}
        </h3>
        <ul class="fam-rules">
          {rules.map(r => {
            const a = agreedMap.get(r.id)
            const ok = a && a.revision >= r.revision
            return (
              <li key={r.id} class={ok ? 'ok' : 'no'}>
                <span class="fam-mark" aria-hidden="true">
                  {ok ? '✓' : '–'}
                </span>
                <span>
                  {r.title}
                  <span class="meta">
                    {' '}
                    {ok
                      ? `agreed ${fmtDateTime(a.agreed_at)}`
                      : a
                        ? 'agreed to an older version'
                        : 'not agreed'}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {(votes.length > 0 || flagged) && (
        <div class="fam-box">
          <h3 class="fam-h3">
            Approval votes{flagged ? `: ${votes.length} of 3` : ''}
          </h3>
          {votes.length ? (
            <ul class="fam-plain">
              {approvals.map(a => (
                <li key={a.person}>
                  {personName(a.person)}{' '}
                  <span class="meta">{fmtDateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="meta">No votes yet.</p>
          )}
          {flagged && (
            <p class="meta">
              This visitor has a flag, so any 3 of the 4 need to approve.
            </p>
          )}
        </div>
      )}

      <div class="fam-box">
        <h3 class="fam-h3">Changes</h3>
        {changes.length ? (
          <ul class="fam-plain fam-changes">
            {changes.map(c => (
              <li key={c.id}>
                <div class="spread">
                  <span>
                    <strong>
                      {c.proposed_by === 'guest'
                        ? b.name
                        : personName(c.proposed_by)}
                    </strong>{' '}
                    proposed {fmtRange(c.starts_at, c.ends_at)}
                  </span>
                  <StatusPill
                    status={
                      c.status === 'accepted'
                        ? 'approved'
                        : c.status === 'declined'
                          ? 'denied'
                          : c.status === 'withdrawn'
                            ? 'cancelled'
                            : 'pending'
                    }
                    label={
                      {
                        pending: 'Waiting',
                        accepted: 'Accepted',
                        declined: 'Declined',
                        withdrawn: 'Withdrawn',
                      }[c.status]
                    }
                  />
                </div>
                {c.attendees && (
                  <p class="small">
                    People: {c.attendees.map(a => a.name).join(', ')} (
                    {c.attendees.length})
                  </p>
                )}
                {c.note && <p class="small">Note: {c.note}</p>}
                <p class="meta">
                  {timeAgo(c.created_at)}
                  {c.decided_at &&
                    `. ${c.status === 'accepted' ? 'Accepted' : c.status === 'declined' ? 'Declined' : 'Closed'} by ${personName(c.decided_by) || 'the site'} ${timeAgo(c.decided_at)}`}
                  {c.decision_note && `. Note: ${c.decision_note}`}
                </p>
                {c.status === 'pending' &&
                  c.proposed_by === 'guest' &&
                  admin &&
                  mode !== 'decline' && (
                    <div class="actions">
                      <Button
                        size="sm"
                        variant="primary"
                        busy={act.busy}
                        onClick={() => respond(c, true)}
                      >
                        Approve change
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={act.busy}
                        onClick={() => setMode('decline')}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                {c.status === 'pending' && c.proposed_by !== 'guest' && (
                  <p class="meta">Waiting for the guest to accept.</p>
                )}
                {c.status === 'pending' && mode === 'decline' && (
                  <DeclineForm
                    busy={act.busy}
                    onCancel={() => setMode(null)}
                    onSubmit={note => respond(c, false, note)}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p class="meta">No changes.</p>
        )}
        {mode === 'decline' && <ErrorText error={act.error} />}
      </div>

      <div class="fam-box">
        <div class="spread">
          <h3 class="fam-h3">Flags for {b.name}</h3>
          <a class="small" href={site(`family/visitors/?id=${b.visitor_id}`)}>
            Visitor page
          </a>
        </div>
        {flags.length ? (
          <ul class="fam-plain">
            {flags.map(f => (
              <li key={f.id} class={f.removed_at ? 'fam-removed' : undefined}>
                <p class="small">{f.note}</p>
                <p class="meta">
                  {personName(f.flagged_by)}, {fmtDateTime(f.created_at)}
                  {f.removed_at &&
                    `. Removed by ${personName(f.removed_by)} ${timeAgo(f.removed_at)}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p class="meta">No flags.</p>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ forms

interface FormProps {
  b: Booking
  onCancel: () => void
  onDone: (msg: string) => void
}

function FormBox({
  title,
  children,
}: {
  title: string
  children: ComponentChildren
}) {
  return (
    <div class="fam-inline-form stack">
      <h3 class="fam-h3">{title}</h3>
      {children}
    </div>
  )
}

function DenyForm({ b, onCancel, onDone }: FormProps) {
  const [note, setNote] = useState('')
  const act = useAction()
  async function submit() {
    const r = await act.run(() =>
      call('family_decide_visit', {
        p_booking: b.id,
        p_decision: 'deny',
        p_note: note,
      }),
    )
    if (r !== undefined) onDone('Denied. The guest was emailed.')
  }
  return (
    <FormBox title="Deny this request">
      <DenyNote
        typeId={b.type_id}
        near={b.starts_at}
        value={note}
        onChange={setNote}
      />
      <ErrorText error={act.error} />
      <div class="actions">
        <Button variant="danger" busy={act.busy} onClick={submit}>
          Send denial
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </FormBox>
  )
}

function CancelForm({ b, onCancel, onDone }: FormProps) {
  const [note, setNote] = useState('')
  const act = useAction()
  async function submit() {
    const r = await act.run(() =>
      call('family_cancel_visit', { p_booking: b.id, p_note: note }),
    )
    if (r !== undefined) onDone('Cancelled. The guest was emailed.')
  }
  return (
    <FormBox title="Cancel this booking">
      <p class="small">
        The time is released right away and {b.name} gets an email.
      </p>
      <Field label="Note to the guest" optional>
        <TextArea
          value={note}
          onInput={e => setNote(e.currentTarget.value)}
          maxLength={1000}
        />
      </Field>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button variant="danger" busy={act.busy} onClick={submit}>
          Cancel booking
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </FormBox>
  )
}

function ShortenForm({
  b,
  type,
  onCancel,
  onDone,
}: FormProps & { type?: BookingType }) {
  const [when, setWhen] = useState<When>(() => whenFrom(b.starts_at, b.ends_at))
  const [note, setNote] = useState('')
  const act = useAction()
  async function submit() {
    const r = await act.run(() =>
      call('family_shorten_visit', {
        p_booking: b.id,
        p_starts_at: whenStart(when),
        p_ends_at: whenEnd(when),
        p_note: note,
      }),
    )
    if (r !== undefined) onDone('Shortened. The guest was emailed.')
  }
  return (
    <FormBox title="Shorten this booking">
      <p class="small">
        The new times need to fit inside {fmtRange(b.starts_at, b.ends_at)}.
      </p>
      <WhenFields
        value={when}
        onChange={setWhen}
        startLabel={type?.start_label}
        endLabel={type?.end_label}
      />
      <Field label="Note to the guest" optional>
        <TextArea
          value={note}
          onInput={e => setNote(e.currentTarget.value)}
          maxLength={1000}
        />
      </Field>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button variant="primary" busy={act.busy} onClick={submit}>
          Shorten
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </FormBox>
  )
}

function ChangeForm({
  b,
  type,
  onCancel,
  onDone,
}: FormProps & { type?: BookingType }) {
  const [when, setWhen] = useState<When>(() => whenFrom(b.starts_at, b.ends_at))
  const [people, setPeople] = useState(false)
  const [attendees, setAttendees] = useState<Attendee[]>(() =>
    b.attendees.length
      ? b.attendees.map(a => ({ ...a }))
      : [{ name: b.name, relationship: '' }],
  )
  const [note, setNote] = useState('')
  const act = useAction()
  async function submit() {
    const r = await act.run(() =>
      call('family_propose_change', {
        p_booking: b.id,
        p_starts_at: whenStart(when),
        p_ends_at: whenEnd(when),
        p_attendees: people ? attendees.filter(a => a.name.trim()) : null,
        p_note: note,
      }),
    )
    if (r !== undefined)
      onDone('Change proposed. The guest was emailed to accept or decline.')
  }
  return (
    <FormBox title="Propose a change">
      <p class="small">The booking stands as it is until {b.name} accepts.</p>
      <WhenFields
        value={when}
        onChange={setWhen}
        startLabel={type?.start_label}
        endLabel={type?.end_label}
      />
      <Check checked={people} onChange={setPeople}>
        Change who’s coming
      </Check>
      {people && <PeopleEditor value={attendees} onChange={setAttendees} />}
      <Field label="Note to the guest" optional>
        <TextArea
          value={note}
          onInput={e => setNote(e.currentTarget.value)}
          maxLength={1000}
        />
      </Field>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button variant="primary" busy={act.busy} onClick={submit}>
          Send proposal
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </FormBox>
  )
}

function DeclineForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  onCancel: () => void
  onSubmit: (note: string) => void
}) {
  const [note, setNote] = useState('')
  return (
    <div class="fam-inline-form stack">
      <Field label="Note to the guest" optional>
        <TextArea
          value={note}
          onInput={e => setNote(e.currentTarget.value)}
          maxLength={1000}
        />
      </Field>
      <div class="actions">
        <Button
          size="sm"
          variant="danger"
          busy={busy}
          onClick={() => onSubmit(note)}
        >
          Decline change
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  )
}

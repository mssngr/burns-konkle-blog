// The family dashboard: everything waiting for Gabriel and Micala (and what Vincent and Samantha can act on or see).
import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import { type FamilyStatus, personName } from '@/lib/auth'
import { fmtDate, fmtDay, fmtRange, fmtTime, timeAgo } from '@/lib/time'
import {
  Button,
  Empty,
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
  attendeeLine,
  call,
  DenyNote,
  isRoomError,
  missingParts,
  names,
  Section,
} from './visit-kit'

interface DashVisit {
  id: string
  name: string
  status: 'draft' | 'submitted'
  type_id: number
  type_name: string
  approval: 'approve' | 'acknowledge'
  starts_at: string
  ends_at: string
  headcount: number
  attendees: Attendee[]
  answers: Record<string, string>
  visitor_id: string
  preapproved_by: string | null
  submitted_at: string | null
  created_at: string
  flags: number
  votes: string[]
  rules_complete: boolean
  answers_complete: boolean
}

interface DashChange {
  id: string
  booking_id: string
  name: string
  type_name: string
  proposed_by: string
  old_starts_at: string
  old_ends_at: string
  starts_at: string
  ends_at: string
  attendees: Attendee[] | null
  note: string | null
  created_at: string
}

interface DashMeal {
  id: string
  name: string
  status: 'draft' | 'submitted'
  date: string
  slot: string
  label: string
  start: string
  dish: string | null
  created_at: string
}

interface DashReply {
  id: string
  offer_id: string
  name: string
  body: string
  drafted_by: string
  created_at: string
  approvals: string[]
}

interface DashNote {
  id: string
  name: string
  body: string
  photos: string[]
  created_at: string
}

interface DashHelp {
  id: string
  title: string
  starts_at: string
  help_description: string | null
  claimed_by: string | null
}

interface Dash {
  me: string
  role: 'admin' | 'elevated'
  paused: boolean
  pause_request: {
    id: string
    requested_by: string
    requested_at: string
  } | null
  week: { start: string; count: number; cap: number }
  visits: DashVisit[]
  changes: DashChange[]
  meals: DashMeal[]
  replies: DashReply[]
  offers_new: number
  notes: DashNote[]
  help: DashHelp[]
  reagree: { id: string; name: string; starts_at: string; type_name: string }[]
  upcoming: {
    kind: 'visit' | 'meal'
    id: string
    name: string
    what: string
    starts_at: string
    ends_at: string
    headcount: number
    healthy_at: string | null
  }[]
}

export function Dashboard() {
  return <FamilyGate>{family => <Board family={family} />}</FamilyGate>
}

function Board({ family }: { family: FamilyStatus }) {
  const dash = useAsync(() => call<Dash>('family_dashboard'))
  const d = dash.data
  if (!d) return dash.error ? <ErrorText error={dash.error} /> : <Loading />

  const admin = family.role === 'admin'
  const me = family.person
  const reload = () => dash.reload()

  const requests = d.visits.filter(v => v.approval === 'approve')
  const trips = d.visits.filter(v => v.approval === 'acknowledge')
  const flagged = d.visits.filter(v => v.flags === 1)

  const glance: [string, string, number][] = [
    ['requests', 'Visit requests', requests.length],
    ['trips', 'Colorado trips', trips.length],
    ['changes', 'Changes', d.changes.length],
    ['meals', 'Meal Train', d.meals.length],
    ['replies', 'Offer replies', d.replies.length],
    ['notes', 'Notes', d.notes.length],
    ['help', 'Help requests', d.help.filter(h => !h.claimed_by).length],
  ]

  return (
    <div class="stack fam-dash">
      {dash.error && <ErrorText error={dash.error} />}
      <nav class="fam-glance" aria-label="Waiting for you">
        {glance.map(([id, label, n]) => (
          <a key={id} href={`#${id}`} class={n ? 'has' : undefined}>
            <strong>{n}</strong> {label}
          </a>
        ))}
        {flagged.length > 0 && (
          <a href="#requests" class="has flag">
            <strong>{flagged.length}</strong> from flagged visitors
          </a>
        )}
      </nav>

      <Section
        id="requests"
        title="Visit requests waiting"
        count={requests.length}
      >
        {requests.length ? (
          <div class="cards">
            {requests.map(v => (
              <VisitCard
                key={v.id}
                v={v}
                me={me}
                admin={admin}
                onDone={reload}
              />
            ))}
          </div>
        ) : (
          <Empty>No visit requests waiting.</Empty>
        )}
      </Section>

      <Section
        id="trips"
        title="Colorado trips to acknowledge"
        count={trips.length}
      >
        {trips.length ? (
          <div class="cards">
            {trips.map(v => (
              <VisitCard
                key={v.id}
                v={v}
                me={me}
                admin={admin}
                onDone={reload}
              />
            ))}
          </div>
        ) : (
          <Empty>No trips waiting.</Empty>
        )}
      </Section>

      <Section
        id="changes"
        title="Change and extension requests"
        count={d.changes.length}
      >
        {d.changes.length ? (
          <div class="cards">
            {d.changes.map(c => (
              <ChangeCard key={c.id} c={c} admin={admin} onDone={reload} />
            ))}
          </div>
        ) : (
          <Empty>No changes waiting.</Empty>
        )}
      </Section>

      <Section
        id="meals"
        title="Meal Train sign-ups waiting"
        count={d.meals.length}
        aside={<a href={site('family/meals/')}>Meal Train</a>}
      >
        {d.meals.length ? (
          <div class="cards cards-2">
            {d.meals.map(m => (
              <MealCard key={m.id} m={m} onDone={reload} />
            ))}
          </div>
        ) : (
          <Empty>No sign-ups waiting.</Empty>
        )}
      </Section>

      <Section
        id="replies"
        title="Offer replies waiting for a second approval"
        count={d.replies.length}
        aside={<a href={site('family/offers/')}>Offers of help</a>}
      >
        {d.offers_new > 0 && (
          <p class="meta">
            <a href={site('family/offers/')}>
              {d.offers_new} {d.offers_new === 1 ? 'offer has' : 'offers have'}{' '}
              no reply yet.
            </a>
          </p>
        )}
        {d.replies.length ? (
          <div class="cards cards-2">
            {d.replies.map(r => (
              <ReplyCard key={r.id} r={r} me={me} onDone={reload} />
            ))}
          </div>
        ) : (
          <Empty>No replies waiting.</Empty>
        )}
      </Section>

      <Section
        id="notes"
        title="Family & friends notes to publish"
        count={d.notes.length}
        aside={<a href={site('family/notes/')}>All notes</a>}
      >
        {d.notes.length ? (
          <div class="cards cards-2">
            {d.notes.map(n => (
              <NoteCard key={n.id} n={n} admin={admin} onDone={reload} />
            ))}
          </div>
        ) : (
          <Empty>No notes waiting.</Empty>
        )}
      </Section>

      <Section
        id="help"
        title="Help requests"
        count={d.help.filter(h => !h.claimed_by).length}
        aside={<a href={site('family/schedule/')}>Family schedule</a>}
      >
        {d.help.length ? (
          <div class="cards cards-2">
            {d.help.map(h => (
              <HelpCard key={h.id} h={h} me={me} onDone={reload} />
            ))}
          </div>
        ) : (
          <Empty>No help requests.</Empty>
        )}
      </Section>

      <div class="cards cards-2">
        <WeekCard week={d.week} />
        <PauseCard d={d} me={me} admin={admin} onDone={reload} />
      </div>

      {d.reagree.length > 0 && (
        <Section
          id="reagree"
          title="Need to re-agree to updated rules"
          count={d.reagree.length}
        >
          <ul class="fam-list card">
            {d.reagree.map(r => (
              <li key={r.id}>
                <a href={site(`family/visits/?id=${r.id}`)}>{r.name}</a>
                <span class="meta">
                  {r.type_name}, {fmtDate(r.starts_at)} at{' '}
                  {fmtTime(r.starts_at)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        id="upcoming"
        title="Next 7 days"
        aside={<a href={site('family/visits/')}>Visit calendar</a>}
      >
        {d.upcoming.length ? (
          <ul class="fam-list card">
            {d.upcoming.map(u => (
              <li key={`${u.kind}-${u.id}`}>
                <span
                  class={`fam-dot st-${u.kind === 'meal' ? 'purple' : 'blue'}`}
                  aria-hidden="true"
                />
                <div class="fam-list-main">
                  <a
                    href={site(
                      u.kind === 'visit'
                        ? `family/visits/?id=${u.id}`
                        : 'family/meals/',
                    )}
                  >
                    {u.name}
                  </a>
                  <span class="meta">
                    {u.kind === 'meal' ? `Meal drop-off: ${u.what}` : u.what}
                    {u.kind === 'visit' &&
                      `, ${u.headcount || 1} ${u.headcount === 1 ? 'person' : 'people'}`}
                  </span>
                </div>
                <div class="fam-list-side">
                  <span class="small">{fmtRange(u.starts_at, u.ends_at)}</span>
                  {u.healthy_at && (
                    <span class="pill pill-green">Healthy confirmed</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nothing approved for the next 7 days.</Empty>
        )}
      </Section>
    </div>
  )
}

// ------------------------------------------------------------------ cards

function Card({
  title,
  pills,
  children,
  actions,
}: {
  title: ComponentChildren
  pills?: ComponentChildren
  children?: ComponentChildren
  actions?: ComponentChildren
}) {
  return (
    <article class="card fam-card">
      <header class="fam-card-head">
        <h3 class="card-title">{title}</h3>
        {pills && <div class="row">{pills}</div>}
      </header>
      {children}
      {actions && <div class="actions fam-card-actions">{actions}</div>}
    </article>
  )
}

function VisitCard({
  v,
  me,
  admin,
  onDone,
}: {
  v: DashVisit
  me: string
  admin: boolean
  onDone: () => void
}) {
  const act = useAction()
  const [denying, setDenying] = useState(false)
  const [note, setNote] = useState('')
  const flagged = v.flags === 1
  const voted = v.votes.includes(me)
  const draft = v.status === 'draft'
  const ack = v.approval === 'acknowledge'
  const verb = ack ? 'Acknowledge' : 'Approve'
  const missing = missingParts(v.rules_complete, v.answers_complete)
  const canApprove = flagged ? !voted : admin && !(draft && v.preapproved_by)

  async function approve() {
    const r = await act.run(() =>
      call<{ status: string; votes: number; needed: number }>(
        'family_decide_visit',
        {
          p_booking: v.id,
          p_decision: ack ? 'acknowledge' : 'approve',
        },
      ),
    )
    if (!r) return
    if (r.status === 'approved') toast(ack ? 'Trip acknowledged' : 'Approved')
    else if (r.status === 'held')
      toast(`${verb}d early. Held until they finish.`)
    else toast(`Vote recorded: ${r.votes} of ${r.needed}`)
    onDone()
  }

  async function deny() {
    const r = await act.run(
      () =>
        call('family_decide_visit', {
          p_booking: v.id,
          p_decision: 'deny',
          p_note: note,
        }),
      'Denied. The guest was emailed.',
    )
    if (r !== undefined) onDone()
  }

  return (
    <Card
      title={<a href={site(`family/visits/?id=${v.id}`)}>{v.name}</a>}
      pills={
        <>
          <StatusPill status={v.status} />
          {flagged && (
            <span class="pill pill-red">
              Flagged: {v.votes.length} of 3 votes
            </span>
          )}
        </>
      }
      actions={
        denying ? null : (
          <>
            {canApprove && (
              <Button
                variant="primary"
                size="sm"
                busy={act.busy}
                onClick={approve}
              >
                {flagged
                  ? `Vote to approve (${v.votes.length} of 3)`
                  : draft
                    ? `${verb} early`
                    : verb}
              </Button>
            )}
            {admin && (
              <Button
                variant="danger"
                size="sm"
                disabled={act.busy}
                onClick={() => {
                  act.setError(null)
                  setDenying(true)
                }}
              >
                Deny
              </Button>
            )}
            <a
              class="btn btn-ghost btn-sm"
              href={site(`family/visits/?id=${v.id}`)}
            >
              Details
            </a>
          </>
        )
      }
    >
      <p class="fam-when-line">
        <strong>{v.type_name}</strong>
        <br />
        {fmtRange(v.starts_at, v.ends_at)}
      </p>
      {v.attendees.length > 0 ? (
        <p class="small">
          {v.attendees.length} {v.attendees.length === 1 ? 'person' : 'people'}:{' '}
          {v.attendees.map(attendeeLine).join('; ')}
        </p>
      ) : null}
      {v.answers?.bring && <p class="small">Bringing: {v.answers.bring}</p>}
      {draft && missing.length > 0 && (
        <p class="small fam-missing">Still needs: {missing.join(' and ')}</p>
      )}
      {v.preapproved_by && draft && (
        <p class="small muted">
          {personName(v.preapproved_by)} approved early. Held until they finish.
        </p>
      )}
      {flagged && v.votes.length > 0 && (
        <p class="small muted">Votes: {names(v.votes)}</p>
      )}
      {flagged && voted && (
        <p class="small muted">
          You voted. Needs {Math.max(3 - v.votes.length, 0)} more.
        </p>
      )}
      {draft && !v.preapproved_by && canApprove && (
        <p class="meta">
          You can approve now. It’s held until they finish the rules and
          questions.
        </p>
      )}
      <p class="meta">
        {v.submitted_at
          ? `Sent ${timeAgo(v.submitted_at)}`
          : `Started ${timeAgo(v.created_at)}`}
      </p>

      {act.error && !denying ? (
        <div class="stack">
          <ErrorText error={act.error} />
          {admin && isRoomError(act.error) && (
            <div>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setDenying(true)}
              >
                Deny with a note
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {denying && (
        <div class="fam-inline-form stack">
          <DenyNote
            typeId={v.type_id}
            near={v.starts_at}
            value={note}
            onChange={setNote}
          />
          {act.error ? <ErrorText error={act.error} /> : null}
          <div class="actions">
            <Button variant="danger" size="sm" busy={act.busy} onClick={deny}>
              Send denial
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDenying(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function ChangeCard({
  c,
  admin,
  onDone,
}: {
  c: DashChange
  admin: boolean
  onDone: () => void
}) {
  const act = useAction()
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')
  const fromGuest = c.proposed_by === 'guest'

  async function respond(accept: boolean) {
    const r = await act.run(
      () =>
        call('family_respond_change', {
          p_change: c.id,
          p_accept: accept,
          p_note: accept ? null : note,
        }),
      accept
        ? 'Change approved. The guest was emailed.'
        : 'Change declined. The guest was emailed.',
    )
    if (r !== undefined) onDone()
  }

  return (
    <Card
      title={<a href={site(`family/visits/?id=${c.booking_id}`)}>{c.name}</a>}
      pills={
        <span class="pill pill-orange">
          {fromGuest ? 'Guest asked' : `${personName(c.proposed_by)} proposed`}
        </span>
      }
      actions={
        fromGuest && admin && !declining ? (
          <>
            <Button
              variant="primary"
              size="sm"
              busy={act.busy}
              onClick={() => respond(true)}
            >
              Approve change
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={act.busy}
              onClick={() => setDeclining(true)}
            >
              Decline
            </Button>
          </>
        ) : null
      }
    >
      <p class="small">
        <strong>{c.type_name}</strong>
      </p>
      <dl class="fam-compare">
        <div>
          <dt>Now</dt>
          <dd>{fmtRange(c.old_starts_at, c.old_ends_at)}</dd>
        </div>
        <div>
          <dt>Proposed</dt>
          <dd>
            {fmtRange(c.starts_at, c.ends_at)}
            {c.attendees && (
              <>
                <br />
                {c.attendees.length}{' '}
                {c.attendees.length === 1 ? 'person' : 'people'}:{' '}
                {c.attendees.map(attendeeLine).join('; ')}
              </>
            )}
          </dd>
        </div>
      </dl>
      {c.note && <p class="small">Note: {c.note}</p>}
      {!fromGuest && <p class="meta">Waiting for the guest to accept.</p>}
      {fromGuest && !admin && (
        <p class="meta">Gabriel or Micala will answer this.</p>
      )}
      {declining && (
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
              variant="danger"
              size="sm"
              busy={act.busy}
              onClick={() => respond(false)}
            >
              Decline change
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeclining(false)}
            >
              Back
            </Button>
          </div>
        </div>
      )}
      <ErrorText error={act.error} />
    </Card>
  )
}

function MealCard({ m, onDone }: { m: DashMeal; onDone: () => void }) {
  const act = useAction()
  const [denying, setDenying] = useState(false)
  const [note, setNote] = useState('')

  async function decide(approve: boolean) {
    const r = await act.run(
      () =>
        call('family_decide_meal', {
          p_meal: m.id,
          p_approve: approve,
          p_note: approve ? null : note,
        }),
      approve
        ? 'Meal approved. They were emailed.'
        : 'Sign-up denied. They were emailed.',
    )
    if (r !== undefined) onDone()
  }

  return (
    <Card
      title={m.name}
      pills={
        <StatusPill
          status={m.status}
          label={m.status === 'draft' ? 'Not confirmed yet' : undefined}
        />
      }
      actions={
        denying ? null : (
          <>
            {m.status === 'submitted' && (
              <Button
                variant="primary"
                size="sm"
                busy={act.busy}
                onClick={() => decide(true)}
              >
                Approve
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              disabled={act.busy}
              onClick={() => setDenying(true)}
            >
              Deny
            </Button>
          </>
        )
      }
    >
      <p class="small">
        <strong>{m.label}</strong>, {fmtDay(m.date)} at {fmtTime(m.start)}
      </p>
      {m.dish ? (
        <p class="small">Bringing: {m.dish}</p>
      ) : (
        <p class="small fam-missing">Hasn’t said what they’ll bring yet.</p>
      )}
      {denying && (
        <div class="fam-inline-form stack">
          <Field
            label="Note to them"
            optional
            hint="For example, another slot that’s open."
          >
            <TextArea
              value={note}
              onInput={e => setNote(e.currentTarget.value)}
              maxLength={1000}
            />
          </Field>
          <div class="actions">
            <Button
              variant="danger"
              size="sm"
              busy={act.busy}
              onClick={() => decide(false)}
            >
              Send denial
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDenying(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
      <ErrorText error={act.error} />
    </Card>
  )
}

function ReplyCard({
  r,
  me,
  onDone,
}: {
  r: DashReply
  me: string
  onDone: () => void
}) {
  const act = useAction()
  const approvals = r.approvals.filter(p => p !== r.drafted_by)
  const mine = r.drafted_by === me
  const approved = approvals.includes(me)

  async function approve() {
    const out = await act.run(() =>
      call<{ sent: boolean }>('approve_offer_reply', { p_reply: r.id }),
    )
    if (!out) return
    toast(out.sent ? 'Approved and sent' : 'Approved. One more needed.')
    onDone()
  }

  return (
    <Card
      title={`Reply to ${r.name}`}
      pills={
        <span class="pill pill-orange">{approvals.length} of 2 approvals</span>
      }
      actions={
        <>
          {!mine && !approved && (
            <Button
              variant="primary"
              size="sm"
              busy={act.busy}
              onClick={approve}
            >
              Approve
            </Button>
          )}
          <a
            class="btn btn-ghost btn-sm"
            href={site(`family/offers/?id=${r.offer_id}`)}
          >
            Open offer
          </a>
        </>
      }
    >
      <p class="small fam-clamp">{r.body}</p>
      <p class="meta">
        Drafted by {personName(r.drafted_by)} {timeAgo(r.created_at)}
        {approvals.length > 0 && `. Approved by ${names(approvals)}`}
      </p>
      {mine && <p class="meta">Your draft. Two others need to approve it.</p>}
      <ErrorText error={act.error} />
    </Card>
  )
}

function NoteCard({
  n,
  admin,
  onDone,
}: {
  n: DashNote
  admin: boolean
  onDone: () => void
}) {
  const act = useAction()
  async function decide(decision: 'publish' | 'hold') {
    const r = await act.run(
      () => call('family_decide_note', { p_note: n.id, p_decision: decision }),
      decision === 'publish' ? 'Published' : 'Held. It stays private.',
    )
    if (r !== undefined) onDone()
  }
  return (
    <Card
      title={`From ${n.name}`}
      pills={
        n.photos.length > 0 ? (
          <span class="pill pill-muted">
            {n.photos.length} {n.photos.length === 1 ? 'photo' : 'photos'}
          </span>
        ) : null
      }
      actions={
        <>
          {admin && (
            <>
              <Button
                variant="primary"
                size="sm"
                busy={act.busy}
                onClick={() => decide('publish')}
              >
                Publish
              </Button>
              <Button
                size="sm"
                disabled={act.busy}
                onClick={() => decide('hold')}
              >
                Hold
              </Button>
            </>
          )}
          <a class="btn btn-ghost btn-sm" href={site('family/notes/')}>
            Read
          </a>
        </>
      }
    >
      <p class="small fam-clamp">{n.body}</p>
      <p class="meta">Sent {timeAgo(n.created_at)}</p>
      <ErrorText error={act.error} />
    </Card>
  )
}

function HelpCard({
  h,
  me,
  onDone,
}: {
  h: DashHelp
  me: string
  onDone: () => void
}) {
  const act = useAction()
  async function run(fn: 'claim_help' | 'unclaim_help') {
    const r = await act.run(
      () => call(fn, { p_entry: h.id }),
      fn === 'claim_help' ? 'You’re taking care of it' : 'Unclaimed',
    )
    if (r !== undefined) onDone()
  }
  return (
    <Card
      title={<a href={site(`family/schedule/?id=${h.id}`)}>{h.title}</a>}
      pills={
        h.claimed_by ? (
          <span class="pill pill-blue">
            Claimed by {h.claimed_by === me ? 'you' : personName(h.claimed_by)}
          </span>
        ) : (
          <span class="pill pill-orange">Help needed</span>
        )
      }
      actions={
        !h.claimed_by ? (
          <Button
            variant="primary"
            size="sm"
            busy={act.busy}
            onClick={() => run('claim_help')}
          >
            I’ll take it
          </Button>
        ) : h.claimed_by === me ? (
          <Button size="sm" busy={act.busy} onClick={() => run('unclaim_help')}>
            Unclaim
          </Button>
        ) : null
      }
    >
      <p class="small">
        {fmtDate(h.starts_at)} at {fmtTime(h.starts_at)}
      </p>
      {h.help_description && <p class="small">{h.help_description}</p>}
      <ErrorText error={act.error} />
    </Card>
  )
}

function WeekCard({ week }: { week: Dash['week'] }) {
  const pct = Math.min(
    100,
    Math.round((week.count / Math.max(week.cap, 1)) * 100),
  )
  const full = week.count >= week.cap
  return (
    <article class="card fam-card" aria-labelledby="week-h">
      <h3 class="card-title" id="week-h">
        This week’s visitors
      </h3>
      <p class="fam-big">
        {week.count} <span class="muted">of {week.cap}</span>
      </p>
      <div class={`fam-meter${full ? ' full' : ''}`} aria-hidden="true">
        <span style={`width:${pct}%`} />
      </div>
      <p class="meta">
        Unique people with an approved booking, week of {fmtDay(week.start)}{' '}
        (Sunday to Saturday).
        {full && ' The week is full to new visitors.'}
      </p>
    </article>
  )
}

function PauseCard({
  d,
  me,
  admin,
  onDone,
}: {
  d: Dash
  me: string
  admin: boolean
  onDone: () => void
}) {
  const act = useAction()
  const pr = d.pause_request
  const mine = pr?.requested_by === me

  async function request() {
    const r = await act.run(() =>
      call<{ paused: boolean; waiting?: boolean }>('request_pause'),
    )
    if (!r) return
    toast(
      r.paused
        ? 'All bookings are paused'
        : 'Asked. Waiting for a second person.',
    )
    onDone()
  }
  async function end() {
    const r = await act.run(() => call('end_pause'), 'Bookings are open again')
    if (r !== undefined) onDone()
  }

  return (
    <article
      class={`card fam-card${d.paused ? ' fam-paused' : ''}`}
      aria-labelledby="pause-h"
    >
      <h3 class="card-title" id="pause-h">
        Site-wide pause
      </h3>
      {d.paused ? (
        <>
          <p class="fam-big">On</p>
          <p class="small">
            Every open time is red and no new requests are accepted. Approved
            bookings stay.
          </p>
          {admin ? (
            <div class="actions">
              <Button variant="primary" size="sm" busy={act.busy} onClick={end}>
                Turn off pause
              </Button>
            </div>
          ) : (
            <p class="meta">Gabriel or Micala can turn it off.</p>
          )}
        </>
      ) : (
        <>
          <p class="fam-big">Off</p>
          {pr && mine ? (
            <Notice tone="warn">
              You asked to pause all bookings {timeAgo(pr.requested_at)}.
              Waiting for a second person.
            </Notice>
          ) : pr ? (
            <>
              <Notice tone="warn">
                {personName(pr.requested_by)} asked to pause all bookings{' '}
                {timeAgo(pr.requested_at)}.
              </Notice>
              <div class="actions">
                <Button
                  variant="primary"
                  size="sm"
                  busy={act.busy}
                  onClick={request}
                >
                  Confirm pause
                </Button>
              </div>
            </>
          ) : (
            <>
              <p class="small">
                Turns every open time red and stops new requests. A second
                person needs to confirm.
              </p>
              <div class="actions">
                <Button size="sm" busy={act.busy} onClick={request}>
                  Ask to pause all bookings
                </Button>
              </div>
            </>
          )}
        </>
      )}
      <ErrorText error={act.error} />
    </article>
  )
}

import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { rpc } from '@/lib/supabase'
import { fmtDate, fmtDateTime, fmtRange, fmtTime } from '@/lib/time'
import {
  Button,
  Check,
  ErrorText,
  Field,
  Loading,
  Modal,
  Notice,
  PageHead,
  StatusPill,
  site,
  TextArea,
  toast,
  useAction,
  useAsync,
  useQueryParam,
} from '@/lib/ui'
import {
  AttendeeEditor,
  attendeesComplete,
  cleanAttendees,
  PeopleList,
  Steps,
  useCompanions,
} from './parts'
import { Questions } from './questions'
import { RulesFlow } from './rules-flow'
import { TimePicker } from './time-picker'
import { type Limits, resolve, timesOf } from './times'
import {
  type Attendee,
  firstName,
  isTrip,
  loadVisitSettings,
  type VisitRequest,
  type VisitSettings,
} from './types'

/** "a stay at the house" → "stay at the house", for "your …" sentences. */
const bare = (s: string) => s.replace(/^(a|an|your) /i, '')

const again = (typeId: number) => `${site('visits/')}?type=${typeId}`

/** The guest's private request page (`/visits/request/?t=…`): steps 4–6, then status and changes. */
export function VisitRequestPage() {
  const token = useQueryParam('t')
  if (!token) {
    return (
      <Notice title="This page needs your private link">
        <p>
          Open the link from your email to see your request, or{' '}
          <a href={site('visits/')}>book a visit</a>.
        </p>
      </Notice>
    )
  }
  return <RequestLoader token={token} />
}

function RequestLoader({ token }: { token: string }) {
  const req = useAsync(
    () => rpc<VisitRequest>('get_visit_request', { p_token: token }),
    [token],
  )
  const settings = useAsync(loadVisitSettings)
  if ((req.loading && !req.data) || settings.loading) return <Loading />
  if (req.error && !req.data) return <ErrorText error={req.error} />
  if (settings.error) return <ErrorText error={settings.error} />
  if (!req.data || !settings.data) return null
  return (
    <RequestView req={req.data} settings={settings.data} reload={req.reload} />
  )
}

function RequestView({
  req,
  settings,
  reload,
}: {
  req: VisitRequest
  settings: VisitSettings
  reload: () => Promise<void>
}) {
  const t = req.type
  const trip = isTrip(t)
  const doParam = useQueryParam('do')
  const skipped = useQueryParam('skipped') === '1'
  const open =
    req.status === 'draft' ||
    req.status === 'submitted' ||
    req.status === 'approved'
  const [modal, setModal] = useState<'cancel' | 'shorten' | 'change' | null>(
    () => (doParam === 'cancel' && open ? 'cancel' : null),
  )

  const pillLabel =
    trip && req.status === 'approved'
      ? 'Acknowledged'
      : trip && req.status === 'submitted'
        ? 'Waiting to be acknowledged'
        : undefined

  const done = async () => {
    setModal(null)
    await reload()
  }

  return (
    <div class="vreq">
      <PageHead eyebrow="Your request" title={t.name}>
        <p class="vreq-status">
          <StatusPill status={req.status} label={pillLabel} />
          {req.status === 'approved' && req.rules_reagree_needed && (
            <span class="pill pill-yellow">Rules to re-agree</span>
          )}
        </p>
      </PageHead>

      <Summary req={req} />

      {req.status === 'draft' && (
        <DraftFlow
          req={req}
          settings={settings}
          reload={reload}
          skipped={skipped}
        />
      )}

      {req.status === 'approved' && req.rules_reagree_needed && (
        <section class="card stack">
          <h2 class="h3">The house rules were updated</h2>
          <p>
            Before your {bare(t.short_name)} on {fmtDate(req.starts_at)}, please
            read and agree to the updated rules, one at a time.
          </p>
          <RulesFlow
            token={req.token}
            rules={req.rules}
            updatedAt={settings.rulesUpdatedAt}
            fresh
            onDone={async () => {
              toast('Thank you for agreeing to the updated rules')
              await reload()
            }}
            doneLabel="Done"
          />
        </section>
      )}

      {doParam === 'healthy' &&
        (req.status === 'approved' || req.status === 'submitted') && (
          <HealthCheck
            req={req}
            reload={reload}
            onSick={() => setModal('cancel')}
          />
        )}

      {(req.status === 'submitted' || req.status === 'approved') && (
        <NextSteps req={req} />
      )}
      {(req.status === 'submitted' || req.status === 'approved') && (
        <PendingChange req={req} reload={reload} />
      )}

      {req.status === 'denied' && (
        <section class="card stack">
          <h2 class="h3">Not this time</h2>
          <p>
            Thank you for asking, {firstName(req.name)}. Micala and Gabriel
            can’t do {fmtDate(req.starts_at)} at {fmtTime(req.starts_at)}.
          </p>
          {req.decision_note && (
            <blockquote class="vnote">
              <span class="meta">Their note</span>
              <p>{req.decision_note}</p>
            </blockquote>
          )}
          <p>You’re welcome to request another time.</p>
          <div class="actions">
            <a class="btn btn-primary" href={again(t.id)}>
              Request another time
            </a>
          </div>
        </section>
      )}

      {req.status === 'expired' && (
        <section class="card stack">
          <h2 class="h3">This request expired</h2>
          <p>
            Your unfinished request for {t.short_name} on{' '}
            {fmtDate(req.starts_at)} at {fmtTime(req.starts_at)} has expired,
            and the time was released. You’re welcome to request again anytime.
          </p>
          <div class="actions">
            <a class="btn btn-primary" href={again(t.id)}>
              Request again
            </a>
          </div>
        </section>
      )}

      {req.status === 'cancelled' && (
        <section class="card stack">
          <h2 class="h3">This booking was cancelled</h2>
          <p>
            Your {bare(t.short_name)} on {fmtDate(req.starts_at)} at{' '}
            {fmtTime(req.starts_at)} was cancelled.
          </p>
          {req.cancel_note && (
            <blockquote class="vnote">
              <span class="meta">Note</span>
              <p>{req.cancel_note}</p>
            </blockquote>
          )}
          <div class="actions">
            <a class="btn btn-primary" href={again(t.id)}>
              Request another time
            </a>
          </div>
        </section>
      )}

      {open && (
        <section class="card stack vreq-manage">
          <h2 class="h3">
            {req.status === 'draft'
              ? 'Changed your mind?'
              : 'Need to change something?'}
          </h2>
          {req.status === 'draft' ? (
            <p class="muted small">
              You can cancel this request at any time. The time is released
              right away.
            </p>
          ) : (
            <p class="muted small">
              Cancelling or shortening happens right away. A different time, a
              longer {trip ? 'trip' : 'booking'}, or more people is a proposed
              change: your booking stands as it is until Micala or Gabriel
              approve it.
            </p>
          )}
          <div class="actions">
            {req.status !== 'draft' && (
              <>
                <Button
                  onClick={() => setModal('change')}
                  disabled={!!req.pending_change}
                >
                  Propose a change
                </Button>
                <Button onClick={() => setModal('shorten')}>Shorten</Button>
              </>
            )}
            <Button variant="danger" onClick={() => setModal('cancel')}>
              {req.status === 'draft' ? 'Cancel this request' : 'Cancel'}
            </Button>
          </div>
          {req.pending_change && (
            <p class="meta">
              You can propose another change once the one waiting has an answer.
            </p>
          )}
        </section>
      )}

      <Modal
        open={modal === 'cancel'}
        onClose={() => setModal(null)}
        title={
          req.status === 'draft' ? 'Cancel this request' : 'Cancel this booking'
        }
      >
        <CancelForm req={req} onDone={done} />
      </Modal>
      <Modal
        open={modal === 'shorten'}
        onClose={() => setModal(null)}
        title="Shorten this booking"
        wide
      >
        <ShortenForm req={req} settings={settings} onDone={done} />
      </Modal>
      <Modal
        open={modal === 'change'}
        onClose={() => setModal(null)}
        title="Propose a change"
        wide
      >
        <ChangeForm req={req} settings={settings} onDone={done} />
      </Modal>
    </div>
  )
}

// ------------------------------------------------------------------ summary

function Summary({ req }: { req: VisitRequest }) {
  const t = req.type
  const people = req.attendees.length
  return (
    <section class="card vsum">
      <dl class="vsum-grid">
        <div>
          <dt>{t.start_label}</dt>
          <dd>{fmtDateTime(req.starts_at)}</dd>
        </div>
        <div>
          <dt>{t.end_label}</dt>
          <dd>{fmtDateTime(req.ends_at)}</dd>
        </div>
        <div>
          <dt>People</dt>
          <dd>
            {people
              ? `${people} ${people === 1 ? 'person' : 'people'}`
              : 'Not listed yet'}
          </dd>
        </div>
        <div>
          <dt>Requested by</dt>
          <dd>{req.name}</dd>
        </div>
      </dl>
      {people > 0 && (
        <details class="vsum-people">
          <summary>Who’s coming</summary>
          <PeopleList people={req.attendees} />
        </details>
      )}
    </section>
  )
}

// ------------------------------------------------------------- steps 4 to 6

function DraftFlow({
  req,
  settings,
  reload,
  skipped,
}: {
  req: VisitRequest
  settings: VisitSettings
  reload: () => Promise<void>
  skipped: boolean
}) {
  const initial = !req.rules_complete
    ? 'rules'
    : !req.answers_complete
      ? 'questions'
      : 'review'
  const [step, setStep] = useState<'rules' | 'questions' | 'review'>(initial)
  const submit = useAction()
  const hasLabels = req.rules.some(r => r.label)
  const n = step === 'rules' ? 4 : step === 'questions' ? 5 : 6

  const go = async (next: typeof step) => {
    await reload()
    setStep(next)
    requestAnimationFrame(() =>
      document
        .getElementById('v-draft')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  async function send() {
    const r = await submit.run(() =>
      rpc<{ status: string }>('submit_visit_request', { p_token: req.token }),
    )
    if (r) {
      await reload()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <section class="card stack" id="v-draft">
      <Steps current={n} />
      <Notice tone="warn">
        Your request is saved but not finished yet. Nothing is approved until
        you agree to each house rule and answer the questions.
      </Notice>

      {step === 'rules' && (
        <>
          <h2 class="h3 vstep-h">
            <span class="vstep-n">4</span> Agree to each house rule
          </h2>
          <p class="muted small">
            {hasLabels
              ? 'Some rules are new or updated since you last agreed, so please agree to every rule again, one at a time.'
              : 'Please read each rule and check “Yes, I agree.” Every rule has its own box, including a final confirmation for your group.'}
          </p>
          <RulesFlow
            token={req.token}
            rules={req.rules}
            updatedAt={settings.rulesUpdatedAt}
            fresh={hasLabels}
            onDone={() => go(req.answers_complete ? 'review' : 'questions')}
            doneLabel={
              req.answers_complete ? 'Continue' : 'Continue to questions'
            }
          />
        </>
      )}

      {step === 'questions' && (
        <>
          <h2 class="h3 vstep-h">
            <span class="vstep-n">5</span> A few questions
          </h2>
          {skipped && (
            <Notice tone="success">
              You agreed to the house rules within the last 15 days, so you can
              skip that step. Booking details are still needed every time.
            </Notice>
          )}
          <Questions req={req} onSaved={() => go('review')} />
        </>
      )}

      {step === 'review' && (
        <>
          <h2 class="h3 vstep-h">
            <span class="vstep-n">6</span> Review and send
          </h2>
          <Review req={req} />
          <div class="actions">
            <Button onClick={() => setStep('questions')}>Edit answers</Button>
          </div>
          <ErrorText error={submit.error} />
          <div class="actions">
            <Button
              variant="primary"
              busy={submit.busy}
              onClick={send}
              disabled={!req.rules_complete || !req.answers_complete}
            >
              Send my request
            </Button>
            <span class="meta">Micala or Gabriel will review it.</span>
          </div>
          {!req.rules_complete && (
            <p class="ff-error">
              A rule still needs your agreement.{' '}
              <button
                type="button"
                class="linklike"
                onClick={() => setStep('rules')}
              >
                Go to the rules
              </button>
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Review({ req }: { req: VisitRequest }) {
  const t = req.type
  const rows: [string, ComponentChildren][] = [
    ['When', fmtRange(req.starts_at, req.ends_at)],
    ['Who’s coming', <PeopleList people={req.attendees} key="p" />],
    ['Bringing', req.answers.bring],
    ...t.questions
      .filter(q => req.answers[q.key])
      .map(q => [q.label, req.answers[q.key]] as [string, ComponentChildren]),
    ...(req.answers.notes
      ? [['Anything else', req.answers.notes] as [string, ComponentChildren]]
      : []),
  ]
  return (
    <dl class="vreview">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
      <div>
        <dt>House rules</dt>
        <dd>{req.rules_complete ? 'Agreed to every rule' : 'Not finished'}</dd>
      </div>
    </dl>
  )
}

// --------------------------------------------------------------- next steps

function NextSteps({ req }: { req: VisitRequest }) {
  const t = req.type
  const first = firstName(req.name)
  const date = fmtDate(req.starts_at)
  const time = fmtTime(req.starts_at)

  if (req.status === 'submitted') {
    return (
      <section class="card stack vnext">
        <h2 class="h3">What happens next</h2>
        <p>
          Thank you, {first}! Your request for {t.short_name} on {date} at{' '}
          {time} is in. Micala or Gabriel will review it, so please don’t plan
          on it until you get a confirmation.
        </p>
        <ol class="vnext-list">
          <li>
            Micala or Gabriel review your request. They may{' '}
            {isTrip(t) ? 'acknowledge it' : 'approve it'} or suggest another
            time.
          </li>
          <li>We’ll email you as soon as there’s an answer.</li>
          <li>
            Once {isTrip(t) ? 'acknowledged' : 'approved'}, the family will
            share the address with you personally. It’s never on this site.
          </li>
        </ol>
        {isTrip(t) && (
          <p class="muted small">
            In-home visits during your trip are requested and approved
            separately.
          </p>
        )}
      </section>
    )
  }

  if (isTrip(t)) {
    return (
      <section class="card stack vnext">
        <h2 class="h3">Your trip is acknowledged</h2>
        <p>
          Thank you, {first}! Micala and Gabriel have seen your Colorado trip
          plans for {fmtDate(req.starts_at)} – {fmtDate(req.ends_at)}. Any
          in-home visits during your trip still need to be requested and
          approved separately.
        </p>
        <div class="actions">
          <a class="btn btn-primary" href={`${site('visits/')}?type=2`}>
            Request an in-home visit
          </a>
        </div>
      </section>
    )
  }

  return (
    <section class="card stack vnext">
      <h2 class="h3">You’re approved</h2>
      <p>
        Good news, {first}! You’re approved for {t.short_name} on {date} at{' '}
        {time}. Reminders will follow, and please review the{' '}
        <a href={site('rules/')}>house rules</a> again before you come. The
        family will share the address with you personally.
      </p>
      {req.healthy_at && (
        <p class="meta">
          You confirmed everyone is healthy on {fmtDateTime(req.healthy_at)}.
          Thank you!
        </p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- healthy

function HealthCheck({
  req,
  reload,
  onSick,
}: {
  req: VisitRequest
  reload: () => Promise<void>
  onSick: () => void
}) {
  const act = useAction()
  const [done, setDone] = useState(false)
  if (done || req.healthy_at) {
    return (
      <Notice tone="success" title="Thank you for confirming">
        <p>Everyone is healthy. See you soon!</p>
      </Notice>
    )
  }
  return (
    <section class="card stack vhealth">
      <h2 class="h3">Is everyone healthy?</h2>
      <p>
        Please check that no one in your group has had a fever, diarrhea,
        vomiting, rashes, or persistent coughing or sneezing in the last 72
        hours, and no one is sick, even with a cold.
      </p>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button
          variant="primary"
          busy={act.busy}
          onClick={async () => {
            const ok = await act.run(async () => {
              await rpc('confirm_healthy', { p_token: req.token })
              return true
            })
            if (ok) {
              setDone(true)
              await reload()
            }
          }}
        >
          Yes, everyone is healthy
        </Button>
        <Button variant="danger" onClick={onSick}>
          Someone is sick
        </Button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------- pending change

function PendingChange({
  req,
  reload,
}: {
  req: VisitRequest
  reload: () => Promise<void>
}) {
  const c = req.pending_change
  const act = useAction()
  if (!c) return null
  const fromFamily = c.proposed_by === 'family'

  const respond = async (accept: boolean) => {
    const ok = await act.run(
      async () => {
        await rpc('respond_visit_change', {
          p_token: req.token,
          p_accept: accept,
        })
        return true
      },
      accept ? 'Change accepted' : 'Change declined',
    )
    if (ok) await reload()
  }

  return (
    <section class={`card stack vchange${fromFamily ? ' is-family' : ''}`}>
      <h2 class="h3">
        {fromFamily
          ? 'Micala and Gabriel proposed a change'
          : 'Your proposed change is waiting'}
      </h2>
      <dl class="vreview">
        <div>
          <dt>Now</dt>
          <dd>{fmtRange(req.starts_at, req.ends_at)}</dd>
        </div>
        <div>
          <dt>Proposed</dt>
          <dd>
            {fmtRange(c.starts_at, c.ends_at)}
            {c.attendees &&
              `, ${c.attendees.length} ${c.attendees.length === 1 ? 'person' : 'people'}`}
          </dd>
        </div>
        {c.attendees && (
          <div>
            <dt>People</dt>
            <dd>
              <PeopleList people={c.attendees} />
            </dd>
          </div>
        )}
        {c.note && (
          <div>
            <dt>Note</dt>
            <dd>{c.note}</dd>
          </div>
        )}
      </dl>
      {fromFamily ? (
        <>
          <p class="muted small">
            Your original booking stands until you accept.
          </p>
          <ErrorText error={act.error} />
          <div class="actions">
            <Button
              variant="primary"
              busy={act.busy}
              onClick={() => respond(true)}
            >
              Accept the change
            </Button>
            <Button busy={act.busy} onClick={() => respond(false)}>
              Decline
            </Button>
          </div>
        </>
      ) : (
        <p class="muted small">
          Your booking stands as it is until Micala or Gabriel approve the
          change. We’ll email you.
        </p>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ forms

function CancelForm({
  req,
  onDone,
}: {
  req: VisitRequest
  onDone: () => void
}) {
  const [note, setNote] = useState('')
  const act = useAction()
  async function submit(e: Event) {
    e.preventDefault()
    const ok = await act.run(async () => {
      await rpc('cancel_visit', {
        p_token: req.token,
        p_note: note.trim() || null,
      })
      return true
    }, 'Cancelled. Thank you for letting us know!')
    if (ok) onDone()
  }
  return (
    <form class="stack" onSubmit={submit}>
      <p>
        {req.type.name}, {fmtRange(req.starts_at, req.ends_at)}. The time is
        released right away, and the family is notified.
      </p>
      <Field label="Note for the family" optional>
        <TextArea
          value={note}
          onInput={(e: Event) =>
            setNote((e.currentTarget as HTMLTextAreaElement).value)
          }
          maxLength={1000}
        />
      </Field>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button type="submit" variant="danger" busy={act.busy}>
          {req.status === 'draft' ? 'Cancel this request' : 'Cancel my booking'}
        </Button>
      </div>
    </form>
  )
}

function ShortenForm({
  req,
  settings,
  onDone,
}: {
  req: VisitRequest
  settings: VisitSettings
  onDone: () => void
}) {
  const [times, setTimes] = useState(() => timesOf(req.starts_at, req.ends_at))
  const [note, setNote] = useState('')
  const act = useAction()
  const limits: Limits = {
    hours: settings.hours,
    inside: { from: new Date(req.starts_at), to: new Date(req.ends_at) },
  }
  const picked = resolve(req.type, limits, times)
  const same =
    picked &&
    picked.start.getTime() === new Date(req.starts_at).getTime() &&
    picked.end.getTime() === new Date(req.ends_at).getTime()

  async function submit(e: Event) {
    e.preventDefault()
    if (!picked || same) return
    const ok = await act.run(async () => {
      await rpc('shorten_visit', {
        p_token: req.token,
        p_starts_at: picked.start.toISOString(),
        p_ends_at: picked.end.toISOString(),
        p_note: note.trim() || null,
      })
      return true
    }, 'Your booking was shortened')
    if (ok) onDone()
  }

  return (
    <form class="stack" onSubmit={submit}>
      <p class="muted small">
        Pick new times inside your current ones (
        {fmtRange(req.starts_at, req.ends_at)}). No approval needed.
      </p>
      <TimePicker
        type={req.type}
        limits={limits}
        value={times}
        onChange={setTimes}
      />
      <Field label="Note for the family" optional>
        <TextArea
          value={note}
          onInput={(e: Event) =>
            setNote((e.currentTarget as HTMLTextAreaElement).value)
          }
          maxLength={1000}
        />
      </Field>
      {same && <p class="ff-hint">Pick a shorter time to continue.</p>}
      <ErrorText error={act.error} />
      <div class="actions">
        <Button
          type="submit"
          variant="primary"
          busy={act.busy}
          disabled={!picked || !!same}
        >
          Shorten my booking
        </Button>
      </div>
    </form>
  )
}

function ChangeForm({
  req,
  settings,
  onDone,
}: {
  req: VisitRequest
  settings: VisitSettings
  onDone: () => void
}) {
  const companions = useCompanions()
  const [times, setTimes] = useState(() => timesOf(req.starts_at, req.ends_at))
  const [changePeople, setChangePeople] = useState(false)
  const [people, setPeople] = useState<Attendee[]>(() =>
    req.attendees.map(a => ({
      name: a.name,
      age: a.age ?? '',
      relationship: a.relationship ?? '',
    })),
  )
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const act = useAction()
  const limits: Limits = {
    hours: settings.hours,
    minStart: new Date(Date.now() + settings.cutoffHours * 3_600_000),
    keepStart: req.starts_at,
  }
  const picked = resolve(req.type, limits, times)
  const sameTimes =
    !!picked &&
    picked.start.getTime() === new Date(req.starts_at).getTime() &&
    picked.end.getTime() === new Date(req.ends_at).getTime()
  const clean = cleanAttendees(people)
  const peopleOk =
    !changePeople ||
    (attendeesComplete(clean) && clean.length <= req.max_people)
  const samePeople =
    clean.length === req.attendees.length &&
    clean.every((p, i) => {
      const a = req.attendees[i]
      return (
        p.name.trim() === a.name.trim() &&
        String(p.age ?? '') === String(a.age ?? '') &&
        (p.relationship ?? '').trim() === (a.relationship ?? '').trim()
      )
    })
  const nothing = sameTimes && (!changePeople || samePeople)

  async function submit(e: Event) {
    e.preventDefault()
    setTried(true)
    if (!picked || nothing || !peopleOk) return
    const ok = await act.run(async () => {
      await rpc('propose_visit_change', {
        p_token: req.token,
        p_starts_at: picked.start.toISOString(),
        p_ends_at: picked.end.toISOString(),
        p_attendees: changePeople ? clean : null,
        p_note: note.trim() || null,
      })
      return true
    }, 'Change sent to Micala and Gabriel')
    if (ok) onDone()
  }

  return (
    <form class="stack" onSubmit={submit}>
      <p class="muted small">
        Your booking stands as it is until Micala or Gabriel approve the change.{' '}
        {req.type.name} can be{' '}
        {req.type.max_minutes != null
          ? `up to ${req.type.length_text.split(';')[0]}`
          : 'as long as you need'}
        ; for longer, please send an additional request.
      </p>
      <TimePicker
        type={req.type}
        limits={limits}
        value={times}
        onChange={setTimes}
      />
      <Check checked={changePeople} onChange={setChangePeople}>
        Change who’s coming
      </Check>
      {changePeople && (
        <AttendeeEditor
          value={people}
          onChange={setPeople}
          max={req.max_people}
          companions={companions}
          showErrors={tried}
        />
      )}
      <Field label="Note for the family" optional>
        <TextArea
          value={note}
          onInput={(e: Event) =>
            setNote((e.currentTarget as HTMLTextAreaElement).value)
          }
          maxLength={1000}
        />
      </Field>
      {tried && nothing && (
        <p class="ff-error">Change the times or who’s coming first.</p>
      )}
      {tried && !peopleOk && (
        <p class="ff-error">
          Please give each person’s full name and relationship to the family.
        </p>
      )}
      <ErrorText error={act.error} />
      <div class="actions">
        <Button
          type="submit"
          variant="primary"
          busy={act.busy}
          disabled={!picked}
        >
          Send the change
        </Button>
      </div>
    </form>
  )
}

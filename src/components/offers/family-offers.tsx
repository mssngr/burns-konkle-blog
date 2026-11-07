import { useEffect, useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import { type FamilyStatus, isAdmin, personName } from '@/lib/auth'
import { query, rpc, supabase } from '@/lib/supabase'
import { fmtDateTime, timeAgo } from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Field,
  Loading,
  StatusPill,
  TextArea,
  toast,
  useAction,
  useAsync,
  useQueryParam,
} from '@/lib/ui'

interface OfferRow {
  id: string
  visitor_id: string
  name: string
  options: string[]
  write_in: string | null
  availability: string | null
  notes: string | null
  created_at: string
}

interface ReplyRow {
  id: string
  offer_id: string
  drafted_by: string
  body: string
  status: 'pending' | 'sent' | 'withdrawn'
  created_at: string
  sent_at: string | null
}

interface ApprovalRow {
  reply_id: string
  person: string
  at: string
}

interface ContactRow {
  visitor_id: string
  email: string
  phone: string | null
}

const NEEDED = 2

/** "mom_supplies" → "Mom supplies", for options an elevated user can't read (inactive). */
const humanize = (key: string) =>
  key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

export function FamilyOffers() {
  return (
    <FamilyGate>{family => <FamilyOffersInner family={family} />}</FamilyGate>
  )
}

function FamilyOffersInner({ family }: { family: FamilyStatus }) {
  const focusId = useQueryParam('id')
  const admin = isAdmin(family)

  const data = useAsync(async () => {
    const [offers, options, replies, approvals, people] = await Promise.all([
      query(
        supabase
          .from('offers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
      ),
      query(supabase.from('offer_options').select('key, label')),
      query(supabase.from('offer_replies').select('*').order('created_at')),
      query(supabase.from('offer_reply_approvals').select('*').order('at')),
      query(supabase.from('family').select('person, display_name')),
    ])
    const list = (offers ?? []) as OfferRow[]
    let contacts: Record<string, ContactRow> = {}
    if (admin && list.length) {
      const ids = [...new Set(list.map(o => o.visitor_id))]
      const cs = await query(
        supabase
          .from('visitor_contacts')
          .select('visitor_id, email, phone')
          .in('visitor_id', ids),
      )
      contacts = Object.fromEntries(
        ((cs ?? []) as ContactRow[]).map(c => [c.visitor_id, c]),
      )
    }
    return {
      offers: list,
      labels: Object.fromEntries(
        ((options ?? []) as { key: string; label: string }[]).map(o => [
          o.key,
          o.label,
        ]),
      ),
      replies: (replies ?? []) as ReplyRow[],
      approvals: (approvals ?? []) as ApprovalRow[],
      names: Object.fromEntries(
        ((people ?? []) as { person: string; display_name: string }[]).map(
          p => [p.person, p.display_name],
        ),
      ),
      contacts,
    }
  }, [admin])

  useEffect(() => {
    if (!focusId || !data.data) return
    document
      .getElementById(`offer-${focusId}`)
      ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focusId, data.data])

  if (data.loading && !data.data) return <Loading />
  if (!data.data) return <ErrorText error={data.error} />
  const d = data.data
  const nameOf = (p: string) => d.names[p] ?? personName(p)
  const waitingOnMe = d.replies.filter(
    r =>
      r.status === 'pending' &&
      r.drafted_by !== family.person &&
      !d.approvals.some(a => a.reply_id === r.id && a.person === family.person),
  ).length

  return (
    <div class="stack">
      <ErrorText error={data.error} />
      {waitingOnMe > 0 && (
        <p class="notice notice-warn">
          {waitingOnMe === 1
            ? 'One drafted reply is'
            : `${waitingOnMe} drafted replies are`}{' '}
          waiting for your approval.
        </p>
      )}
      {d.offers.length === 0 ? (
        <Empty>No offers of help yet.</Empty>
      ) : (
        <ul class="fo-list">
          {d.offers.map(o => (
            <OfferCard
              key={o.id}
              offer={o}
              family={family}
              admin={admin}
              focused={o.id === focusId}
              labels={d.labels}
              contact={d.contacts[o.visitor_id]}
              replies={d.replies.filter(r => r.offer_id === o.id)}
              approvals={d.approvals}
              nameOf={nameOf}
              onChange={data.reload}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function OfferCard(p: {
  offer: OfferRow
  family: FamilyStatus
  admin: boolean
  focused: boolean
  labels: Record<string, string>
  contact?: ContactRow
  replies: ReplyRow[]
  approvals: ApprovalRow[]
  nameOf: (p: string) => string
  onChange: () => void
}) {
  const { offer: o, replies } = p
  const pending = replies.find(r => r.status === 'pending')
  const sent = replies.filter(r => r.status === 'sent')
  const withdrawn = replies.filter(r => r.status === 'withdrawn')
  const [drafting, setDrafting] = useState(
    p.focused && !pending && !sent.length,
  )
  const isNew = !pending && !sent.length

  return (
    <li
      id={`offer-${o.id}`}
      class={`card fo-card${p.focused ? ' is-focused' : ''}`}
    >
      <div class="spread">
        <div>
          <p class="card-title">{o.name}</p>
          <p class="meta">
            {fmtDateTime(o.created_at)} · {timeAgo(o.created_at)}
          </p>
        </div>
        {isNew ? (
          <span class="pill pill-muted">No reply yet</span>
        ) : pending ? (
          <StatusPill status="pending" label="Reply waiting" />
        ) : (
          <StatusPill status="sent" label="Replied" />
        )}
      </div>

      {o.options.length > 0 && (
        <ul class="fo-options">
          {o.options.map(k => (
            <li key={k}>{p.labels[k] ?? humanize(k)}</li>
          ))}
        </ul>
      )}

      <dl class="fo-facts">
        {o.write_in && (
          <>
            <dt>Write-in</dt>
            <dd>{o.write_in}</dd>
          </>
        )}
        {o.availability && (
          <>
            <dt>Days &amp; times</dt>
            <dd>{o.availability}</dd>
          </>
        )}
        {o.notes && (
          <>
            <dt>Notes</dt>
            <dd>{o.notes}</dd>
          </>
        )}
        {p.contact && (
          <>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${p.contact.email}`}>{p.contact.email}</a>
              {p.contact.phone && (
                <>
                  {' · '}
                  <a href={`tel:${p.contact.phone}`}>{p.contact.phone}</a>
                </>
              )}
            </dd>
          </>
        )}
      </dl>

      {sent.map(r => (
        <div class="fo-reply fo-reply-sent" key={r.id}>
          <p class="meta">
            Sent {r.sent_at ? fmtDateTime(r.sent_at) : ''} · drafted by{' '}
            {p.nameOf(r.drafted_by)}
            {approversOf(r, p.approvals).length > 0 &&
              `, approved by ${approversOf(r, p.approvals).map(p.nameOf).join(' and ')}`}
          </p>
          <p class="fo-body">{r.body}</p>
        </div>
      ))}

      {pending && (
        <PendingReply
          reply={pending}
          family={p.family}
          admin={p.admin}
          approvals={p.approvals}
          nameOf={p.nameOf}
          onChange={p.onChange}
        />
      )}

      {withdrawn.length > 0 && (
        <details class="fo-withdrawn">
          <summary class="meta">Withdrawn drafts ({withdrawn.length})</summary>
          {withdrawn.map(r => (
            <div class="fo-reply" key={r.id}>
              <p class="meta">
                By {p.nameOf(r.drafted_by)}, {fmtDateTime(r.created_at)}
              </p>
              <p class="fo-body">{r.body}</p>
            </div>
          ))}
        </details>
      )}

      {drafting ? (
        <DraftForm
          offer={o}
          replacing={!!pending}
          onCancel={() => setDrafting(false)}
          onDone={() => {
            setDrafting(false)
            p.onChange()
          }}
        />
      ) : (
        <div class="actions">
          <Button
            size="sm"
            variant={isNew ? 'primary' : 'secondary'}
            onClick={() => setDrafting(true)}
          >
            {pending
              ? 'Draft a different reply'
              : sent.length
                ? 'Draft another reply'
                : 'Draft a reply'}
          </Button>
        </div>
      )}
    </li>
  )
}

const approversOf = (r: ReplyRow, all: ApprovalRow[]) =>
  all
    .filter(a => a.reply_id === r.id && a.person !== r.drafted_by)
    .map(a => a.person)

function PendingReply({
  reply: r,
  family,
  admin,
  approvals,
  nameOf,
  onChange,
}: {
  reply: ReplyRow
  family: FamilyStatus
  admin: boolean
  approvals: ApprovalRow[]
  nameOf: (p: string) => string
  onChange: () => void
}) {
  const who = approversOf(r, approvals)
  const mine = r.drafted_by === family.person
  const approved = who.includes(family.person)
  const act = useAction()

  async function approve() {
    const out = await act.run(() =>
      rpc<{ sent: boolean }>('approve_offer_reply', { p_reply: r.id }),
    )
    if (out) {
      toast(
        out.sent ? 'Approved and sent.' : 'Approved. One more approval needed.',
      )
      onChange()
    }
  }

  async function withdraw() {
    if (!confirm('Withdraw this draft? It won’t be sent.')) return
    const ok = await act.run(
      () => rpc('withdraw_offer_reply', { p_reply: r.id }).then(() => true),
      'Draft withdrawn.',
    )
    if (ok) onChange()
  }

  return (
    <div class="fo-reply fo-reply-pending">
      <p class="meta">
        Drafted by {mine ? 'you' : nameOf(r.drafted_by)},{' '}
        {timeAgo(r.created_at)} · Approvals: {Math.min(who.length, NEEDED)} of{' '}
        {NEEDED}
        {who.length > 0 && ` (${who.map(nameOf).join(', ')})`}
      </p>
      <p class="fo-body">{r.body}</p>
      <ErrorText error={act.error} />
      <div class="actions">
        {!mine && !approved && (
          <Button size="sm" variant="primary" busy={act.busy} onClick={approve}>
            Approve
          </Button>
        )}
        {mine && (
          <span class="small muted">
            Two of the others need to approve your draft before it’s sent.
          </span>
        )}
        {approved && (
          <span class="small muted">
            You approved this. Waiting for one more.
          </span>
        )}
        {(mine || admin) && (
          <Button size="sm" variant="ghost" busy={act.busy} onClick={withdraw}>
            Withdraw
          </Button>
        )}
      </div>
    </div>
  )
}

function DraftForm({
  offer,
  replacing,
  onCancel,
  onDone,
}: {
  offer: OfferRow
  replacing: boolean
  onCancel: () => void
  onDone: () => void
}) {
  const [body, setBody] = useState('')
  const act = useAction()
  const first = offer.name.trim().split(/\s+/)[0]

  async function submit(e: Event) {
    e.preventDefault()
    const ok = await act.run(
      () =>
        rpc('draft_offer_reply', {
          p_offer: offer.id,
          p_body: body.trim(),
        }).then(() => true),
      'Draft saved. Two of the others need to approve it.',
    )
    if (ok) onDone()
  }

  return (
    <form class="fo-draft stack" onSubmit={submit}>
      <Field
        label={`Your reply to ${first}`}
        hint={`Explain how the offer can best be fulfilled. It arrives as: “A message from the Burns-Konkles about your offer to help: …” Two of the others need to approve it before it’s emailed.`}
      >
        <TextArea
          required
          rows={5}
          maxLength={2000}
          value={body}
          onInput={e => setBody(e.currentTarget.value)}
        />
      </Field>
      {replacing && (
        <p class="small muted">
          This replaces the draft that’s waiting, and its approvals start over.
        </p>
      )}
      <ErrorText error={act.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={act.busy}>
          Save draft for approval
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

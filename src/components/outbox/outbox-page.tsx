// Sent emails: everything in the outbox, newest first.
import { useState } from 'preact/hooks'
import {
  copyText,
  ilikeTerm,
  PAGE,
  useDebounced,
  usePaged,
} from '@/components/activity/paged'
import { FamilyGate } from '@/components/auth/family-gate'
import { personName } from '@/lib/auth'
import { query, supabase } from '@/lib/supabase'
import { fmtDateTime } from '@/lib/time'
import {
  Button,
  Empty,
  ErrorText,
  Field,
  Input,
  Loading,
  Modal,
  Notice,
  Select,
  StatusPill,
  toast,
} from '@/lib/ui'

interface Email {
  id: number
  created_at: string
  template: string
  to_email: string
  to_name: string | null
  to_person: string | null
  subject: string
  body: string
  status: 'queued' | 'sent' | 'failed' | 'logged'
  attempts: number
  sent_at: string | null
  error: string | null
}

const STATUSES: [string, string][] = [
  ['', 'All'],
  ['queued', 'Queued'],
  ['sent', 'Sent'],
  ['logged', 'Not sent (no email key)'],
  ['failed', 'Failed'],
]

const recipient = (m: Email) => {
  const name = m.to_person ? personName(m.to_person) : m.to_name
  return name ? `${name} <${m.to_email}>` : m.to_email
}

const asText = (m: Email) =>
  `To: ${recipient(m)}\nSubject: ${m.subject}\n\n${m.body}`

function CopyButton({ m, size = 'sm' }: { m: Email; size?: 'sm' | 'md' }) {
  return (
    <Button
      size={size}
      onClick={async (e: MouseEvent) => {
        e.stopPropagation()
        await copyText(asText(m))
        toast('Copied')
      }}
    >
      Copy text
    </Button>
  )
}

function Outbox() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const term = useDebounced(ilikeTerm(q))
  const [open, setOpen] = useState<Email | null>(null)

  const { rows, loading, loadingMore, more, error, loadMore } = usePaged<Email>(
    before => {
      let r = supabase
        .from('outbox')
        .select('*')
        .order('id', { ascending: false })
        .limit(PAGE)
      if (before != null) r = r.lt('id', before)
      if (status) r = r.eq('status', status)
      if (term)
        r = r.or(
          `to_email.ilike.*${term}*,to_name.ilike.*${term}*,subject.ilike.*${term}*`,
        )
      return query<Email[]>(r)
    },
    `${status}|${term}`,
  )

  return (
    <div class="stack">
      <Notice>
        <p>
          <strong>Not sent (no email key)</strong> means no Resend API key is
          set up yet, so the email was saved here but not delivered. Use{' '}
          <strong>Copy text</strong> to send it yourself.
        </p>
      </Notice>

      <div class="log-filters">
        <Field label="Search">
          <Input
            type="search"
            placeholder="Recipient or subject"
            value={q}
            onInput={(e: Event) =>
              setQ((e.currentTarget as HTMLInputElement).value)
            }
          />
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onChange={(e: Event) =>
              setStatus((e.currentTarget as HTMLSelectElement).value)
            }
          >
            {STATUSES.map(([v, label]) => (
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
        <Empty>{term || status ? 'No emails match.' : 'No emails yet.'}</Empty>
      ) : (
        <ul class="log-list" aria-label="Emails">
          {rows.map(m => (
            <li key={m.id} class="log-item">
              <button
                type="button"
                class="log-row"
                onClick={() => setOpen(m)}
                aria-haspopup="dialog"
              >
                <span class="log-main">
                  <span class="log-title">{m.subject}</span>
                  <span class="meta log-sub">To {recipient(m)}</span>
                </span>
                <span class="log-side">
                  <StatusPill status={m.status} />
                  <span class="meta">{fmtDateTime(m.created_at)}</span>
                </span>
              </button>
              {m.status === 'failed' && m.error && (
                <p class="log-error small">{m.error}</p>
              )}
              {(m.status === 'logged' || m.status === 'failed') && (
                <div class="log-actions">
                  <CopyButton m={m} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {more && !loading && (
        <div class="actions">
          <Button busy={loadingMore} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.subject ?? ''}
        wide
      >
        {open && (
          <div class="stack">
            <dl class="kv">
              <dt>To</dt>
              <dd>{recipient(open)}</dd>
              <dt>Status</dt>
              <dd class="row">
                <StatusPill status={open.status} />
                {open.sent_at && (
                  <span class="meta">Sent {fmtDateTime(open.sent_at)}</span>
                )}
                {open.attempts > 1 && (
                  <span class="meta">{open.attempts} tries</span>
                )}
              </dd>
              <dt>Created</dt>
              <dd>{fmtDateTime(open.created_at)}</dd>
              <dt>Message</dt>
              <dd>
                <code>{open.template}</code>
              </dd>
            </dl>
            {open.status === 'failed' && open.error && (
              <Notice tone="error" title="Couldn’t send">
                {open.error}
              </Notice>
            )}
            {open.status === 'logged' && (
              <Notice tone="warn">
                Not delivered: no Resend API key is set up yet. Copy the text to
                send it yourself.
              </Notice>
            )}
            <div class="mail-body">{open.body}</div>
            <div class="actions">
              <CopyButton m={open} size="md" />
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function OutboxApp() {
  return <FamilyGate admin>{() => <Outbox />}</FamilyGate>
}

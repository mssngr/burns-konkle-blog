import { useEffect, useState } from 'preact/hooks'
import { type FamilyStatus, reloadAuth } from '@/lib/auth'
import { AppError, query, rpc, supabase } from '@/lib/supabase'
import { fmtDate } from '@/lib/time'
import {
  Button,
  ErrorText,
  Field,
  Input,
  Loading,
  Modal,
  Notice,
  useAction,
  useAsync,
} from '@/lib/ui'
import { updateRow } from './db'
import { Section } from './fields'

interface Member {
  person: string
  display_name: string
  role: 'admin' | 'elevated'
  email: string | null
}

const ORDER = ['gabriel', 'micala', 'vincent', 'samantha']
const ROLE = { admin: 'Admin', elevated: 'Family helper' }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function MemberRow({
  saved,
  me,
  onSaved,
}: {
  saved: Member
  me: FamilyStatus
  onSaved: (m: Member) => void
}) {
  const [name, setName] = useState(saved.display_name)
  const [email, setEmail] = useState(saved.email ?? '')
  const [confirming, setConfirming] = useState(false)
  const save = useAction()
  useEffect(() => {
    setName(saved.display_name)
    setEmail(saved.email ?? '')
  }, [saved])

  const cleanEmail = email.trim().toLowerCase() || null
  const emailChanged = (cleanEmail ?? '') !== (saved.email ?? '')
  const dirty = name.trim() !== saved.display_name || emailChanged
  const isMe = saved.person === me.person

  const write = () =>
    save.run(async () => {
      if (!name.trim()) throw new AppError('Please enter a display name.')
      if (cleanEmail && !EMAIL_RE.test(cleanEmail))
        throw new AppError('Please enter a valid email address.')
      if (!cleanEmail && isMe)
        throw new AppError('You can’t remove your own sign-in email.')
      try {
        onSaved(
          await updateRow<Member>(
            'family',
            { person: saved.person },
            { display_name: name.trim(), email: cleanEmail },
          ),
        )
      } catch (e) {
        if (
          /duplicate key|family_email_key/i.test(String((e as Error).message))
        )
          throw new AppError('Another family account already uses that email.')
        throw e
      }
      setConfirming(false)
      if (isMe && emailChanged) await reloadAuth()
    }, 'Saved')

  return (
    <li class="set-item stack">
      <div class="spread">
        <h3 class="set-item-title">
          {saved.display_name}
          {isMe && <span class="meta"> (you)</span>}
        </h3>
        <span
          class={`pill ${saved.role === 'admin' ? 'pill-blue' : 'pill-muted'}`}
        >
          {ROLE[saved.role]}
        </span>
      </div>
      <div class="set-grid">
        <Field label="Display name">
          <Input
            value={name}
            onInput={(e: Event) =>
              setName((e.currentTarget as HTMLInputElement).value)
            }
          />
        </Field>
        <Field
          label="Sign-in email"
          hint={
            saved.email ? undefined : 'Not set: this person can’t sign in yet.'
          }
        >
          <Input
            type="email"
            autocomplete="off"
            value={email}
            onInput={(e: Event) =>
              setEmail((e.currentTarget as HTMLInputElement).value)
            }
          />
        </Field>
      </div>
      {!confirming && <ErrorText error={save.error} />}
      <div class="actions">
        <Button
          variant="primary"
          size="sm"
          busy={save.busy && !confirming}
          disabled={!dirty}
          onClick={() => (emailChanged ? setConfirming(true) : write())}
        >
          Save {saved.display_name}
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Change ${saved.display_name}’s sign-in email?`}
      >
        <div class="stack">
          <p>
            {cleanEmail ? (
              <>
                From now on, {isMe ? 'you' : saved.display_name} will sign in
                with <strong>{cleanEmail}</strong>. They’ll need to make an
                account with that email and confirm it first.
              </>
            ) : (
              <>
                {saved.display_name} won’t be able to sign in to family pages
                until an email is set.
              </>
            )}
          </p>
          {isMe && (
            <Notice tone="warn">
              This is your own account. Once it’s saved, this browser loses
              access to family pages until you sign in with the new email.
            </Notice>
          )}
          <ErrorText error={save.error} />
          <div class="actions">
            <Button variant="primary" busy={save.busy} onClick={write}>
              Change email
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  )
}

export function FamilySettings({ me }: { me: FamilyStatus }) {
  const { data, error, loading, setData } = useAsync(async () => {
    const rows = await query<Member[]>(
      supabase.from('family').select('person, display_name, role, email'),
    )
    return rows.sort(
      (a, b) => ORDER.indexOf(a.person) - ORDER.indexOf(b.person),
    )
  })
  if (loading && !data) return <Loading />
  if (error) return <ErrorText error={error} />
  if (!data) return null
  return (
    <Section
      title="Family accounts"
      lede="The four family accounts. Roles are fixed."
    >
      <Notice tone="warn" title="These emails are how each person signs in">
        <p>
          Whoever controls an email here can reach family pages, so only enter
          an address that person alone uses. Each person makes an account with a
          password and confirms their email from a link we send. Never share
          these emails or passwords, and never put them in the site’s code.
        </p>
      </Notice>
      <ul class="set-list">
        {data.map(m => (
          <MemberRow
            key={m.person}
            saved={m}
            me={me}
            onSaved={n =>
              setData(data.map(x => (x.person === n.person ? n : x)))
            }
          />
        ))}
      </ul>
    </Section>
  )
}

interface Account {
  user_id: string
  email: string
  name: string | null
  kind: 'family' | 'guest'
  role: 'admin' | 'elevated' | null
  confirmed: boolean
  created_at: string
  last_sign_in_at: string | null
}

const day = (iso: string | null) => (iso ? fmtDate(iso) : 'never')

/** Every account on the site, family and guests, for Admins. */
export function AllAccounts() {
  const { data, error, loading } = useAsync(() =>
    rpc<Account[]>('admin_accounts'),
  )
  if (loading) return <Loading />
  if (error) return <ErrorText error={error} />
  return (
    <Section
      title="All accounts"
      lede="Everyone who has made an account, with whether they’ve confirmed their email. Passwords are never visible."
    >
      <ul class="set-list">
        {(data ?? []).map(a => (
          <li key={a.user_id} class="set-item spread">
            <span>
              <strong>{a.name || a.email}</strong>
              {a.name && <span class="meta"> · {a.email}</span>}
              <span class="meta">
                {' '}
                · joined {day(a.created_at)} · last sign-in{' '}
                {day(a.last_sign_in_at)}
              </span>
            </span>
            <span>
              <span
                class={`pill ${a.kind === 'family' ? 'pill-blue' : 'pill-muted'}`}
              >
                {a.kind === 'family' ? ROLE[a.role ?? 'elevated'] : 'Guest'}
              </span>{' '}
              <span
                class={`pill ${a.confirmed ? 'pill-muted' : 'pill-yellow'}`}
              >
                {a.confirmed ? 'Confirmed' : 'Not confirmed'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

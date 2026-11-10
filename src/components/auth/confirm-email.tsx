import { useEffect, useState } from 'preact/hooks'
import { reloadAuth, useAuth } from '@/lib/auth'
import { configured, errorMessage, rpc, supabase } from '@/lib/supabase'
import {
  Button,
  ErrorText,
  Field,
  Input,
  Loading,
  Notice,
  site,
  useAction,
} from '@/lib/ui'

/** The page the confirmation email links to (`/confirm/?t=…`). */
export function ConfirmEmail() {
  const token = new URLSearchParams(location.search).get('t') ?? ''
  const [state, setState] = useState<'working' | 'done' | 'bad' | 'password'>(
    'working',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!configured) return setState('bad')
    ;(async () => {
      const { data, error } = await supabase.rpc('confirm_email', {
        p_token: token,
      })
      if (error) setError(errorMessage(error))
      if (data === 'confirmed') {
        await reloadAuth()
        return setState('done')
      }
      setState(data === 'password_needed' ? 'password' : 'bad')
    })()
  }, [token])

  if (state === 'working') return <Loading label="Confirming your email…" />
  if (state === 'password')
    return (
      <ChoosePassword
        token={token}
        onDone={async () => {
          await reloadAuth()
          setState('done')
        }}
      />
    )
  if (state === 'done')
    return (
      <Notice tone="success" title="Your email is confirmed">
        <p>
          Thank you! You can now make changes.{' '}
          <a href={site('profile/')}>Go to your profile</a>.
        </p>
      </Notice>
    )
  return (
    <Notice tone="error" title="That link didn’t work">
      <p>
        {error ??
          'It may be old or mistyped. Sign in and we can send you a new one.'}{' '}
        <a href={site('signin/')}>Sign in</a>
      </p>
    </Notice>
  )
}

/**
 * Opened from the email in a browser that isn't signed in as this account. Anyone could
 * have made the account with someone else's address, so the person with the email picks
 * the password now. Every other session on the account is signed out.
 */
function ChoosePassword({
  token,
  onDone,
}: {
  token: string
  onDone: () => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const save = useAction()
  const submit = (e: Event) => {
    e.preventDefault()
    return save.run(async () => {
      const email = await rpc<string>('confirm_email_with_password', {
        p_token: token,
        p_password: password,
      })
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      await onDone()
    })
  }
  return (
    <form class="card stack" onSubmit={submit}>
      <h2 class="h3">Choose your password</h2>
      <p>
        To finish confirming, choose a password for this account. It replaces
        any password set before, and signs out other devices.
      </p>
      <Field label="New password" hint="At least 8 characters.">
        <Input
          type="password"
          required
          minLength={8}
          autocomplete="new-password"
          value={password}
          onInput={e => setPassword(e.currentTarget.value)}
        />
      </Field>
      <ErrorText error={save.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={save.busy}>
          Confirm and sign in
        </Button>
      </div>
    </form>
  )
}

/** Shown to a signed-in person whose email isn’t confirmed yet. */
export function ConfirmBanner({ title }: { title?: string }) {
  const auth = useAuth()
  const resend = useAction()
  if (auth.loading || !auth.session || auth.confirmed) return null
  return (
    <Notice tone="warn" title={title ?? 'Please confirm your email'}>
      <div class="stack">
        <p>
          We sent a link to {auth.session.user.email}. Until you open it, you
          can look around but can’t make changes.
        </p>
        <ErrorText error={resend.error} />
        <div class="actions">
          <Button
            size="sm"
            busy={resend.busy}
            onClick={() =>
              resend.run(
                () => rpc('resend_confirmation'),
                'Link sent. Check your email.',
              )
            }
          >
            Send the link again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => reloadAuth()}>
            I’ve confirmed it
          </Button>
        </div>
      </div>
    </Notice>
  )
}

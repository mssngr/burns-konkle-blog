import { useEffect, useState } from 'preact/hooks'
import { doneRecovering, useAuth } from '@/lib/auth'
import { configured, errorMessage, supabase } from '@/lib/supabase'
import { Button, Field, Input, Loading, Notice, site } from '@/lib/ui'
import { NewPassword } from './password'

const nextUrl = () => {
  const n = new URLSearchParams(location.search).get('next')
  return n?.startsWith('/') && !n.startsWith('//') ? n : null
}

type Mode = 'signin' | 'signup' | 'forgot'

/** Sign in with an email and password, make an account, or ask for a reset link. */
export function SignIn() {
  const auth = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentReset, setSentReset] = useState(false)

  useEffect(() => {
    if (auth.loading || !auth.session || auth.recovering) return
    location.replace(
      nextUrl() ?? site(auth.family?.confirmed ? 'family/' : 'profile/'),
    )
  }, [auth])

  if (!configured)
    return <Notice tone="warn">Sign-in isn’t connected yet.</Notice>
  if (auth.loading) return <Loading />
  if (auth.session && auth.recovering)
    return (
      <div class="card stack">
        <h2 class="h3">Choose a new password</h2>
        <NewPassword
          onDone={() => {
            doneRecovering()
          }}
        />
      </div>
    )
  if (auth.session) return <Loading label="Signing you in…" />

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setSentReset(false)
  }

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const creds = { email: email.trim(), password }
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(creds.email, {
        redirectTo: `${location.origin}${site('signin/')}`,
      })
      if (error) setError(errorMessage(error))
      else setSentReset(true)
    } else {
      const { error } =
        mode === 'signup'
          ? await supabase.auth.signUp(creds)
          : await supabase.auth.signInWithPassword(creds)
      if (error)
        setError(
          /invalid login/i.test(error.message)
            ? 'That email and password don’t match. Check them, or reset your password.'
            : errorMessage(error),
        )
    }
    setBusy(false)
  }

  if (mode === 'forgot' && sentReset)
    return (
      <Notice tone="success" title="Check your email">
        <p>
          If {email.trim()} has an account, we sent a link to choose a new
          password.
        </p>
      </Notice>
    )

  return (
    <form class="card stack" onSubmit={submit}>
      <h2 class="h3">
        {mode === 'signup'
          ? 'Make an account'
          : mode === 'forgot'
            ? 'Reset your password'
            : 'Sign in'}
      </h2>
      <Field label="Email">
        <Input
          type="email"
          required
          autocomplete="email"
          value={email}
          onInput={e => setEmail(e.currentTarget.value)}
        />
      </Field>
      {mode !== 'forgot' && (
        <Field
          label="Password"
          hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
        >
          <Input
            type="password"
            required
            minLength={mode === 'signup' ? 8 : undefined}
            autocomplete={
              mode === 'signup' ? 'new-password' : 'current-password'
            }
            value={password}
            onInput={e => setPassword(e.currentTarget.value)}
          />
        </Field>
      )}
      {mode === 'signup' && (
        <p class="muted small">
          We’ll email you a link to confirm your address. Until you open it, you
          can look around but can’t make changes.
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <div class="actions">
        <Button type="submit" variant="primary" busy={busy}>
          {mode === 'signup'
            ? 'Make account'
            : mode === 'forgot'
              ? 'Email me a link'
              : 'Sign in'}
        </Button>
        {mode === 'signin' && (
          <>
            <Button variant="ghost" onClick={() => switchTo('signup')}>
              Make an account
            </Button>
            <Button variant="ghost" onClick={() => switchTo('forgot')}>
              Forgot password?
            </Button>
          </>
        )}
        {mode !== 'signin' && (
          <Button variant="ghost" onClick={() => switchTo('signin')}>
            Back to sign in
          </Button>
        )}
      </div>
    </form>
  )
}

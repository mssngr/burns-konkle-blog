import { useEffect, useState } from 'preact/hooks'
import { reloadAuth, signOut, useAuth } from '@/lib/auth'
import { configured, errorMessage, supabase } from '@/lib/supabase'
import { Button, Field, Input, Loading, Notice, site } from '@/lib/ui'

const nextUrl = () => {
  const n = new URLSearchParams(location.search).get('next')
  return n?.startsWith('/') && !n.startsWith('//') ? n : null
}

/** Email one-time-code sign-in, then two-step verification for family accounts. */
export function SignIn() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (auth.loading || !auth.session) return
    if (auth.family?.verified) location.replace(nextUrl() ?? site('family/'))
    else if (!auth.family) location.replace(nextUrl() ?? site('profile/'))
  }, [auth])

  if (!configured)
    return <Notice tone="warn">Sign-in isn’t connected yet.</Notice>
  if (auth.loading) return <Loading />
  if (auth.session && auth.family && !auth.family.verified) return <TwoStep />
  if (auth.session) return <Loading label="Signing you in…" />

  async function sendCode(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: location.href },
    })
    setBusy(false)
    if (error) setError(errorMessage(error))
    else setStep('code')
  }

  async function verify(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error)
      setError(
        /expired|invalid/i.test(error.message)
          ? 'That code didn’t work. Check it, or send a new one.'
          : errorMessage(error),
      )
    else await reloadAuth()
  }

  return step === 'email' ? (
    <form class="card stack" onSubmit={sendCode}>
      <Field
        label="Email"
        hint="We’ll email you a sign-in code. No password needed."
      >
        <Input
          type="email"
          required
          autocomplete="email"
          value={email}
          onInput={e => setEmail(e.currentTarget.value)}
        />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <div class="actions">
        <Button type="submit" variant="primary" busy={busy}>
          Email me a code
        </Button>
      </div>
    </form>
  ) : (
    <form class="card stack" onSubmit={verify}>
      <p>
        We sent a code to <strong>{email}</strong>. It can take a minute to
        arrive.
      </p>
      <Field label="Code from the email">
        <Input
          inputMode="numeric"
          autocomplete="one-time-code"
          pattern="[0-9]{6,8}"
          maxLength={8}
          required
          value={code}
          onInput={e => setCode(e.currentTarget.value.replace(/\D/g, ''))}
        />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <div class="actions">
        <Button type="submit" variant="primary" busy={busy}>
          Sign in
        </Button>
        <Button variant="ghost" onClick={() => setStep('email')}>
          Use a different email
        </Button>
      </div>
    </form>
  )
}

/** Family accounts confirm with an authenticator app every sign-in. */
export function TwoStep() {
  const [mode, setMode] = useState<'loading' | 'enroll' | 'verify'>('loading')
  const [factorId, setFactorId] = useState('')
  const [qr, setQr] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) return setError(errorMessage(error))
      const verified = data.totp.find(f => f.status === 'verified')
      if (verified) {
        setFactorId(verified.id)
        setMode('verify')
        return
      }
      // Clear half-finished enrollments, then start a fresh one.
      for (const f of data.all.filter(f => f.status === 'unverified'))
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      const en = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Family site ${Date.now()}`,
      })
      if (en.error) return setError(errorMessage(en.error))
      setFactorId(en.data.id)
      setQr(en.data.totp.qr_code)
      setSecret(en.data.totp.secret)
      setMode('enroll')
    })()
  }, [])

  async function submit(e: Event) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // Challenge and verify separately so a server problem isn't reported as a wrong code.
    const ch = await supabase.auth.mfa.challenge({ factorId })
    if (ch.error) {
      setBusy(false)
      console.error('MFA challenge failed', ch.error)
      setError(`Couldn’t start verification: ${ch.error.message}`)
      return
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.data.id,
      code: code.trim(),
    })
    setBusy(false)
    if (error) {
      console.error('MFA verify failed', error)
      setError(
        error.code === 'mfa_verification_failed' ||
          /invalid|match/i.test(error.message)
          ? 'That code didn’t match. Codes change every 30 seconds; try the newest one.'
          : `Couldn’t verify: ${error.message}`,
      )
    } else await reloadAuth()
  }

  if (mode === 'loading')
    return error ? <Notice tone="error">{error}</Notice> : <Loading />

  return (
    <form class="card stack" onSubmit={submit}>
      <h2 class="h3">Two-step verification</h2>
      {mode === 'enroll' ? (
        <>
          <p>
            Family accounts can see guests’ details, so they need a second step.
            Scan this with an authenticator app (Google Authenticator,
            1Password, Authy, or your phone’s Passwords app), then enter the
            code it shows.
          </p>
          <img
            class="qr"
            src={qr}
            alt="QR code for your authenticator app"
            width={180}
            height={180}
          />
          <details>
            <summary>Can’t scan? Enter this key instead</summary>
            <code class="secret">{secret}</code>
          </details>
        </>
      ) : (
        <p>Enter the 6-digit code from your authenticator app.</p>
      )}
      <Field label="Code">
        <Input
          inputMode="numeric"
          autocomplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onInput={e => setCode(e.currentTarget.value.replace(/\D/g, ''))}
        />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      <div class="actions">
        <Button type="submit" variant="primary" busy={busy}>
          Verify
        </Button>
        <Button variant="ghost" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </form>
  )
}

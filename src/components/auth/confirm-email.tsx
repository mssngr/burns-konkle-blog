import { useEffect, useState } from 'preact/hooks'
import { reloadAuth, useAuth } from '@/lib/auth'
import { configured, errorMessage, rpc, supabase } from '@/lib/supabase'
import { Button, ErrorText, Loading, Notice, site, useAction } from '@/lib/ui'

/** The page the confirmation email links to (`/confirm/?t=…`). */
export function ConfirmEmail() {
  const [state, setState] = useState<'working' | 'done' | 'bad'>('working')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('t') ?? ''
    if (!configured) return setState('bad')
    ;(async () => {
      const { data, error } = await supabase.rpc('confirm_email', {
        p_token: token,
      })
      if (error) setError(errorMessage(error))
      else if (data === true) {
        await reloadAuth()
        return setState('done')
      }
      setState('bad')
    })()
  }, [])

  if (state === 'working') return <Loading label="Confirming your email…" />
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

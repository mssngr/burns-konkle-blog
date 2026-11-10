import { useState } from 'preact/hooks'
import { AppError, supabase } from '@/lib/supabase'
import { Button, ErrorText, Field, Input, useAction } from '@/lib/ui'

const MIN = 8

/** Choose a new password. Used by "Change password" and by the reset link. */
export function NewPassword({
  onDone,
  label = 'Save password',
}: {
  onDone?: () => void
  label?: string
}) {
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const save = useAction()

  const submit = (e: Event) => {
    e.preventDefault()
    return save.run(async () => {
      if (password.length < MIN)
        throw new AppError(`Use at least ${MIN} characters.`)
      if (password !== again) throw new AppError('The two passwords differ.')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      // A changed password should end any other session that still has the old one.
      await supabase.auth.signOut({ scope: 'others' })
      setPassword('')
      setAgain('')
      onDone?.()
    }, 'Password saved')
  }

  return (
    <form class="stack" onSubmit={submit}>
      <Field label="New password" hint={`At least ${MIN} characters.`}>
        <Input
          type="password"
          required
          autocomplete="new-password"
          value={password}
          onInput={e => setPassword(e.currentTarget.value)}
        />
      </Field>
      <Field label="New password again">
        <Input
          type="password"
          required
          autocomplete="new-password"
          value={again}
          onInput={e => setAgain(e.currentTarget.value)}
        />
      </Field>
      <ErrorText error={save.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={save.busy}>
          {label}
        </Button>
      </div>
    </form>
  )
}

/** A card on the profile page for changing your own password. */
export function ChangePassword() {
  return (
    <section class="card stack">
      <h2 class="h3">Change your password</h2>
      <NewPassword label="Change password" />
    </section>
  )
}

import { useState } from 'preact/hooks'
import { NewPassword } from '@/components/auth/password'
import { reloadAuth, useAuth } from '@/lib/auth'
import {
  dismissPasswordPrompt,
  isPasswordPromptDismissed,
  shouldPromptForPassword,
} from '@/lib/password-prompt'
import { Button, Modal } from '@/lib/ui'

/** Asks signed-in people who signed up before passwords existed to set one. Mounted once, in the app layout. */
export function SetPasswordPrompt() {
  const auth = useAuth()
  const [dismissed, setDismissed] = useState(isPasswordPromptDismissed)
  const open = shouldPromptForPassword({
    loading: auth.loading,
    signedIn: !!auth.session,
    hasPassword: auth.hasPassword,
    recovering: auth.recovering,
    pathname: location.pathname,
    dismissed,
  })

  const notNow = () => {
    dismissPasswordPrompt()
    setDismissed(true)
  }

  return (
    <Modal open={open} onClose={notNow} title="Set a password">
      <div class="stack">
        <p>
          Set a password so you can sign in without an emailed link. It only
          takes a moment.
        </p>
        {/* Saving flips hasPassword, which closes the pop-up. */}
        <NewPassword onDone={reloadAuth} />
        <div class="actions">
          <Button onClick={notNow}>Not now</Button>
        </div>
      </div>
    </Modal>
  )
}

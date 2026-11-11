const KEY = 'password-prompt-dismissed'

export interface PasswordPromptInput {
  loading: boolean
  signedIn: boolean
  /** False only when we know the account has no password. */
  hasPassword: boolean
  /** On a password-reset link, which already asks for a new password. */
  recovering: boolean
  pathname: string
  dismissed: boolean
}

/** The confirmation page has its own password step; don't stack a second ask on it. */
const onConfirmPage = (pathname: string) => /\/confirm\/?$/.test(pathname)

/**
 * Should we ask this person to set a password right now?
 * Confirmation is deliberately not an input: setting a password isn't a "change",
 * so unconfirmed accounts are asked too.
 */
export function shouldPromptForPassword(i: PasswordPromptInput): boolean {
  return (
    !i.loading &&
    i.signedIn &&
    !i.hasPassword &&
    !i.recovering &&
    !i.dismissed &&
    !onConfirmPage(i.pathname)
  )
}

// Storage can be missing or throw (private windows, blocked site data); the prompt still works without it.
export function isPasswordPromptDismissed(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Remember "Not now" until this browser session ends. */
export function dismissPasswordPrompt() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {}
}

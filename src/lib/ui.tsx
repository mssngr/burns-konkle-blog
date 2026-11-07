// Shared Preact building blocks. Styles live in src/styles/app.css.
import type { ComponentChildren, JSX } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { useAuth } from '@/lib/auth'
import { errorMessage, supabase } from '@/lib/supabase'

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(' ')

// ---------------------------------------------------------------- buttons

type ButtonProps = JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
  size?: 'sm' | 'md'
  busy?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy,
  class: c,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      class={cx(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        c as string,
      )}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <span class="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

// ----------------------------------------------------------------- fields

export function Field({
  label,
  hint,
  error,
  children,
  optional,
  class: c,
}: {
  label: ComponentChildren
  hint?: ComponentChildren
  error?: string | null
  optional?: boolean
  children: ComponentChildren
  class?: string
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label class={cx('ff', c)}>
      <span class="ff-label">
        {label}
        {optional && <span class="ff-optional"> (optional)</span>}
      </span>
      {children}
      {hint && <span class="ff-hint">{hint}</span>}
      {error && <span class="ff-error">{error}</span>}
    </label>
  )
}

export const Input = (
  p: JSX.HTMLAttributes<HTMLInputElement> & Record<string, unknown>,
) => <input {...p} class={cx('input', p.class as string)} />
export const TextArea = (
  p: JSX.HTMLAttributes<HTMLTextAreaElement> & Record<string, unknown>,
) => <textarea rows={3} {...p} class={cx('input', p.class as string)} />
export const Select = (
  p: JSX.HTMLAttributes<HTMLSelectElement> & Record<string, unknown>,
) => <select {...p} class={cx('input', p.class as string)} />

export function Check({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ComponentChildren
  disabled?: boolean
}) {
  return (
    <label class="cb">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.currentTarget.checked)}
      />
      <span>{children}</span>
    </label>
  )
}

// --------------------------------------------------------------- feedback

export function Notice({
  tone = 'info',
  title,
  children,
  class: c,
}: {
  tone?: 'info' | 'warn' | 'error' | 'success'
  title?: ComponentChildren
  children?: ComponentChildren
  class?: string
}) {
  return (
    <div
      class={cx('notice', `notice-${tone}`, c)}
      role={tone === 'error' ? 'alert' : undefined}
    >
      {title && <p class="notice-title">{title}</p>}
      {children && <div class="notice-body">{children}</div>}
    </div>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return <Notice tone="error">{errorMessage(error)}</Notice>
}

export const Spinner = () => (
  <span class="spinner" role="status" aria-label="Loading" />
)

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p class="loading">
      <span class="spinner" aria-hidden="true" /> {label}
    </p>
  )
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="empty-state">{children}</p>
}

/** Small transient message at the bottom of the screen. */
export function toast(message: string, tone: 'ok' | 'warn' = 'ok') {
  let host = document.querySelector<HTMLElement>('[data-app-toasts]')
  if (!host) {
    host = document.createElement('div')
    host.className = 'toasts'
    host.setAttribute('aria-live', 'polite')
    host.dataset.appToasts = ''
    document.body.append(host)
  }
  const el = document.createElement('div')
  el.className = cx('toast', tone === 'warn' && 'toast-warn')
  el.textContent = message
  host.append(el)
  setTimeout(() => {
    el.classList.add('out')
    setTimeout(() => el.remove(), 400)
  }, 4200)
}

// ------------------------------------------------------------ calendar colors

export type SlotState =
  | 'green'
  | 'yellow'
  | 'orange'
  | 'blue'
  | 'purple'
  | 'red'

export const STATE_LABELS: Record<SlotState, string> = {
  green: 'Open',
  yellow: 'Requested, not finished',
  orange: 'Waiting for approval',
  blue: 'Approved, room left',
  purple: 'Full',
  red: 'Not available',
}

export function Legend({
  states = ['green', 'yellow', 'orange', 'blue', 'purple', 'red'],
  labels,
}: {
  states?: SlotState[]
  labels?: Partial<Record<SlotState, string>>
}) {
  return (
    <ul class="legend" aria-label="What the colors mean">
      {states.map(s => (
        <li key={s}>
          <span class={`swatch st-${s}`} aria-hidden="true" />
          {labels?.[s] ?? STATE_LABELS[s]}
        </li>
      ))}
    </ul>
  )
}

/** Status of a booking / sign-up as a colored pill. */
const STATUS: Record<string, [string, SlotState | 'muted']> = {
  draft: ['Not finished', 'yellow'],
  submitted: ['Waiting for approval', 'orange'],
  approved: ['Approved', 'blue'],
  acknowledged: ['Acknowledged', 'blue'],
  denied: ['Not approved', 'muted'],
  cancelled: ['Cancelled', 'muted'],
  expired: ['Expired', 'muted'],
  pending: ['Waiting', 'orange'],
  published: ['Published', 'blue'],
  held: ['Held', 'muted'],
  sent: ['Sent', 'blue'],
  logged: ['Not sent (no email key)', 'yellow'],
  queued: ['Queued', 'orange'],
  failed: ['Failed', 'red'],
}

export function StatusPill({
  status,
  label,
}: {
  status: string
  label?: string
}) {
  const [text, tone] = STATUS[status] ?? [status, 'muted']
  return <span class={`pill pill-${tone}`}>{label ?? text}</span>
}

// ----------------------------------------------------------------- dialog

/**
 * An in-page replacement for window.confirm (which some browsers and webviews
 * suppress). Call `ask(message)`, await the boolean, and render `dialog`.
 */
export function useConfirm(confirmLabel = 'Yes') {
  const [message, setMessage] = useState<string | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)
  const settle = (ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setMessage(null)
  }
  const ask = (text: string) =>
    new Promise<boolean>(resolve => {
      resolver.current = resolve
      setMessage(text)
    })
  const dialog = (
    <Modal
      open={message !== null}
      onClose={() => settle(false)}
      title="Are you sure?"
    >
      <p>{message}</p>
      <div class="actions">
        <Button variant="danger" onClick={() => settle(true)}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={() => settle(false)}>
          Keep it
        </Button>
      </div>
    </Modal>
  )
  return { ask, dialog }
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ComponentChildren
  children: ComponentChildren
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      class={cx('modal', wide && 'modal-wide')}
      onClose={onClose}
      onCancel={onClose}
    >
      <div class="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          class="modal-x"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div class="modal-body">{open && children}</div>
    </dialog>
  )
}

// ------------------------------------------------------------------ data

/** Load something once (and on demand). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  // Always call the latest fn; reload when the caller's deps change.
  const fnRef = useRef(fn)
  fnRef.current = fn
  const key = JSON.stringify(deps)
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (key !== undefined) reload()
  }, [key, reload])
  return { data, error, loading, reload, setData }
}

/** Run an action with a busy flag and an error, toasting on success. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const run = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      success?: string,
    ): Promise<T | undefined> => {
      setBusy(true)
      setError(null)
      try {
        const out = await fn()
        if (success) toast(success)
        return out
      } catch (e) {
        setError(e)
        return undefined
      } finally {
        setBusy(false)
      }
    },
    [],
  )
  return { busy, error, run, setError }
}

export function useQueryParam(name: string): string | null {
  const [v] = useState(() =>
    typeof location === 'undefined'
      ? null
      : new URLSearchParams(location.search).get(name),
  )
  return v
}

// --------------------------------------------------------------- contact

export interface Contact {
  name: string
  email: string
  phone: string
  consent: boolean
}

const CONTACT_KEY = 'bk.contact'

export function loadContact(): Contact {
  try {
    const c = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? 'null')
    if (c)
      return {
        name: c.name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        consent: false,
      }
  } catch {}
  return { name: '', email: '', phone: '', consent: false }
}

export function saveContact(c: Contact) {
  try {
    localStorage.setItem(
      CONTACT_KEY,
      JSON.stringify({ name: c.name, email: c.email, phone: c.phone }),
    )
  } catch {}
}

/** Prefill from this device, then from a signed-in profile. */
export function useContact() {
  const [contact, setContact] = useState<Contact>(() =>
    typeof localStorage === 'undefined'
      ? { name: '', email: '', phone: '', consent: false }
      : loadContact(),
  )
  const auth = useAuth()
  useEffect(() => {
    const s = auth.session
    if (!s) return
    supabase
      .from('profiles')
      .select('name, phone')
      .maybeSingle()
      .then(({ data }) => {
        setContact(c => ({
          ...c,
          name: c.name || data?.name || '',
          phone: c.phone || data?.phone || '',
          email: c.email || s.user.email || '',
        }))
      })
  }, [auth.session])
  return [contact, setContact] as const
}

export const CONSENT_TEXT = 'I agree to receive emails about my request.'

/** Name, email (required), phone (optional), and email consent. */
export function ContactFields({
  value,
  onChange,
  consentText = CONSENT_TEXT,
  showConsent = true,
}: {
  value: Contact
  onChange: (c: Contact) => void
  consentText?: string
  showConsent?: boolean
}) {
  const set = (k: keyof Contact) => (e: Event) =>
    onChange({ ...value, [k]: (e.currentTarget as HTMLInputElement).value })
  return (
    <div class="form-grid">
      <Field label="Your full name">
        <Input
          required
          autocomplete="name"
          value={value.name}
          onInput={set('name')}
          maxLength={80}
        />
      </Field>
      <Field
        label="Email"
        hint="We’ll email you about your request. A guest is known by name and email together."
      >
        <Input
          required
          type="email"
          autocomplete="email"
          value={value.email}
          onInput={set('email')}
        />
      </Field>
      <Field label="Mobile phone" optional>
        <Input
          type="tel"
          autocomplete="tel"
          value={value.phone}
          onInput={set('phone')}
        />
      </Field>
      {showConsent && (
        <Check
          checked={value.consent}
          onChange={v => onChange({ ...value, consent: v })}
        >
          {consentText}
        </Check>
      )}
    </div>
  )
}

export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: ComponentChildren
  children?: ComponentChildren
}) {
  return (
    <header class="page-head">
      {eyebrow && <p class="page-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <div class="page-lede">{children}</div>}
    </header>
  )
}

export const site = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`

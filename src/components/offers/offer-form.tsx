import { useState } from 'preact/hooks'
import { query, rpc, supabase } from '@/lib/supabase'
import {
  Button,
  Check,
  ContactFields,
  Empty,
  ErrorText,
  Field,
  Loading,
  Notice,
  saveContact,
  site,
  TextArea,
  useAction,
  useAsync,
  useContact,
  useQueryParam,
} from '@/lib/ui'

interface OfferOption {
  key: string
  label: string
  destination: string
}

interface Offer {
  name: string
  options: string[]
  write_in: string | null
  availability: string | null
  choices: OfferOption[]
}

const WRITE_IN_KEY = 'other'

/** The Offerings Interest Form, then its thank-you screen with "Schedule this" buttons. */
export function OfferPage() {
  const initial = useQueryParam('t')
  const [token, setToken] = useState(initial)
  if (token) return <OfferThanks token={token} />
  return (
    <OfferForm
      onDone={t => {
        history.replaceState(
          null,
          '',
          `${location.pathname}?t=${encodeURIComponent(t)}`,
        )
        setToken(t)
        scrollTo({ top: 0 })
      }}
    />
  )
}

function OfferForm({ onDone }: { onDone: (token: string) => void }) {
  const options = useAsync(() =>
    query(
      supabase
        .from('offer_options')
        .select('key, label, destination')
        .eq('active', true)
        .order('position'),
    ),
  )
  const [contact, setContact] = useContact()
  const [checked, setChecked] = useState<string[]>([])
  const [writeIn, setWriteIn] = useState('')
  const [availability, setAvailability] = useState('')
  const [notes, setNotes] = useState('')
  const act = useAction()

  const opts = (options.data ?? []) as OfferOption[]
  const hasWriteInOption = opts.some(o => o.key === WRITE_IN_KEY)
  const showWriteIn = !hasWriteInOption || checked.includes(WRITE_IN_KEY)

  const toggle = (key: string, on: boolean) =>
    setChecked(cs => (on ? [...cs, key] : cs.filter(k => k !== key)))

  async function submit(e: Event) {
    e.preventDefault()
    const out = await act.run(async () => {
      const r = await rpc<{ token: string }>('submit_offer', {
        p_name: contact.name.trim(),
        p_email: contact.email.trim(),
        p_phone: contact.phone.trim() || null,
        p_consent: contact.consent,
        p_options: checked,
        p_write_in: showWriteIn ? writeIn.trim() || null : null,
        p_availability: availability.trim() || null,
        p_notes: notes.trim() || null,
      })
      saveContact(contact)
      return r
    })
    if (out?.token) onDone(out.token)
  }

  if (options.loading) return <Loading />

  return (
    <form class="stack" onSubmit={submit}>
      <ErrorText error={options.error} />
      <section class="card stack">
        <h2 class="h3">Your details</h2>
        <ContactFields value={contact} onChange={setContact} />
      </section>

      <section class="card stack">
        <h2 class="h3">How you’d like to help</h2>
        <p class="small muted">Check as many as you like.</p>
        {opts.length ? (
          <div class="offer-checks">
            {opts.map(o => (
              <Check
                key={o.key}
                checked={checked.includes(o.key)}
                onChange={v => toggle(o.key, v)}
              >
                {o.label}
              </Check>
            ))}
          </div>
        ) : (
          <Empty>
            The checklist isn’t available right now. You can still write in how
            you’d like to help.
          </Empty>
        )}
        {(showWriteIn || !opts.length) && (
          <Field label="Your idea" optional={!checked.includes(WRITE_IN_KEY)}>
            <TextArea
              value={writeIn}
              maxLength={1000}
              required={checked.includes(WRITE_IN_KEY)}
              onInput={e => setWriteIn(e.currentTarget.value)}
            />
          </Field>
        )}
        <Field label="Which days and times generally work for you?" optional>
          <TextArea
            value={availability}
            maxLength={1000}
            placeholder="For example: weekday mornings, or Saturdays after noon."
            onInput={e => setAvailability(e.currentTarget.value)}
          />
        </Field>
        <Field label="Notes" optional>
          <TextArea
            value={notes}
            maxLength={2000}
            onInput={e => setNotes(e.currentTarget.value)}
          />
        </Field>
      </section>

      <ErrorText error={act.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={act.busy}>
          Send my offer
        </Button>
      </div>
    </form>
  )
}

function scheduleHref(dest: string, token: string): string | null {
  const t = encodeURIComponent(token)
  if (dest === 'meal') return `${site('meals/')}?offer=${t}`
  const m = /^visit:(\d+)$/.exec(dest)
  if (m) return `${site('visits/')}?type=${m[1]}&offer=${t}`
  return null
}

function OfferThanks({ token }: { token: string }) {
  const offer = useAsync(
    () => rpc<Offer | null>('get_offer', { p_token: token }),
    [token],
  )
  if (offer.loading) return <Loading />
  if (offer.error) return <ErrorText error={offer.error} />
  const o = offer.data
  if (!o) {
    return (
      <Notice title="We couldn’t find that offer">
        <p>
          Please check your link, or{' '}
          <a href={site('offer/')}>fill out the form again</a>.
        </p>
      </Notice>
    )
  }
  const first = o.name.trim().split(/\s+/)[0]

  return (
    <div class="stack">
      <Notice
        tone="success"
        title={`Thank you so much for offering to help, ${first}!`}
      >
        <p>
          Micala and Gabriel deeply appreciate it. Someone from the family may
          reach out with the best way to help. You can also schedule your offer
          below.
        </p>
      </Notice>

      <section class="card stack">
        <h2 class="h3">Schedule your offer</h2>
        {o.choices.length ? (
          <ul class="offer-choices">
            {o.choices.map(c => {
              const href = scheduleHref(c.destination, token)
              return (
                <li key={c.key} class="offer-choice">
                  <div class="offer-choice-text">
                    <strong>{c.label}</strong>
                    {c.key === WRITE_IN_KEY && o.write_in && (
                      <span class="meta">{o.write_in}</span>
                    )}
                    {!href && (
                      <span class="meta">
                        The family will point you to the right place.
                      </span>
                    )}
                  </div>
                  {href && (
                    <a class="btn btn-primary btn-sm" href={href}>
                      Schedule this
                    </a>
                  )}
                </li>
              )
            })}
            {o.write_in && !o.options.includes(WRITE_IN_KEY) && (
              <li class="offer-choice">
                <div class="offer-choice-text">
                  <strong>{o.write_in}</strong>
                  <span class="meta">
                    The family will point you to the right place.
                  </span>
                </div>
              </li>
            )}
          </ul>
        ) : (
          <p class="muted">
            {o.write_in ? `“${o.write_in}”. ` : ''}The family will point you to
            the right place.
          </p>
        )}
        <p class="small muted">
          We emailed you a link to this page, so you can come back and schedule
          later.
        </p>
      </section>
    </div>
  )
}

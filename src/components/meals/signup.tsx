import { useState } from 'preact/hooks'
import {
  DietaryNeeds,
  DropOffNote,
  firstName,
  loadMealSettings,
  MealPill,
  type MealSettings,
  timeWindow,
} from '@/components/meals/shared'
import { rpc } from '@/lib/supabase'
import { fmtDateTime, fmtLongDate } from '@/lib/time'
import {
  Button,
  Check,
  ErrorText,
  Field,
  Input,
  Loading,
  Modal,
  Notice,
  site,
  TextArea,
  useAction,
  useAsync,
  useQueryParam,
} from '@/lib/ui'

interface Signup {
  id: string
  token: string
  status:
    | 'draft'
    | 'submitted'
    | 'approved'
    | 'denied'
    | 'cancelled'
    | 'expired'
  name: string
  date: string
  slot: string
  label: string
  start: string
  end: string
  dish: string | null
  dietary_ok: boolean
  decision_note: string | null
  expires_at: string | null
}

/** A guest's private Meal Train sign-up page, from the link in their email. */
export function MealSignup() {
  const token = useQueryParam('t')
  if (!token) {
    return (
      <Notice title="We need your private link">
        <p>
          Open this page from the link in your sign-up email, or{' '}
          <a href={site('meals/')}>pick a Meal Train slot</a>.
        </p>
      </Notice>
    )
  }
  return <SignupView token={token} />
}

function SignupView({ token }: { token: string }) {
  const data = useAsync(async () => {
    const [signup, settings] = await Promise.all([
      rpc<Signup>('get_meal_signup', { p_token: token }),
      loadMealSettings(),
    ])
    return { signup, settings }
  }, [token])

  if (data.loading && !data.data) return <Loading />
  if (!data.data) return <ErrorText error={data.error} />
  const { signup: m, settings } = data.data
  const when = `${fmtLongDate(m.start)}, ${timeWindow(m.start, m.end)}`
  const active =
    m.status === 'draft' || m.status === 'submitted' || m.status === 'approved'

  return (
    <div class="stack">
      <section class="card stack">
        <div class="spread">
          <h2 class="h3">Your Meal Train slot</h2>
          <MealPill status={m.status} />
        </div>
        <p class="ms-slot">
          <strong>{m.label}</strong>, {when}
        </p>
        {m.dish && m.status !== 'draft' && (
          <p class="meta">
            Bringing: <strong>{m.dish}</strong>
          </p>
        )}
      </section>

      {m.status === 'draft' && (
        <ConfirmForm signup={m} settings={settings} onDone={data.reload} />
      )}

      {m.status === 'submitted' && (
        <Notice title="Thank you! You’re all set for now">
          <p>
            Gabriel, Micala, Vincent, or Samantha will review your sign-up, and
            we’ll email you once it’s approved. Please wait to be approved
            before asking for the address or stopping by the house.
          </p>
        </Notice>
      )}

      {m.status === 'approved' && (
        <Notice tone="success" title="Thank you so much! You’re confirmed">
          <p>
            You’re confirmed to bring {m.dish ?? 'a meal'} on{' '}
            {fmtLongDate(m.start)}, {timeWindow(m.start, m.end)}. Please drop
            food in the cooler out front, then knock or ring the bell to alert
            the family. No need to wait for an answer.
          </p>
          <p>
            This is not an invitation inside or to stay; please{' '}
            <a href={site('visits/')}>book a separate visit</a> if you’d like to
            see the family, and respect that they are focusing on resting and
            bonding.
          </p>
        </Notice>
      )}

      {m.status === 'denied' && (
        <Notice
          title={`Thank you so much for offering a meal, ${firstName(m.name)}`}
        >
          <p>
            We can’t use the {m.label} slot on {fmtLongDate(m.start)}.
          </p>
          {m.decision_note && <p>Note: {m.decision_note}</p>}
          <p>
            You’re welcome to <a href={site('meals/')}>pick another slot</a>.
          </p>
        </Notice>
      )}

      {m.status === 'expired' && (
        <Notice title="This slot was released">
          <p>
            It wasn’t confirmed in time. You’re welcome to{' '}
            <a href={site('meals/')}>sign up again</a>.
          </p>
        </Notice>
      )}

      {m.status === 'cancelled' && (
        <Notice title="This sign-up was cancelled">
          <p>
            Thank you for letting us know! You’re welcome to{' '}
            <a href={site('meals/')}>pick another slot</a> any time.
          </p>
        </Notice>
      )}

      {active && <CancelSignup token={token} onDone={data.reload} />}
    </div>
  )
}

function ConfirmForm({
  signup,
  settings,
  onDone,
}: {
  signup: Signup
  settings: MealSettings
  onDone: () => void
}) {
  const [dish, setDish] = useState('')
  const [ok, setOk] = useState(false)
  const act = useAction()

  async function submit(e: Event) {
    e.preventDefault()
    const done = await act.run(
      () =>
        rpc('confirm_meal_signup', {
          p_token: signup.token,
          p_dish: dish.trim(),
          p_dietary_ok: ok,
        }).then(() => true),
      'Thank you! Your sign-up is confirmed.',
    )
    if (done) onDone()
  }

  return (
    <form class="card stack" onSubmit={submit}>
      <h2 class="h3">Confirm what you’ll bring</h2>
      {signup.expires_at && (
        <Notice tone="warn">
          Please confirm by <strong>{fmtDateTime(signup.expires_at)}</strong>,
          or the slot will be released for someone else.
        </Notice>
      )}
      <Field
        label="What you’ll bring"
        hint="For example: chicken soup and rolls, or a grocery run."
      >
        <Input
          required
          maxLength={200}
          value={dish}
          onInput={e => setDish(e.currentTarget.value)}
        />
      </Field>
      <DietaryNeeds settings={settings} heading="" />
      <Check checked={ok} onChange={setOk}>
        It follows the dietary needs above.
      </Check>
      <DropOffNote />
      <p class="small muted">
        Please wait to be confirmed and approved before asking for the address
        or stopping by the house.
      </p>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={act.busy}>
          Confirm my sign-up
        </Button>
      </div>
    </form>
  )
}

function CancelSignup({
  token,
  onDone,
}: {
  token: string
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const act = useAction()

  async function cancel() {
    const done = await act.run(
      () =>
        rpc('cancel_meal_signup', {
          p_token: token,
          p_note: note.trim() || null,
        }).then(() => true),
      'Your sign-up was cancelled.',
    )
    if (done) {
      setOpen(false)
      onDone()
    }
  }

  return (
    <div>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Cancel my sign-up
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel your sign-up?"
      >
        <div class="stack">
          <p>
            The slot will be released for someone else, and the family will be
            told.
          </p>
          <Field label="A note for the family" optional>
            <TextArea
              value={note}
              maxLength={500}
              onInput={e => setNote(e.currentTarget.value)}
            />
          </Field>
          <ErrorText error={act.error} />
          <div class="actions">
            <Button variant="danger" busy={act.busy} onClick={cancel}>
              Cancel sign-up
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'preact/hooks'
import {
  clockWindow,
  DietaryNeeds,
  DropOffNote,
  firstName,
  loadMealSettings,
  MealLegend,
  type MealSettings,
  timeWindow,
} from '@/components/meals/shared'
import { rpc } from '@/lib/supabase'
import { addDays, fmtDay, fmtLongDate, todayMT, weekStart } from '@/lib/time'
import {
  Button,
  ContactFields,
  ErrorText,
  Loading,
  Modal,
  Notice,
  type SlotState,
  saveContact,
  site,
  useAction,
  useAsync,
  useContact,
  useQueryParam,
} from '@/lib/ui'

interface CalSlot {
  date: string
  slot: string
  label: string
  start: string
  end: string
  s: SlotState
  r: 'paused' | 'not_open' | 'blocked' | 'past' | null
  name: string | null
}

interface Calendar {
  slots: CalSlot[]
  paused: boolean
  blackout: boolean
}

interface Offer {
  name: string
  email: string
  phone: string | null
  choices: { key: string; label: string; destination: string }[]
}

const DAYS = 21
const MAX_PAGES = 5

const RED_TEXT: Record<string, string> = {
  paused: 'Paused',
  not_open: 'Not open',
  blocked: 'Not available',
  past: 'Past',
}

function cellText(c: CalSlot): string {
  if (c.s === 'purple') return c.name ?? 'Approved'
  if (c.s === 'orange') return 'Waiting'
  if (c.s === 'yellow') return 'Signed up'
  if (c.s === 'red') return RED_TEXT[c.r ?? ''] ?? 'Not available'
  return 'Open'
}

/** The public Meal Train: dietary needs, the calendar, and signing up for a slot. */
export function MealTrain() {
  const settings = useAsync(loadMealSettings)
  if (settings.loading) return <Loading />
  if (!settings.data) return <ErrorText error={settings.error} />
  return <MealTrainInner settings={settings.data} />
}

function MealTrainInner({ settings }: { settings: MealSettings }) {
  const offerToken = useQueryParam('offer')
  const first = weekStart(todayMT())
  const last = addDays(first, DAYS * (MAX_PAGES - 1))
  const [from, setFrom] = useState(first)
  const cal = useAsync(
    () => rpc<Calendar>('meal_calendar', { p_from: from, p_days: DAYS }),
    [from],
  )
  const [picked, setPicked] = useState<CalSlot | null>(null)
  const [contact, setContact] = useContact()
  const [offer, setOffer] = useState<Offer | null>(null)
  const signup = useAction()

  useEffect(() => {
    if (!offerToken) return
    rpc<Offer | null>('get_offer', { p_token: offerToken })
      .then(o => {
        if (!o) return
        setOffer(o)
        setContact(c => ({
          ...c,
          name: o.name,
          email: o.email ?? c.email,
          phone: o.phone ?? c.phone,
        }))
      })
      .catch(() => {})
  }, [offerToken, setContact])

  const weeks = useMemo(() => {
    const byDate = new Map<string, CalSlot[]>()
    for (const s of cal.data?.slots ?? []) {
      const list = byDate.get(s.date) ?? []
      list.push(s)
      byDate.set(s.date, list)
    }
    const out: { start: string; days: { date: string; slots: CalSlot[] }[] }[] =
      []
    for (let w = 0; w < DAYS / 7; w++) {
      const start = addDays(from, w * 7)
      out.push({
        start,
        days: Array.from({ length: 7 }, (_, i) => {
          const date = addDays(start, i)
          return { date, slots: byDate.get(date) ?? [] }
        }),
      })
    }
    return out
  }, [cal.data, from])

  const today = todayMT()
  const closed = !!cal.data?.blackout || !!cal.data?.paused
  const offerMeals = offer?.choices.filter(c => c.destination === 'meal') ?? []

  async function submit(e: Event) {
    e.preventDefault()
    if (!picked) return
    const out = await signup.run(async () => {
      const r = await rpc<{ token: string }>('create_meal_signup', {
        p_date: picked.date,
        p_slot: picked.slot,
        p_name: contact.name.trim(),
        p_email: contact.email.trim(),
        p_phone: contact.phone.trim() || null,
        p_consent: contact.consent,
        p_offer_token: offer ? offerToken : null,
      })
      saveContact(contact)
      return r
    })
    if (out?.token)
      location.assign(
        `${site('meals/signup/')}?t=${encodeURIComponent(out.token)}`,
      )
    else cal.reload()
  }

  return (
    <div class="stack mt">
      {offer && (
        <Notice tone="success" title={`Thank you, ${firstName(offer.name)}!`}>
          <p>
            Pick an open slot for your offer
            {offerMeals.length
              ? `: ${offerMeals.map(c => c.label.toLowerCase()).join(', ')}`
              : ''}
            . Your details are already filled in.
          </p>
        </Notice>
      )}

      <section class="card stack">
        <DietaryNeeds
          settings={settings}
          heading="The family’s dietary needs"
        />
        <DropOffNote />
      </section>

      <section class="stack" aria-labelledby="mt-cal-title">
        <div class="spread">
          <h2 class="h3" id="mt-cal-title">
            Pick an open slot
          </h2>
          <div class="row mt-nav">
            <Button
              size="sm"
              onClick={() => setFrom(addDays(from, -DAYS))}
              disabled={from <= first}
              aria-label="Earlier dates"
            >
              ‹ Earlier
            </Button>
            <span class="meta mt-range">
              {fmtDay(from)} – {fmtDay(addDays(from, DAYS - 1))}
            </span>
            <Button
              size="sm"
              onClick={() => setFrom(addDays(from, DAYS))}
              disabled={from >= last}
              aria-label="Later dates"
            >
              Later ›
            </Button>
          </div>
        </div>
        <MealLegend />

        {cal.data?.blackout && (
          <Notice tone="warn">{settings.blackoutMessage}</Notice>
        )}
        {cal.data?.paused && (
          <Notice tone="warn" title="Sign-ups are paused right now">
            <p>
              The family has paused new requests for a little while. Please
              check back soon. Approved drop-offs still stand.
            </p>
          </Notice>
        )}
        <ErrorText error={cal.error} />

        {cal.loading && !cal.data ? (
          <Loading />
        ) : (
          <div class={`mt-weeks${cal.loading ? ' is-loading' : ''}`}>
            {weeks.map(w => (
              <div class="mt-week" key={w.start}>
                <h3 class="mt-week-title">
                  {fmtDay(w.start)} – {fmtDay(addDays(w.start, 6))}
                </h3>
                <div
                  class="mt-grid"
                  style={`--mt-cols:${settings.slots.length || 3}`}
                >
                  <span class="mt-head" aria-hidden="true" />
                  {settings.slots.map(s => (
                    <span class="mt-head" key={s.key}>
                      {s.label}
                      <span>{clockWindow(s.start, s.end)}</span>
                    </span>
                  ))}
                  {w.days.map(d => (
                    <DayRow
                      key={d.date}
                      date={d.date}
                      slots={d.slots}
                      today={d.date === today}
                      closed={closed}
                      onPick={c => {
                        signup.setError(null)
                        setPicked(c)
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={!!picked}
        onClose={() => setPicked(null)}
        title="Sign up to bring a meal"
      >
        {picked && (
          <form class="stack" onSubmit={submit}>
            <p class="mt-picked">
              <strong>{picked.label}</strong>, {fmtLongDate(picked.start)},{' '}
              {timeWindow(picked.start, picked.end)}
            </p>
            <DropOffNote />
            <p class="small muted">
              Next, you’ll confirm what you’ll bring and that it follows the
              dietary needs. Please wait to be confirmed and approved before
              asking for the address or stopping by the house.
            </p>
            <ContactFields value={contact} onChange={setContact} />
            {cal.data?.blackout && (
              <Notice tone="warn">{settings.blackoutMessage}</Notice>
            )}
            <ErrorText error={signup.error} />
            <div class="actions">
              <Button
                type="submit"
                variant="primary"
                busy={signup.busy}
                disabled={closed}
              >
                Sign up for this slot
              </Button>
              <Button variant="ghost" onClick={() => setPicked(null)}>
                Back
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

function DayRow({
  date,
  slots,
  today,
  closed,
  onPick,
}: {
  date: string
  slots: CalSlot[]
  today: boolean
  closed: boolean
  onPick: (c: CalSlot) => void
}) {
  const [dow, ...rest] = fmtDay(date).split(', ')
  return (
    <>
      <span class={`mt-day${today ? ' is-today' : ''}`}>
        <strong>{today ? 'Today' : dow}</strong>
        {rest.join(', ')}
      </span>
      {slots.map(c => {
        const text = cellText(c)
        const label = `${fmtDay(c.date)}, ${c.label}: ${c.s === 'purple' ? `taken by ${text}` : text}`
        return c.s === 'green' && !closed ? (
          <button
            type="button"
            key={c.slot}
            class="mt-cell st-green"
            aria-label={`${label}. Sign up`}
            onClick={() => onPick(c)}
          >
            <span>{text}</span>
          </button>
        ) : (
          <span
            key={c.slot}
            class={`mt-cell st-${c.s}`}
            aria-label={label}
            title={text}
            role="img"
          >
            <span>{text}</span>
          </span>
        )
      })}
    </>
  )
}

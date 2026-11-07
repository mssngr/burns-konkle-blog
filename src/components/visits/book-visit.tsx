import { useEffect, useRef, useState } from 'preact/hooks'
import { rpc } from '@/lib/supabase'
import { addDays, fmtDay, mtDate, todayMT, weekStart } from '@/lib/time'
import {
  Button,
  ContactFields,
  ErrorText,
  Legend,
  Loading,
  Notice,
  saveContact,
  site,
  useAction,
  useAsync,
  useContact,
  useQueryParam,
} from '@/lib/ui'
import { Steps } from './parts'
import { TimePicker } from './time-picker'
import {
  emptyTimes,
  firstOpenDate,
  type Limits,
  resolve,
  settle,
  spansDays,
  type Times,
} from './times'
import {
  type BookingType,
  loadBookingTypes,
  loadVisitSettings,
  type VisitCalendar,
} from './types'
import { WeekCalendar } from './week-calendar'

interface Offer {
  name: string
  email: string
  phone: string | null
  choices: { key: string; label: string; destination: string }[]
}

const MAX_WEEKS_AHEAD = 26

/** "Book a Visit": choose a type, pick a time, give your details. Steps 4–6 happen on the request page. */
export function BookVisit() {
  const types = useAsync(loadBookingTypes)
  const settings = useAsync(loadVisitSettings)
  const typeParam = Number(useQueryParam('type')) || null
  const offerToken = useQueryParam('offer')

  const [typeId, setTypeId] = useState<number | null>(typeParam)
  const [choosing, setChoosing] = useState(!typeParam)
  const thisWeek = weekStart(todayMT())
  const [week, setWeek] = useState(thisWeek)
  const [times, setTimes] = useState<Times>(emptyTimes)
  const [contact, setContact] = useContact()
  const [tried, setTried] = useState(false)
  const create = useAction()
  // Stays true once a request is created, until the page navigates away.
  const submitted = useRef(false)
  const [redirecting, setRedirecting] = useState(false)

  const type = types.data?.find(t => t.id === typeId) ?? null

  // Coming from the Offerings form: fill in their details.
  const offer = useAsync(
    () =>
      offerToken
        ? rpc<Offer | null>('get_offer', { p_token: offerToken })
        : Promise.resolve(null),
    [offerToken],
  )
  useEffect(() => {
    const o = offer.data
    if (o)
      setContact(c => ({
        ...c,
        name: o.name || c.name,
        email: o.email || c.email,
        phone: o.phone || c.phone,
      }))
  }, [offer.data, setContact])

  // A ?type= that isn't an active type falls back to choosing.
  useEffect(() => {
    if (types.data && typeId && !type) {
      setTypeId(null)
      setChoosing(true)
    }
  }, [types.data, typeId, type])

  const cal = useAsync(
    () =>
      typeId
        ? rpc<VisitCalendar>('visit_calendar', {
            p_type: typeId,
            p_from: week,
            p_days: 7,
          })
        : Promise.resolve(null),
    [typeId, week],
  )

  if (types.loading || settings.loading) return <Loading />
  if (types.error || settings.error)
    return <ErrorText error={types.error ?? settings.error} />
  const s = settings.data
  const typeList = types.data
  if (!s || !typeList) return null

  const limits: Limits = {
    hours: s.hours,
    minStart: new Date(Date.now() + s.cutoffHours * 3_600_000),
  }
  const picked = type ? resolve(type, limits, times) : null
  const step = !type ? 1 : !picked ? 2 : 3
  const blackout = !!cal.data?.blackout
  const paused = !!cal.data?.paused
  const offerChoices =
    offer.data?.choices.filter(c => c.destination.startsWith('visit:')) ?? []

  function chooseType(t: BookingType) {
    setTypeId(t.id)
    setChoosing(false)
    setTimes(emptyTimes)
    setWeek(thisWeek)
    const u = new URL(location.href)
    u.searchParams.set('type', String(t.id))
    history.replaceState(null, '', u)
    requestAnimationFrame(() =>
      document
        .getElementById('v-when')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  function changeTimes(v: Times) {
    setTimes(v)
    if (v.sd) {
      const w = weekStart(v.sd)
      if (w !== week && w >= thisWeek) setWeek(w)
    }
  }

  function pickSlot(date: string, time: string) {
    if (!type) return
    const ed = spansDays(type) && times.ed >= date ? times.ed : date
    setTimes(settle(type, limits, { ...times, sd: date, st: time, ed }))
  }

  async function submit(e: Event) {
    e.preventDefault()
    if (submitted.current) return
    setTried(true)
    if (!type || !picked || !contact.consent || blackout) return
    submitted.current = true
    const r = await create.run(() =>
      rpc<{ token: string; skipped_rules: boolean }>('create_visit_request', {
        p_type: type.id,
        p_starts_at: picked.start.toISOString(),
        p_ends_at: picked.end.toISOString(),
        p_name: contact.name.trim(),
        p_email: contact.email.trim(),
        p_phone: contact.phone.trim() || null,
        p_consent: contact.consent,
        p_offer_token: offerToken || null,
      }),
    )
    if (!r?.token) {
      submitted.current = false
      return
    }
    setRedirecting(true)
    saveContact(contact)
    location.assign(
      `${site('visits/request/')}?t=${encodeURIComponent(r.token)}${r.skipped_rules ? '&skipped=1' : ''}`,
    )
  }

  const minDate = type ? firstOpenDate(type, limits, todayMT()) : todayMT()

  return (
    <div class="vbook">
      <Steps current={step} />

      {offer.data && (
        <Notice title="Scheduling your offer to help">
          <p>
            {offerChoices.length
              ? `${offerChoices.map(c => c.label).join(', ')}. `
              : ''}
            Your details are filled in from your offer. Pick a time below, and
            the request goes to Micala and Gabriel like any visit.
          </p>
        </Notice>
      )}

      {/* Step 1 */}
      <section class="card stack" aria-labelledby="v-type-h">
        <div class="spread vhead">
          <h2 class="h3 vstep-h" id="v-type-h">
            <span class="vstep-n">1</span> Choose a booking type
          </h2>
          {type && !choosing && (
            <Button size="sm" variant="ghost" onClick={() => setChoosing(true)}>
              Change
            </Button>
          )}
        </div>
        {choosing || !type ? (
          <ul class="vtypes">
            {typeList.map(t => (
              <li key={t.id}>
                <button
                  type="button"
                  class={`vtype${t.id === typeId ? ' is-on' : ''}`}
                  aria-pressed={t.id === typeId}
                  onClick={() => chooseType(t)}
                >
                  <span class="vtype-name">{t.name}</span>
                  <span class="vtype-desc">{t.description}</span>
                  <span class="vtype-facts">
                    <span>
                      <b>People:</b> {t.limit_text}
                    </span>
                    <span>
                      <b>Length:</b> {t.length_text}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div class="vtype-chosen">
            <p class="vtype-name">{type.name}</p>
            <p class="meta">
              {type.limit_text} · {type.length_text}
            </p>
          </div>
        )}
      </section>

      {/* Step 2 */}
      {type && (
        <section class="card stack" id="v-when" aria-labelledby="v-when-h">
          <h2 class="h3 vstep-h" id="v-when-h">
            <span class="vstep-n">2</span> Pick a date and time
          </h2>
          <p class="muted small">
            The colors show openings for this booking type. Tap an open time to
            set “{type.start_label}”, then choose “{type.end_label}”. Requests
            start at least {s.cutoffHours} hours ahead, on 15-minute steps.
            {type.hours_rule === 'none' &&
              ' Trips can start and end at any hour; the calendar shows visiting hours.'}
          </p>

          {blackout && <Notice tone="warn">{s.blackoutMessage}</Notice>}
          {paused && (
            <Notice
              tone="warn"
              title="Booking is paused right now. Please check back soon."
            />
          )}

          <div class="wk-nav">
            <Button
              size="sm"
              disabled={week <= thisWeek}
              onClick={() => setWeek(addDays(week, -7))}
              aria-label="Previous week"
            >
              ‹ Prev
            </Button>
            <p class="wk-range">
              {fmtDay(week)} – {fmtDay(addDays(week, 6))}
            </p>
            <Button
              size="sm"
              disabled={week >= addDays(thisWeek, 7 * MAX_WEEKS_AHEAD)}
              onClick={() => setWeek(addDays(week, 7))}
              aria-label="Next week"
            >
              Next ›
            </Button>
          </div>

          {cal.loading && !cal.data ? (
            <Loading label="Loading the calendar…" />
          ) : cal.error ? (
            <ErrorText error={cal.error} />
          ) : cal.data ? (
            <div class={cal.loading ? 'is-loading' : ''}>
              {cal.data.weeks[mtDate(cal.data.from)] >= cal.data.weekly_cap && (
                <Notice tone="warn">
                  This week has reached {cal.data.weekly_cap} visitors. Anyone
                  already visiting this week can still book.
                </Notice>
              )}
              <WeekCalendar
                cal={cal.data}
                from={mtDate(cal.data.from)}
                selected={picked}
                focus={times.sd}
                onPick={pickSlot}
              />
            </div>
          ) : null}

          <div class="wk-key">
            <Legend />
            <p class="small muted">
              <strong>Red</strong> means not available: outside visiting hours,
              less than {s.cutoffHours} hours away, blocked by the family,
              paused, or the week already has {cal.data?.weekly_cap ?? 25}{' '}
              visitors. Yellow and orange requests aren’t approved yet, so those
              times can still be requested.
            </p>
          </div>

          <TimePicker
            type={type}
            limits={limits}
            value={times}
            onChange={changeTimes}
            minDate={minDate}
          />
        </section>
      )}

      {/* Step 3 */}
      {type && picked && (
        <form class="card stack" onSubmit={submit} aria-labelledby="v-you-h">
          <h2 class="h3 vstep-h" id="v-you-h">
            <span class="vstep-n">3</span> Your details
          </h2>
          <p class="muted small">
            Saving your request holds the time (it shows yellow) while you agree
            to the house rules and answer a few questions. Have a profile?{' '}
            <a
              href={`${site('signin/')}?next=${encodeURIComponent(location.pathname + location.search)}`}
            >
              Sign in
            </a>{' '}
            to save time.
          </p>
          <ContactFields value={contact} onChange={setContact} />
          {tried && !contact.consent && (
            <p class="ff-error">
              Please check the box so we can email you about your request.
            </p>
          )}
          <ErrorText error={create.error} />
          <div class="actions">
            <Button
              type="submit"
              variant="primary"
              busy={create.busy || redirecting}
              disabled={blackout || paused}
            >
              Save and continue
            </Button>
            <span class="meta">
              {blackout
                ? 'Booking is closed from midnight to 4 AM.'
                : paused
                  ? 'Booking is paused.'
                  : 'Next: house rules and questions'}
            </span>
          </div>
        </form>
      )}
    </div>
  )
}

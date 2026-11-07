import { fmtClock, fmtRange, mtDate } from '@/lib/time'
import { Field, Input, Select } from '@/lib/ui'
import {
  endOptions,
  type Limits,
  lastEndDate,
  resolve,
  settle,
  spansDays,
  startOf,
  startOptions,
  type Times,
} from './times'
import type { BookingType } from './types'

/** Date and time pickers for a booking: start (date + time) and end (time, or date + time for multi-day types). */
export function TimePicker({
  type,
  limits,
  value,
  onChange,
  minDate,
}: {
  type: BookingType
  limits: Limits
  value: Times
  onChange: (v: Times) => void
  /** Earliest date in the date pickers. */
  minDate?: string
}) {
  const multi = spansDays(type)
  const starts = startOptions(type, limits, value.sd)
  const start = startOf(value)
  const endDate = multi ? value.ed : value.sd
  const ends = endOptions(type, limits, start, endDate)
  const maxEnd = value.sd ? lastEndDate(type, value.sd, limits) : undefined
  const minStartDate =
    minDate ?? (limits.inside ? mtDate(limits.inside.from) : undefined)
  const maxStartDate = limits.inside ? mtDate(limits.inside.to) : undefined
  const ok = resolve(type, limits, value)

  const set = (patch: Partial<Times>) =>
    onChange(settle(type, limits, { ...value, ...patch }))

  return (
    <div class="tp">
      <fieldset class="tp-group">
        <legend class="ff-label">{type.start_label}</legend>
        <div class="tp-row">
          <Field label="Date">
            <Input
              type="date"
              value={value.sd}
              min={minStartDate}
              max={maxStartDate}
              onInput={(e: Event) =>
                set({ sd: (e.currentTarget as HTMLInputElement).value })
              }
            />
          </Field>
          <Field label="Time">
            <Select
              value={value.st}
              disabled={!value.sd || !starts.length}
              onChange={(e: Event) =>
                set({ st: (e.currentTarget as HTMLSelectElement).value })
              }
            >
              <option value="">
                {!value.sd
                  ? 'Pick a date first'
                  : starts.length
                    ? 'Choose…'
                    : 'No times left'}
              </option>
              {starts.map(c => (
                <option key={c} value={c}>
                  {fmtClock(c)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>
      <fieldset class="tp-group">
        <legend class="ff-label">{type.end_label}</legend>
        <div class="tp-row">
          {multi && (
            <Field label="Date">
              <Input
                type="date"
                value={value.ed}
                min={value.sd || minStartDate}
                max={maxEnd}
                disabled={!start}
                onInput={(e: Event) =>
                  set({ ed: (e.currentTarget as HTMLInputElement).value })
                }
              />
            </Field>
          )}
          <Field label="Time">
            <Select
              value={value.et}
              disabled={!start || !ends.length}
              onChange={(e: Event) =>
                set({ et: (e.currentTarget as HTMLSelectElement).value })
              }
            >
              <option value="">
                {!start
                  ? `Pick “${type.start_label}” first`
                  : ends.length
                    ? 'Choose…'
                    : 'No times work'}
              </option>
              {ends.map(c => (
                <option key={c} value={c}>
                  {fmtClock(c)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>
      {value.sd && !starts.length && (
        <p class="ff-hint">
          No start times are left on that day. Please pick another date.
        </p>
      )}
      {start && endDate && !ends.length && (
        <p class="ff-hint">
          No end times work on that day.
          {type.max_minutes != null &&
            ` ${type.name} can be up to ${type.length_text.split(';')[0]}.`}
        </p>
      )}
      {ok && (
        <p class="tp-summary">
          <span class="muted">Your time:</span>{' '}
          <strong>{fmtRange(ok.start, ok.end)}</strong>
        </p>
      )}
    </div>
  )
}

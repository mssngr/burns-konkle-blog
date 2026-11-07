import { useState } from 'preact/hooks'
import { rpc } from '@/lib/supabase'
import { Button, ErrorText, Field, Input, Notice, useAction } from '@/lib/ui'
import { Section } from './fields'

export function TestDataSettings() {
  const [typed, setTyped] = useState('')
  const act = useAction()
  const ready = typed.trim().toLowerCase() === 'clear'

  const onClear = () =>
    act.run(async () => {
      await rpc('family_clear_test_data')
      setTyped('')
    }, 'Test data cleared')

  return (
    <Section
      title="Test data"
      lede="Before sharing the site more widely, clear the bookings the family made while testing."
    >
      <Notice tone="warn" title="Clear test bookings deletes, for everyone:">
        <ul class="set-bullets">
          <li>
            Every visit request, stay, Colorado trip, and outing, with its rule
            agreements, approvals, and change requests
          </li>
          <li>Every Meal Train sign-up</li>
          <li>Every offer of help and its replies</li>
          <li>Every Family &amp; Friends note</li>
          <li>Every email in Sent emails</li>
          <li>
            Every guest’s name, email, and phone, except flagged guests (flags
            and bans are kept)
          </li>
        </ul>
      </Notice>
      <p class="small muted">
        It keeps settings, rules, booking types, message wording, Meal Train
        dates, blocked times, the family schedule, updates, the registry, guest
        profiles, and the activity log. Photos attached to notes stay in
        storage. This can’t be undone.
      </p>
      <Field label="Type “clear” to confirm">
        <Input
          value={typed}
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          onInput={(e: Event) =>
            setTyped((e.currentTarget as HTMLInputElement).value)
          }
        />
      </Field>
      <ErrorText error={act.error} />
      <div class="actions">
        <Button
          variant="danger"
          busy={act.busy}
          disabled={!ready}
          onClick={onClear}
        >
          Clear test bookings
        </Button>
      </div>
    </Section>
  )
}

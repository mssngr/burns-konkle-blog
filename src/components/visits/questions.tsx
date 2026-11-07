import { useState } from 'preact/hooks'
import { rpc } from '@/lib/supabase'
import { Button, ErrorText, Field, Input, TextArea, useAction } from '@/lib/ui'
import {
  AttendeeEditor,
  attendeesComplete,
  cleanAttendees,
  useCompanions,
} from './parts'
import { type Attendee, peopleLabel, type VisitRequest } from './types'

/** Step 5: everyone coming, what they'll bring, anything else, and the type's own questions. */
export function Questions({
  req,
  onSaved,
}: {
  req: VisitRequest
  onSaved: () => void
}) {
  const companions = useCompanions()
  const t = req.type
  const [people, setPeople] = useState<Attendee[]>(() =>
    req.attendees.length
      ? req.attendees.map(a => ({
          name: a.name,
          age: a.age ?? '',
          relationship: a.relationship ?? '',
        }))
      : [{ name: req.name, age: '', relationship: '' }],
  )
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({
    ...req.answers,
  }))
  const [tried, setTried] = useState(false)
  const save = useAction()

  const set = (k: string) => (e: Event) =>
    setAnswers(a => ({
      ...a,
      [k]: (e.currentTarget as HTMLInputElement).value,
    }))
  const missing = (k: string) => tried && !answers[k]?.trim()
  const peopleOk =
    attendeesComplete(cleanAttendees(people)) &&
    people.every(p => !p.name.trim() || p.relationship?.trim())
  const ok =
    peopleOk &&
    !!answers.bring?.trim() &&
    t.questions.every(q => !q.required || answers[q.key]?.trim()) &&
    cleanAttendees(people).length <= req.max_people

  async function submit(e: Event) {
    e.preventDefault()
    setTried(true)
    if (!ok) return
    const clean = Object.fromEntries(
      Object.entries(answers)
        .map(([k, v]) => [k, (v ?? '').trim()])
        .filter(([, v]) => v),
    )
    const r = await save.run(() =>
      rpc<{ answers_complete: boolean }>('save_visit_answers', {
        p_token: req.token,
        p_attendees: cleanAttendees(people),
        p_answers: clean,
      }),
    )
    if (r) onSaved()
  }

  return (
    <form class="stack" onSubmit={submit}>
      <fieldset class="vq-group">
        <legend class="ff-label">{peopleLabel(t)}</legend>
        <p class="ff-hint">
          Include yourself. Everyone counts toward the limit ({t.limit_text}),
          except Micala, Gabriel, Vincent, and the baby. Please list everyone;
          surprises are hard right now.
        </p>
        <AttendeeEditor
          value={people}
          onChange={setPeople}
          max={req.max_people}
          companions={companions}
          showErrors={tried}
        />
        {tried && !peopleOk && (
          <span class="ff-error">
            Please give each person’s full name and relationship to the family.
          </span>
        )}
      </fieldset>

      <Field
        label="Anything you plan to bring (food, gifts, supplies)"
        error={
          missing('bring') ? 'Please answer this one. “Nothing” is fine.' : null
        }
      >
        <TextArea
          value={answers.bring ?? ''}
          onInput={set('bring')}
          maxLength={1000}
        />
      </Field>

      {t.questions.map(q => (
        <Field
          key={q.key}
          label={q.label}
          optional={!q.required}
          error={
            q.required && missing(q.key) ? 'Please answer this one.' : null
          }
        >
          {q.kind === 'textarea' ? (
            <TextArea
              value={answers[q.key] ?? ''}
              onInput={set(q.key)}
              maxLength={2000}
            />
          ) : (
            <Input
              value={answers[q.key] ?? ''}
              onInput={set(q.key)}
              maxLength={200}
            />
          )}
        </Field>
      ))}

      <Field label="Anything else the family should know" optional>
        <TextArea
          value={answers.notes ?? ''}
          onInput={set('notes')}
          maxLength={2000}
        />
      </Field>

      <ErrorText error={save.error} />
      <div class="actions">
        <Button type="submit" variant="primary" busy={save.busy}>
          Save and review
        </Button>
      </div>
    </form>
  )
}

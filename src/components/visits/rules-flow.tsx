import { useState } from 'preact/hooks'
import { rpc } from '@/lib/supabase'
import { Button, Check, ErrorText, useAction } from '@/lib/ui'
import type { RuleItem } from './types'

const longDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})
export const fmtUpdated = (iso: string | null) =>
  iso ? longDate.format(new Date(iso)) : ''

/**
 * Step 4: every rule on its own, each with its own unchecked "Yes, I agree" box.
 * No agree-all. Each check is saved right away.
 *
 * `fresh` walks through every rule with every box unchecked (used when rules
 * changed and the guest has to agree again); otherwise it picks up where they left off.
 */
export function RulesFlow({
  token,
  rules,
  updatedAt,
  fresh,
  onDone,
  doneLabel = 'Continue to questions',
}: {
  token: string
  rules: RuleItem[]
  updatedAt: string | null
  fresh: boolean
  onDone: () => void
  doneLabel?: string
}) {
  const [agreed, setAgreed] = useState<Set<string>>(
    () => new Set(fresh ? [] : rules.filter(r => r.agreed).map(r => r.id)),
  )
  const [idx, setIdx] = useState(() => {
    const i = rules.findIndex(r => !agreed.has(r.id))
    return i === -1 ? 0 : i
  })
  const save = useAction()
  const rule = rules[idx]
  const total = rules.length
  const allDone = rules.every(r => agreed.has(r.id))
  const last = idx === total - 1

  async function agree(r: RuleItem) {
    const ok = await save.run(async () => {
      await rpc('agree_rule', { p_token: token, p_rule: r.id })
      return true
    })
    if (ok) setAgreed(s => new Set(s).add(r.id))
  }

  if (!rule) return null
  const isConfirm = rule.kind === 'confirmation'
  const checked = agreed.has(rule.id)

  return (
    <div class="rules-flow">
      <div class="spread">
        <p class="meta">
          {isConfirm
            ? 'Final confirmation'
            : `Rule ${idx + 1} of ${total - rules.filter(r => r.kind === 'confirmation').length}`}
        </p>
        {updatedAt && <p class="meta">Last updated {fmtUpdated(updatedAt)}</p>}
      </div>
      <ol class="rules-dots" aria-label="Progress">
        {rules.map((r, i) => (
          <li
            key={r.id}
            class={`${agreed.has(r.id) ? 'is-done' : ''}${i === idx ? ' is-current' : ''}`}
          >
            <button
              type="button"
              onClick={() => setIdx(i)}
              disabled={i > idx && !agreed.has(rules[i - 1]?.id)}
              aria-label={`${r.title}${agreed.has(r.id) ? ', agreed' : ''}`}
            />
          </li>
        ))}
      </ol>

      <article
        class={`rule-card${isConfirm ? ' is-confirm' : ''}`}
        key={rule.id}
      >
        <header class="rule-head">
          <h3>{rule.title}</h3>
          {rule.label && (
            <span
              class={`pill ${rule.label === 'New' ? 'pill-blue' : 'pill-orange'}`}
            >
              {rule.label}
            </span>
          )}
        </header>
        {!isConfirm && <p class="rule-body">{rule.body}</p>}
        <div class={`rule-check${checked ? ' is-checked' : ''}`}>
          <Check
            checked={checked}
            disabled={checked || save.busy}
            onChange={v => v && agree(rule)}
          >
            {isConfirm ? rule.body : 'Yes, I agree'}
          </Check>
        </div>
      </article>

      <ErrorText error={save.error} />

      <div class="actions rules-nav">
        <Button disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>
          Back
        </Button>
        {last ? (
          <Button variant="primary" disabled={!allDone} onClick={onDone}>
            {doneLabel}
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={!checked}
            onClick={() => setIdx(i => i + 1)}
          >
            Next rule
          </Button>
        )}
      </div>
      {last && !allDone && checked && (
        <p class="ff-hint">
          Some rules above still need a check. Use Back to find them.
        </p>
      )}
    </div>
  )
}

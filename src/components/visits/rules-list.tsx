import { query, supabase } from '@/lib/supabase'
import { ErrorText, Loading, site, useAsync } from '@/lib/ui'
import { fmtUpdated } from './rules-flow'
import { loadVisitSettings } from './types'

interface Rule {
  id: string
  position: number
  title: string
  body: string
  kind: 'rule' | 'confirmation'
}

/** The public house rules, in order, read from the rules table. */
export function RulesList() {
  const rules = useAsync(() =>
    query<Rule[]>(
      supabase
        .from('rules')
        .select('id, position, title, body, kind')
        .eq('active', true)
        .order('position'),
    ),
  )
  const settings = useAsync(loadVisitSettings)

  if (rules.loading) return <Loading />
  if (rules.error) return <ErrorText error={rules.error} />
  const all = rules.data ?? []
  const list = all.filter(r => r.kind === 'rule')
  const confirm = all.filter(r => r.kind === 'confirmation')

  return (
    <div class="stack">
      {settings.data?.rulesUpdatedAt && (
        <p class="rules-updated">
          Last updated {fmtUpdated(settings.data.rulesUpdatedAt)}
        </p>
      )}
      <ol class="rules-list">
        {list.map(r => (
          <li key={r.id} class="rules-item">
            <h2>{r.title}</h2>
            <p>{r.body}</p>
          </li>
        ))}
      </ol>
      {confirm.map(r => (
        <section key={r.id} class="card rules-confirm">
          <h2 class="h3">{r.title}</h2>
          <p>Every guest also checks one last box for their whole group:</p>
          <blockquote>{r.body}</blockquote>
        </section>
      ))}
      <p class="muted">
        Gabriel, Micala, Vincent, or Samantha may ask anyone breaking a rule to
        leave. Ready to visit? <a href={site('visits/')}>Book a visit</a>.
      </p>
    </div>
  )
}

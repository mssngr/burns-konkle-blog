// Settings: one section at a time, each saving on its own. The section is kept in the URL hash.
import type { ComponentChildren } from 'preact'
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { FamilyGate } from '@/components/auth/family-gate'
import type { FamilyStatus } from '@/lib/auth'
import { BookingTypeSettings } from './booking-types'
import { AllAccounts, FamilySettings } from './family-accounts'
import { GeneralSettings } from './general'
import { MealSettings } from './meals'
import { MessageSettings } from './messages'
import { OfferingSettings } from './offerings'
import { RulesSettings } from './rules'
import { TestDataSettings } from './test-data'

const SECTIONS = [
  ['general', 'General'],
  ['rules', 'Rules'],
  ['booking-types', 'Booking types'],
  ['meal-train', 'Meal Train'],
  ['messages', 'Messages'],
  ['offerings', 'Offerings form'],
  ['family', 'Family accounts'],
  ['test-data', 'Test data'],
] as const
type Key = (typeof SECTIONS)[number][0]

const fromHash = (): Key => {
  const h = location.hash.slice(1)
  return (SECTIONS.find(([k]) => k === h)?.[0] ?? 'general') as Key
}

function Settings({ me }: { me: FamilyStatus }) {
  const [active, setActive] = useState<Key>(fromHash)
  const [visited, setVisited] = useState<Set<Key>>(() => new Set([fromHash()]))
  const [dirty, setDirty] = useState<Set<Key>>(new Set())

  const go = useCallback((k: Key) => {
    setActive(k)
    setVisited(v => (v.has(k) ? v : new Set(v).add(k)))
    history.replaceState(null, '', `#${k}`)
  }, [])

  useEffect(() => {
    const onHash = () => go(fromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [go])

  // One stable callback per section, so sections can report unsaved changes.
  const reporters = useMemo(
    () =>
      Object.fromEntries(
        SECTIONS.map(([k]) => [
          k,
          (d: boolean) =>
            setDirty(prev => {
              if (prev.has(k) === d) return prev
              const next = new Set(prev)
              if (d) next.add(k)
              else next.delete(k)
              return next
            }),
        ]),
      ) as Record<Key, (d: boolean) => void>,
    [],
  )

  const anyDirty = dirty.size > 0
  const warn = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault()
    e.returnValue = ''
  }, [])
  useEffect(() => {
    if (!anyDirty) return
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [anyDirty, warn])

  const panels: Record<Key, () => ComponentChildren> = {
    general: () => <GeneralSettings onDirty={reporters.general} />,
    rules: () => <RulesSettings onDirty={reporters.rules} />,
    'booking-types': () => <BookingTypeSettings />,
    'meal-train': () => <MealSettings onDirty={reporters['meal-train']} />,
    messages: () => <MessageSettings onDirty={reporters.messages} />,
    offerings: () => <OfferingSettings onDirty={reporters.offerings} />,
    family: () => (
      <>
        <FamilySettings me={me} />
        <AllAccounts />
      </>
    ),
    'test-data': () => <TestDataSettings />,
  }

  return (
    <div class="set-layout">
      <nav class="set-nav" aria-label="Settings sections">
        <ul>
          {SECTIONS.map(([k, label]) => (
            <li key={k}>
              <a
                href={`#${k}`}
                class="set-nav-link"
                aria-current={active === k ? 'page' : undefined}
                onClick={(e: MouseEvent) => {
                  e.preventDefault()
                  go(k)
                }}
              >
                {label}
                {dirty.has(k) && (
                  <span class="set-dot" title="Unsaved changes">
                    <span class="sr-only"> (unsaved changes)</span>
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div class="set-panels">
        {SECTIONS.filter(([k]) => visited.has(k)).map(([k]) => (
          <div key={k} hidden={active !== k}>
            {panels[k]()}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SettingsApp() {
  return <FamilyGate admin>{family => <Settings me={family} />}</FamilyGate>
}

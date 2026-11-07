import { useEffect, useState } from 'preact/hooks'
import { familyModules, ICONS, type IconName } from '@/data/modules'
import { signOut, useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { site } from '@/lib/ui'

export const Icon = ({ name }: { name: IconName }) => (
  <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
)

/** The family half of the sidebar, plus the account link. Shown once auth is known. */
export function FamilyNav({ active }: { active?: string }) {
  const { loading, session, family } = useAuth()
  if (loading) return null

  return (
    <>
      {family?.verified && (
        <nav class="nav-group" aria-label="Family">
          <p class="nav-heading">Family</p>
          <ul>
            {familyModules
              .filter(m => !m.admin || family.role === 'admin')
              .map(m => (
                <li key={m.key}>
                  <a
                    href={site(m.href)}
                    class="nav-link"
                    aria-current={active === m.key ? 'page' : undefined}
                  >
                    <Icon name={m.icon} />
                    {m.label}
                  </a>
                </li>
              ))}
          </ul>
        </nav>
      )}
      <div class="nav-account">
        {session ? (
          <>
            <a
              href={site(family ? 'family/' : 'profile/')}
              class="nav-link"
              aria-current={active === 'profile' ? 'page' : undefined}
            >
              <Icon name="user" />
              <span class="nav-account-name">
                {family?.display_name ?? session.user.email}
              </span>
            </a>
            <button
              type="button"
              class="linklike"
              onClick={() => signOut().then(() => location.assign(site('')))}
            >
              Sign out
            </button>
          </>
        ) : (
          <a
            href={site('signin/')}
            class="nav-link"
            aria-current={active === 'signin' ? 'page' : undefined}
          >
            <Icon name="user" />
            Sign in
          </a>
        )}
      </div>
    </>
  )
}

const PHOTO_NOTICE =
  'Photos & privacy: No pictures without permission, and nothing posted to social media. No pictures of the baby or Vincent posted, ever. Always ask consent before taking your own pictures in the home or featuring either kiddo. Thank you for respecting this boundary!'

/** The notice at the top of every calendar page; Admins can edit it in Settings. */
export function PhotoNotice() {
  const [text, setText] = useState(PHOTO_NOTICE)
  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'photo_notice')
      .maybeSingle()
      .then(
        ({ data }) =>
          typeof data?.value === 'string' &&
          data.value.trim() &&
          setText(data.value),
      )
  }, [])
  const [head, ...rest] = text.split(':')
  return (
    <p class="photo-notice" role="note">
      {rest.length ? (
        <>
          <strong>{head}:</strong>
          {rest.join(':')}
        </>
      ) : (
        text
      )}
    </p>
  )
}

/** Test-mode and pause banners, read from public settings. */
export function SiteStatus() {
  const [s, setS] = useState<{ test_mode?: boolean; paused?: boolean }>({})
  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['test_mode', 'paused'])
      .then(({ data }) => {
        const o: Record<string, boolean> = {}
        for (const r of data ?? []) o[r.key] = r.value === true
        setS(o)
      })
  }, [])
  return (
    <>
      {s.test_mode && (
        <p class="banner banner-test">
          <strong>Test mode.</strong> The family is trying things out. Bookings
          made now are practice and will be cleared.
        </p>
      )}
      {s.paused && (
        <p class="banner banner-paused">
          <strong>Bookings are paused.</strong> The family needs some quiet
          time. Please check back soon.
        </p>
      )}
    </>
  )
}

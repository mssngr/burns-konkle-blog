import type { ComponentChildren } from 'preact'
import { ConfirmBanner } from '@/components/auth/confirm-email'
import { type FamilyStatus, useAuth } from '@/lib/auth'
import { Loading, Notice, site } from '@/lib/ui'

/**
 * Shows its children only to a signed-in family member with a confirmed email.
 * `admin` limits it to Gabriel and Micala. The database enforces the same rules;
 * this just keeps the page friendly.
 */
export function FamilyGate({
  admin,
  children,
}: {
  admin?: boolean
  children: (f: FamilyStatus) => ComponentChildren
}) {
  const { loading, session, family } = useAuth()
  if (loading) return <Loading />
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search)
    return (
      <Notice title="This page is for the family">
        <p>
          <a href={`${site('signin/')}?next=${next}`}>Sign in</a> with your
          family account to continue.
        </p>
      </Notice>
    )
  }
  if (!family) {
    return (
      <Notice title="This page is for the family">
        <p>
          You’re signed in as {session.user.email}, which isn’t a family
          account.
        </p>
      </Notice>
    )
  }
  if (!family.confirmed)
    return <ConfirmBanner title="Confirm your email to open family pages" />
  if (admin && family.role !== 'admin') {
    return <Notice title="Only Gabriel and Micala can open this page" />
  }
  return <>{children(family)}</>
}

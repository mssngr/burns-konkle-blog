import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'preact/hooks'
import { configured, supabase } from '@/lib/supabase'

export type Person = 'gabriel' | 'micala' | 'vincent' | 'samantha'
export type Role = 'admin' | 'elevated'

export interface FamilyStatus {
  person: Person
  display_name: string
  role: Role
  /** Email confirmed. Until then the account is read-only and sees no private data. */
  confirmed: boolean
}

export interface AuthState {
  loading: boolean
  session: Session | null
  /** The signed-in email has been confirmed. Unconfirmed accounts can look but not change anything. */
  confirmed: boolean
  /** Arrived from a password-reset link: ask for a new password. */
  recovering: boolean
  /**
   * The account has a password. People who signed up before passwords existed don't.
   * True when signed out or when we can't tell, so nobody is nagged by mistake.
   */
  hasPassword: boolean
  /** Set when the signed-in email belongs to Gabriel, Micala, Vincent or Samantha. */
  family: FamilyStatus | null
}

let state: AuthState = {
  loading: true,
  session: null,
  confirmed: false,
  recovering: false,
  hasPassword: true,
  family: null,
}
const listeners = new Set<(s: AuthState) => void>()

function emit(next: AuthState) {
  state = next
  for (const l of listeners) l(state)
}

async function refresh(session: Session | null) {
  let family: FamilyStatus | null = null
  let confirmed = false
  let hasPassword = true
  if (session) {
    const [status, mine, password] = await Promise.all([
      supabase.rpc('my_family_status'),
      supabase.rpc('my_email_confirmed'),
      supabase.rpc('my_has_password'),
    ])
    family = (status.data as FamilyStatus | null) ?? null
    confirmed = mine.data === true
    // Only an explicit "no" counts: an error must not tell people with passwords to set one.
    hasPassword = password.data !== false
  }
  emit({ loading: false, session, confirmed, recovering, hasPassword, family })
}

/** Set while the person is on a password-reset link and needs to choose a new password. */
// Read the URL now: Supabase can fire PASSWORD_RECOVERY before our listener exists.
let recovering = /type=recovery/.test(location.hash)

let started = false
function start() {
  if (started) return
  started = true
  if (!configured) {
    emit({
      loading: false,
      session: null,
      confirmed: false,
      recovering: false,
      hasPassword: true,
      family: null,
    })
    return
  }
  supabase.auth.getSession().then(({ data }) => refresh(data.session))
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return
    if (event === 'PASSWORD_RECOVERY') recovering = true
    if (event === 'SIGNED_OUT') recovering = false
    // Defer: calling Supabase inside this callback can deadlock the auth lock.
    setTimeout(() => refresh(session), 0)
  })
}

export function getAuth(): AuthState {
  start()
  return state
}

/** Resolves once the first auth check is done. */
export function authReady(): Promise<AuthState> {
  start()
  if (!state.loading) return Promise.resolve(state)
  return new Promise(resolve => {
    const l = (s: AuthState) => {
      if (!s.loading) {
        listeners.delete(l)
        resolve(s)
      }
    }
    listeners.add(l)
  })
}

export function useAuth(): AuthState {
  const [s, set] = useState(getAuth)
  useEffect(() => {
    listeners.add(set)
    set(state)
    return () => {
      listeners.delete(set)
    }
  }, [])
  return s
}

/** Re-check family and confirmation status, e.g. after the email is confirmed. */
export async function reloadAuth() {
  const { data } = await supabase.auth.getSession()
  await refresh(data.session)
}

/** Called once the new password is saved. */
export function doneRecovering() {
  recovering = false
  emit({ ...state, recovering: false })
}

export async function signOut() {
  await supabase.auth.signOut()
  await refresh(null)
}

export const isAdmin = (f: FamilyStatus | null) =>
  !!f?.confirmed && f.role === 'admin'
export const isFamily = (f: FamilyStatus | null) => !!f?.confirmed

export const FAMILY_NAMES: Record<Person, string> = {
  gabriel: 'Gabriel',
  micala: 'Micala',
  vincent: 'Vincent',
  samantha: 'Samantha',
}

/** "gabriel" → "Gabriel"; "guest: Ann Lee" → "Ann Lee"; "system" → "The site" */
export function personName(p: string | null | undefined): string {
  if (!p) return ''
  if (p in FAMILY_NAMES) return FAMILY_NAMES[p as Person]
  if (p.startsWith('guest: ')) return p.slice(7)
  if (p === 'system') return 'The site'
  if (p === 'guest') return 'Guest'
  return p
}

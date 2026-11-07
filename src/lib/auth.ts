import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'preact/hooks'
import { configured, supabase } from '@/lib/supabase'

export type Person = 'gabriel' | 'micala' | 'vincent' | 'samantha'
export type Role = 'admin' | 'elevated'

export interface FamilyStatus {
  person: Person
  display_name: string
  role: Role
  /** Signed in with two-step verification (required to see private data). */
  verified: boolean
}

export interface AuthState {
  loading: boolean
  session: Session | null
  /** Set when the signed-in email belongs to Gabriel, Micala, Vincent or Samantha. */
  family: FamilyStatus | null
}

let state: AuthState = { loading: true, session: null, family: null }
const listeners = new Set<(s: AuthState) => void>()

function emit(next: AuthState) {
  state = next
  for (const l of listeners) l(state)
}

async function refresh(session: Session | null) {
  let family: FamilyStatus | null = null
  if (session) {
    const { data } = await supabase.rpc('my_family_status')
    family = (data as FamilyStatus | null) ?? null
  }
  emit({ loading: false, session, family })
}

let started = false
function start() {
  if (started) return
  started = true
  if (!configured) {
    emit({ loading: false, session: null, family: null })
    return
  }
  supabase.auth.getSession().then(({ data }) => refresh(data.session))
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') return
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

/** Re-check family status, e.g. after two-step verification raises the session to aal2. */
export async function reloadAuth() {
  const { data } = await supabase.auth.getSession()
  await refresh(data.session)
}

export async function signOut() {
  await supabase.auth.signOut()
  await refresh(null)
}

export const isAdmin = (f: FamilyStatus | null) =>
  !!f?.verified && f.role === 'admin'
export const isFamily = (f: FamilyStatus | null) => !!f?.verified

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

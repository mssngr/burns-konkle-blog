import { BASKET, PANTRY_ID } from '@/config'

export interface Claim {
  by: string
  anon?: boolean
  /** Random per-browser token, so the claimer (and only them) sees "Undo". */
  t: string
  at: number
  released?: boolean
}

/**
 * claim key → claimer token → claim. Each guest only ever writes under their own token,
 * and Pantry's PUT deep-merges, so simultaneous writes never clobber each other.
 * The earliest active claim on a key wins.
 */
export type Claims = Record<string, Record<string, Claim>>

/** Family-only bookkeeping for the thank-you list. */
export interface Thanks {
  /** `${claimKey}|${token}` → the gift arrived. */
  gifts?: Record<string, boolean>
  /** guest key → thank-you sent. */
  guests?: Record<string, boolean>
}

export interface Basket {
  claims?: Claims
  thanks?: Thanks
}

export const isActive = (c?: Claim): c is Claim =>
  !!c && typeof c === 'object' && !!c.t && !c.released

const ENDPOINT = `https://getpantry.cloud/apiv1/pantry/${PANTRY_ID}/basket/${BASKET}`
/** Pantry allows ~2 requests before a ~10s lockout, so space ours out. */
const REQUEST_GAP_MS = 3_000
const RETRY_DELAYS_MS = [4_000, 8_000, 12_000, 16_000, 24_000, 30_000]

class FatalError extends Error {}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

let nextSlot = 0
let chain: Promise<unknown> = Promise.resolve()

/** Run requests one at a time, at least REQUEST_GAP_MS apart. */
function schedule<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = nextSlot - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      return await job()
    } finally {
      nextSlot = Date.now() + REQUEST_GAP_MS
    }
  })
  chain = run.catch(() => {})
  return run
}

async function once(method: 'GET' | 'PUT', body?: unknown): Promise<Basket> {
  const res = await fetch(ENDPOINT, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.ok) return (await res.json()) as Basket
  if (res.status !== 429 && res.status < 500)
    throw new FatalError(`Registry error ${res.status}`)
  throw new Error(`Registry busy (${res.status})`)
}

/**
 * Pantry answers rate-limited requests with a 429 that has no CORS headers, so the browser
 * reports it as a network error. Retry those with backoff.
 */
export async function request(
  method: 'GET' | 'PUT',
  body?: unknown,
  onBusy?: () => void,
): Promise<Basket> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await schedule(() => once(method, body))
    } catch (e) {
      if (e instanceof FatalError || attempt >= RETRY_DELAYS_MS.length) throw e
      onBusy?.()
      await sleep(RETRY_DELAYS_MS[attempt])
    }
  }
}

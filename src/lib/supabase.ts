import { createClient } from '@supabase/supabase-js'

// Local defaults are the Supabase CLI's well-known development values (not secrets).
const LOCAL_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const url =
  import.meta.env.PUBLIC_SUPABASE_URL || (import.meta.env.DEV ? LOCAL_URL : '')
const key =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  (import.meta.env.DEV ? LOCAL_ANON_KEY : '')

/** False when the production build has no Supabase project configured yet. */
export const configured = Boolean(url && key)

export const supabase = createClient(
  url || 'http://localhost',
  key || 'missing',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export class AppError extends Error {}

/** Turn a Supabase/Postgres error into a sentence a guest can read. */
export function errorMessage(e: unknown): string {
  if (!configured)
    return 'This part of the site isn’t connected yet. Please check back soon.'
  if (e instanceof AppError) return e.message
  const msg =
    (e as { message?: string })?.message ??
    (typeof e === 'string' ? e : 'Something went wrong. Please try again.')
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return 'We couldn’t reach the server. Check your connection and try again.'
  if (/JWT|permission denied|row-level security/i.test(msg))
    return 'You don’t have access to that. Try signing in again.'
  return msg
}

/** Call a Postgres function and return its data, throwing a readable error. */
export async function rpc<T = unknown>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!configured) throw new AppError(errorMessage(null))
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new AppError(errorMessage(error))
  return data as T
}

/** Run a table query and return its data, throwing a readable error. */
export async function query<T>(
  q: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  if (!configured) throw new AppError(errorMessage(null))
  const { data, error } = await q
  if (error) throw new AppError(errorMessage(error))
  return data as T
}

/** Public URL for a photo in a public bucket (updates). */
export const publicPhotoUrl = (bucket: string, path: string) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl

/** Signed URLs for photos in a private bucket (notes). */
export async function signedPhotoUrls(
  bucket: string,
  paths: string[],
): Promise<string[]> {
  if (!paths.length) return []
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, 60 * 60)
  return (data ?? []).map(d => d.signedUrl ?? '').filter(Boolean)
}

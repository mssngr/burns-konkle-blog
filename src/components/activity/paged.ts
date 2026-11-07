// Newest-first lists loaded 50 at a time, shared by Sent emails and the Activity log.
import { useEffect, useRef, useState } from 'preact/hooks'

export const PAGE = 50

/**
 * Loads the first page whenever `key` (the filters) changes, and older pages on demand.
 * `fetch(before)` returns up to PAGE rows with id < before (or the newest when null), newest first.
 */
export function usePaged<T extends { id: number }>(
  fetch: (before: number | null) => Promise<T[]>,
  key: string,
) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const gen = useRef(0)
  const fetchRef = useRef(fetch)
  fetchRef.current = fetch
  const loadedKey = useRef('')

  useEffect(() => {
    const g = ++gen.current
    loadedKey.current = key
    setLoading(true)
    setError(null)
    fetchRef
      .current(null)
      .then(r => {
        if (g !== gen.current) return
        setRows(r)
        setMore(r.length === PAGE)
      })
      .catch(e => g === gen.current && setError(e))
      .finally(() => g === gen.current && setLoading(false))
  }, [key])

  const loadMore = async () => {
    const last = rows[rows.length - 1]
    if (!last) return
    const g = gen.current
    setLoadingMore(true)
    try {
      const r = await fetchRef.current(last.id)
      if (g !== gen.current) return
      setRows(prev => [...prev, ...r])
      setMore(r.length === PAGE)
      setError(null)
    } catch (e) {
      if (g === gen.current) setError(e)
    } finally {
      setLoadingMore(false)
    }
  }

  return { rows, loading, loadingMore, more, error, loadMore }
}

/** The value, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** A search term that is safe inside a PostgREST `or=(…ilike…)` filter. */
export const ilikeTerm = (q: string) => q.replace(/[,()"\\*%]/g, ' ').trim()

/** Copy text to the clipboard, falling back to a hidden textarea. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {}
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.append(ta)
  ta.select()
  document.execCommand('copy')
  ta.remove()
}

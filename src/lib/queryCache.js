import { useCallback, useEffect, useSyncExternalStore } from 'react'

// Tiny stale-while-revalidate cache shared across pages. Revisiting a page
// renders the last known data immediately while a fresh copy loads in the
// background, instead of flashing "Loading..." on every navigation.

const entries = new Map() // key -> { data, error }
const listeners = new Map() // key -> Set<() => void>
const inflight = new Map() // key -> Promise

const EMPTY_ENTRY = {}

const toKey = (key) => JSON.stringify(key)

const setEntry = (k, entry) => {
  entries.set(k, entry)
  listeners.get(k)?.forEach(fn => fn())
}

const subscribeTo = (k, fn) => {
  if (!listeners.has(k)) listeners.set(k, new Set())
  listeners.get(k).add(fn)
  return () => listeners.get(k).delete(fn)
}

const revalidate = (k, fetcher) => {
  if (inflight.has(k)) return inflight.get(k)
  const promise = fetcher()
    .then(data => setEntry(k, { data }))
    .catch(error => {
      console.error(error)
      setEntry(k, { ...entries.get(k), error })
    })
    .finally(() => inflight.delete(k))
  inflight.set(k, promise)
  return promise
}

// Drop everything, e.g. on sign-out so the next user never sees stale data
export const clearQueryCache = () => {
  entries.clear()
  inflight.clear()
}

/**
 * Returns { data, error, loading, setData }.
 * - `data` is the cached value (undefined until the first load finishes).
 * - `loading` is true only when there is nothing cached to show yet.
 * - `setData(valueOrUpdater)` updates the cache locally after a mutation, and
 *   every component reading the same key re-renders with it.
 * Fetches when the component mounts or the key changes, not on every render.
 */
export function useCachedQuery(key, fetcher, { enabled = true } = {}) {
  const k = toKey(key)

  const subscribe = useCallback(fn => subscribeTo(k, fn), [k])
  const entry = useSyncExternalStore(subscribe, () => entries.get(k) ?? EMPTY_ENTRY)

  useEffect(() => {
    if (enabled) revalidate(k, fetcher)
    // Refetch only when the key changes; callers pass a new fetcher function every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, enabled])

  const setData = useCallback(updater => {
    const prev = entries.get(k)?.data
    setEntry(k, { data: typeof updater === 'function' ? updater(prev) : updater })
  }, [k])

  return {
    data: entry.data,
    error: entry.error,
    loading: enabled && entry.data === undefined && !entry.error,
    setData,
  }
}

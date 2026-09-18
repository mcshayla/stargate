import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Receipt, Verdict } from '@/lib/types'

// The URL is the source of truth for the filter state so any view an engineer
// reaches is shareable and linkable — paste the URL into an incident and the
// recipient lands on the exact same slice (the "filters serialize to URL"
// story). Each filter owns one query param; unrelated params (e.g. ?receipt=)
// are preserved on every update.
const VERDICT_PARAM = 'verdict'
const MODEL_PARAM = 'model'
const QUERY_PARAM = 'q'

export type TrafficFilters = {
  verdicts: Set<Verdict>
  model: string | null
  query: string
  /** True when any filter is narrowing the stream. */
  active: boolean
  toggleVerdict: (verdict: Verdict) => void
  setModel: (model: string | null) => void
  setQuery: (query: string) => void
  clear: () => void
  /** Predicate a row must satisfy to be shown under the current filters. */
  matches: (receipt: Receipt) => boolean
}

export function useTrafficFilters(): TrafficFilters {
  const [params, setParams] = useSearchParams()

  const verdicts = useMemo(() => {
    const raw = params.get(VERDICT_PARAM)
    return new Set(
      (raw ? raw.split(',') : []).filter(Boolean) as Verdict[],
    )
  }, [params])
  const model = params.get(MODEL_PARAM)
  const query = params.get(QUERY_PARAM) ?? ''

  // Filter edits replace history rather than push it, so typing in the search
  // box or fanning verdict chips doesn't bury the Back button — but the address
  // bar still reflects (and shares) the live state.
  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const toggleVerdict = useCallback(
    (verdict: Verdict) => {
      update((next) => {
        const current = new Set(
          (next.get(VERDICT_PARAM)?.split(',').filter(Boolean) ??
            []) as Verdict[],
        )
        if (current.has(verdict)) current.delete(verdict)
        else current.add(verdict)
        if (current.size === 0) next.delete(VERDICT_PARAM)
        else next.set(VERDICT_PARAM, [...current].join(','))
      })
    },
    [update],
  )

  const setModel = useCallback(
    (value: string | null) => {
      update((next) => {
        if (!value) next.delete(MODEL_PARAM)
        else next.set(MODEL_PARAM, value)
      })
    },
    [update],
  )

  const setQuery = useCallback(
    (value: string) => {
      update((next) => {
        if (!value) next.delete(QUERY_PARAM)
        else next.set(QUERY_PARAM, value)
      })
    },
    [update],
  )

  const clear = useCallback(() => {
    update((next) => {
      next.delete(VERDICT_PARAM)
      next.delete(MODEL_PARAM)
      next.delete(QUERY_PARAM)
    })
  }, [update])

  const active = verdicts.size > 0 || model !== null || query !== ''

  const matches = useCallback(
    (receipt: Receipt) => {
      if (verdicts.size > 0 && !verdicts.has(receipt.verdict)) return false
      if (model && receipt.modelRequested !== model) return false
      if (query) {
        const needle = query.toLowerCase()
        const haystack = [
          receipt.id,
          receipt.key,
          receipt.team,
          receipt.project,
          receipt.modelRequested,
          receipt.modelResolved,
          receipt.provider,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    },
    [verdicts, model, query],
  )

  return {
    verdicts,
    model,
    query,
    active,
    toggleVerdict,
    setModel,
    setQuery,
    clear,
    matches,
  }
}

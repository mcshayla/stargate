import type { Receipt } from '@/lib/types'

// The ⌘K palette resolver registry (spec §7.4, Q8). Phase 1 is navigate +
// jump-to-entity only — no actions. You can jump to a live surface, to a
// model's or key's traffic, or straight to a receipt by pasting its id or
// trace id. The resolver is pure so the ranking and the typed-id fast path are
// testable without mounting a dialog.

export type PaletteGroup = 'Jump to' | 'Navigate' | 'Models' | 'Keys'

export type PaletteResult = {
  /** Stable key for React and keyboard focus. */
  id: string
  group: PaletteGroup
  label: string
  /** Secondary line — team/project for a key, provider for a model, etc. */
  hint?: string
  /** Navigation target; selecting the result routes here. */
  to: string
}

// Live Phase-1 destinations. Phase 2+ surfaces are intentionally absent — the
// palette only offers what it can actually navigate to.
const NAV: { id: string; label: string; to: string; keywords: string }[] = [
  { id: 'nav-overview', label: 'Overview', to: '/', keywords: 'overview home dashboard health' },
  { id: 'nav-traffic', label: 'Traffic', to: '/traffic', keywords: 'traffic stream requests receipts live' },
  { id: 'nav-spend', label: 'Spend', to: '/spend', keywords: 'spend cost budget money finance' },
]

/** A model or key, derived once from the receipt corpus. */
export type PaletteIndex = {
  models: { requested: string; provider: string }[]
  keys: { key: string; team: string; project: string }[]
  /** Receipt ids present, for the typed-id fast path. */
  receiptIds: ReadonlySet<string>
  /** trace id → receipt id, so a pasted trace id resolves to its receipt. */
  traceToReceipt: ReadonlyMap<string, string>
}

/** Build the palette's entity index from the receipt corpus (dedup + stable). */
export function buildPaletteIndex(receipts: readonly Receipt[]): PaletteIndex {
  const models = new Map<string, { requested: string; provider: string }>()
  const keys = new Map<string, { key: string; team: string; project: string }>()
  const receiptIds = new Set<string>()
  const traceToReceipt = new Map<string, string>()

  for (const r of receipts) {
    if (!models.has(r.modelRequested)) {
      models.set(r.modelRequested, { requested: r.modelRequested, provider: r.provider })
    }
    if (!keys.has(r.key)) {
      keys.set(r.key, { key: r.key, team: r.team, project: r.project })
    }
    receiptIds.add(r.id)
    traceToReceipt.set(r.traceId, r.id)
  }

  return {
    models: [...models.values()],
    keys: [...keys.values()],
    receiptIds,
    traceToReceipt,
  }
}

/** A receipt id (`rcpt_…`) or its trace id (`rcpt_…-trace`), resolved to the id. */
function resolveReceiptId(query: string, index: PaletteIndex): string | null {
  if (index.receiptIds.has(query)) return query
  const viaTrace = index.traceToReceipt.get(query)
  if (viaTrace) return viaTrace
  // Tolerate a pasted trace id even if the corpus doesn't carry the mapping,
  // as long as it names a receipt we know.
  if (query.endsWith('-trace')) {
    const base = query.slice(0, -'-trace'.length)
    if (index.receiptIds.has(base)) return base
  }
  return null
}

// Substring match with a small ranking: earlier match position and shorter
// candidate rank higher, so "gpt" surfaces "gpt-4o" above a longer alias.
function matchScore(needle: string, ...fields: string[]): number | null {
  let best: number | null = null
  for (const field of fields) {
    const at = field.toLowerCase().indexOf(needle)
    if (at === -1) continue
    const score = 1000 - at * 10 - field.length
    if (best === null || score > best) best = score
  }
  return best
}

/**
 * Resolve a query to ranked palette results.
 *
 * - Empty query → the navigation destinations, so ⌘K opens onto somewhere to go.
 * - A receipt id or trace id → a "Jump to" result that opens that receipt,
 *   floated to the top (the typed-id fast path). Pasting a trace id anywhere
 *   resolves to its receipt.
 * - Otherwise → substring matches across nav, models, and keys, ranked.
 */
export function resolvePalette(
  query: string,
  index: PaletteIndex,
): PaletteResult[] {
  const trimmed = query.trim()

  if (trimmed === '') {
    return NAV.map((n) => ({ id: n.id, group: 'Navigate' as const, label: n.label, to: n.to }))
  }

  const results: (PaletteResult & { _score: number })[] = []

  // Typed-id fast path: a pasted receipt/trace id jumps straight to the drawer,
  // which is URL-addressable via ?receipt=<id>.
  const receiptId = resolveReceiptId(trimmed, index)
  if (receiptId) {
    results.push({
      id: `jump-${receiptId}`,
      group: 'Jump to',
      label: `Open receipt ${receiptId}`,
      hint: 'Receipt · opens the decision trace',
      to: `/traffic?receipt=${receiptId}`,
      _score: Number.POSITIVE_INFINITY,
    })
  }

  const needle = trimmed.toLowerCase()

  for (const n of NAV) {
    const score = matchScore(needle, n.label, n.keywords)
    if (score !== null) {
      results.push({ id: n.id, group: 'Navigate', label: n.label, to: n.to, _score: score })
    }
  }

  for (const m of index.models) {
    const score = matchScore(needle, m.requested, m.provider)
    if (score !== null) {
      results.push({
        id: `model-${m.requested}`,
        group: 'Models',
        label: m.requested,
        hint: m.provider,
        // Models isn't a Phase-1 surface; jump to that model's traffic instead.
        to: `/traffic?model=${encodeURIComponent(m.requested)}`,
        _score: score,
      })
    }
  }

  for (const k of index.keys) {
    const score = matchScore(needle, k.key, k.team, k.project)
    if (score !== null) {
      results.push({
        id: `key-${k.key}`,
        group: 'Keys',
        label: k.key,
        hint: `${k.team} · ${k.project}`,
        // Keys isn't a Phase-1 surface; ride the Traffic free-text haystack.
        to: `/traffic?q=${encodeURIComponent(k.key)}`,
        _score: score,
      })
    }
  }

  results.sort((a, b) => b._score - a._score)
  return results.map(({ _score, ...r }) => r)
}

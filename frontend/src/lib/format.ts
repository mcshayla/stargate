// Number/identifier formatting. The spec mandates tabular numerals wherever a
// value can change and a consistent number of decimals per money column, so
// formatting lives in one place and every surface renders through it.

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usdPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

const compact = new Intl.NumberFormat('en-US', { notation: 'compact' })
const plain = new Intl.NumberFormat('en-US')

/** Dollars for tables and totals — always two decimals, right-aligned. */
export function formatUsd(value: number): string {
  return usd.format(value)
}

/** Sub-cent per-request costs keep four decimals so they don't read as $0.00. */
export function formatUsdPrecise(value: number): string {
  return value < 0.01 ? usdPrecise.format(value) : usd.format(value)
}

export function formatTokens(value: number): string {
  return value >= 10_000 ? compact.format(value) : plain.format(value)
}

export function formatCount(value: number): string {
  return plain.format(value)
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/** Short clock time for the dense Traffic stream. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Relative "how long ago" for live-feeling surfaces. */
export function formatRelative(iso: string, now: number): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

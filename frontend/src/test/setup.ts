import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Recharts' ResponsiveContainer measures its parent with ResizeObserver, which
// jsdom doesn't implement. Stub it so charts render at their fallback size in
// tests; we assert on the accessible table fallback, not the SVG geometry.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

afterEach(() => {
  cleanup()
})

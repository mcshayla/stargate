import { describe, expect, it } from 'vitest'
import { buildPaletteIndex, resolvePalette } from './palette'
import type { Receipt } from '@/lib/types'

const receipt = (over: Partial<Receipt>): Receipt =>
  ({
    id: 'rcpt_1000',
    traceId: 'rcpt_1000-trace',
    ts: '2026-09-18T12:00:00Z',
    durationMs: 100,
    key: 'sk-live-8f2a…c091',
    team: 'platform',
    project: 'agent-console',
    modelRequested: 'gpt-4o',
    modelResolved: 'gpt-4o-2024-08-06',
    provider: 'OpenAI',
    backend: 'openai-primary',
    region: 'us-east-1',
    verdict: 'allowed',
    status: 'success',
    statusCode: 200,
    costUsd: 0.01,
    tokens: { input: 100, cached: 0, output: 50, reasoning: 0 },
    redactions: [],
    trace: [],
    ...over,
  }) as Receipt

const CORPUS: Receipt[] = [
  receipt({ id: 'rcpt_1000', traceId: 'rcpt_1000-trace', modelRequested: 'gpt-4o', provider: 'OpenAI', key: 'sk-live-8f2a…c091', team: 'platform', project: 'agent-console' }),
  receipt({ id: 'rcpt_1001', traceId: 'rcpt_1001-trace', modelRequested: 'claude-opus-4-8', provider: 'Anthropic', key: 'sk-live-3b7d…a4e2', team: 'research', project: 'rag-eval' }),
  receipt({ id: 'rcpt_1002', traceId: 'rcpt_1002-trace', modelRequested: 'gpt-4o', provider: 'OpenAI', key: 'sk-live-8f2a…c091', team: 'platform', project: 'agent-console' }),
]

const index = buildPaletteIndex(CORPUS)

describe('buildPaletteIndex', () => {
  it('dedupes models and keys across the corpus', () => {
    expect(index.models.map((m) => m.requested)).toEqual([
      'gpt-4o',
      'claude-opus-4-8',
    ])
    expect(index.keys.map((k) => k.key)).toEqual([
      'sk-live-8f2a…c091',
      'sk-live-3b7d…a4e2',
    ])
  })
})

describe('resolvePalette', () => {
  it('offers navigation destinations for an empty query', () => {
    const results = resolvePalette('', index)
    expect(results.map((r) => r.to)).toEqual(['/', '/traffic', '/spend'])
    expect(results.every((r) => r.group === 'Navigate')).toBe(true)
  })

  it('matches models and jumps to that model’s traffic', () => {
    const results = resolvePalette('opus', index)
    const model = results.find((r) => r.group === 'Models')
    expect(model?.label).toBe('claude-opus-4-8')
    expect(model?.to).toBe('/traffic?model=claude-opus-4-8')
  })

  it('matches keys by team and rides the Traffic free-text haystack', () => {
    const results = resolvePalette('research', index)
    const key = results.find((r) => r.group === 'Keys')
    expect(key?.hint).toContain('research')
    expect(key?.to).toBe('/traffic?q=sk-live-3b7d%E2%80%A6a4e2')
  })

  it('resolves a receipt id straight to the receipt drawer', () => {
    const results = resolvePalette('rcpt_1001', index)
    expect(results[0].group).toBe('Jump to')
    expect(results[0].to).toBe('/traffic?receipt=rcpt_1001')
  })

  it('resolves a pasted trace id to its receipt (spec §7.4)', () => {
    const results = resolvePalette('rcpt_1002-trace', index)
    expect(results[0].to).toBe('/traffic?receipt=rcpt_1002')
  })

  it('floats the typed-id fast path above other matches', () => {
    // "rcpt_1000" is also a substring of nothing else, but the fast path must
    // lead regardless of what else matches.
    const results = resolvePalette('rcpt_1000', index)
    expect(results[0].group).toBe('Jump to')
  })

  it('ranks a tighter model match above a looser one', () => {
    const results = resolvePalette('gpt', index)
    const models = results.filter((r) => r.group === 'Models')
    expect(models[0].label).toBe('gpt-4o')
  })

  it('returns nothing for a query that matches no entity', () => {
    expect(resolvePalette('zzzznotamatch', index)).toEqual([])
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './command-palette'
import type { Receipt } from '@/lib/types'

function LocationSink() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

const CORPUS = [
  {
    id: 'rcpt_1000',
    traceId: 'rcpt_1000-trace',
    ts: '2026-09-18T12:00:00Z',
    durationMs: 100,
    key: 'sk-live-3b7d…a4e2',
    team: 'research',
    project: 'rag-eval',
    modelRequested: 'claude-opus-4-8',
    modelResolved: 'claude-opus-4-8',
    provider: 'Anthropic',
    backend: 'anthropic-primary',
    region: 'us-east-1',
    verdict: 'allowed',
    status: 'success',
    statusCode: 200,
    costUsd: 0.1,
    tokens: { input: 100, cached: 0, output: 50, reasoning: 0 },
    redactions: [],
    trace: [],
  },
] as unknown as Receipt[]

function setup(open: boolean, onOpenChange = vi.fn()) {
  const utils = render(
    <MemoryRouter initialEntries={['/']}>
      <LocationSink />
      <CommandPalette open={open} onOpenChange={onOpenChange} receipts={CORPUS} />
    </MemoryRouter>,
  )
  return { onOpenChange, ...utils }
}

describe('CommandPalette', () => {
  it('opens on ⌘K from anywhere', () => {
    const { onOpenChange } = setup(false)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('also opens on Ctrl+K', () => {
    const { onOpenChange } = setup(false)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('shows navigation destinations when opened with no query', () => {
    setup(true)
    expect(screen.getByRole('option', { name: /Overview/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Traffic/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Spend/ })).toBeInTheDocument()
  })

  it('navigates and closes when a result is clicked', async () => {
    const { onOpenChange } = setup(true)
    await userEvent.type(screen.getByRole('combobox'), 'spend')
    await userEvent.click(screen.getByRole('option', { name: /Spend/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/spend')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('jumps to a receipt drawer when an id is typed and Enter pressed', async () => {
    setup(true)
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'rcpt_1000')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/traffic?receipt=rcpt_1000',
    )
  })

  it('reports no matches for an unknown query', async () => {
    setup(true)
    await userEvent.type(screen.getByRole('combobox'), 'zzzznope')
    expect(screen.getByText(/No matches/)).toBeInTheDocument()
  })
})

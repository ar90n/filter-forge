import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { FrequencyResponse } from '@/types/filter.ts'

// Mock uPlot since it requires canvas
const mockDestroy = vi.fn()
const mockSetData = vi.fn()
const mockSetScale = vi.fn()
const mockSetSize = vi.fn()

const MockUPlot = vi.fn().mockImplementation(() => ({
  destroy: mockDestroy,
  setData: mockSetData,
  setScale: mockSetScale,
  setSize: mockSetSize,
  root: document.createElement('div'),
}))

vi.mock('uplot', () => ({
  default: MockUPlot,
}))

// Must import after mock
const { FrequencyChart } = await import('./FrequencyChart.tsx')

const SAMPLE_DATA: FrequencyResponse = {
  frequencies: [100, 1000, 10000],
  magnitude: [0, -3, -20],
  phase: [0, -45, -90],
  groupDelay: [0.001, 0.001, 0.0005],
}

describe('FrequencyChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows placeholder when data is null', () => {
    render(<FrequencyChart data={null} />)
    expect(
      screen.getByText('No frequency response data. Run a calculation first.'),
    ).toBeInTheDocument()
  })

  it('renders three chart containers when data is provided', () => {
    render(<FrequencyChart data={SAMPLE_DATA} />)

    expect(screen.getByTestId('chart-magnitude')).toBeInTheDocument()
    expect(screen.getByTestId('chart-phase')).toBeInTheDocument()
    expect(screen.getByTestId('chart-group-delay')).toBeInTheDocument()
  })

  it('creates three uPlot instances when data is provided', () => {
    render(<FrequencyChart data={SAMPLE_DATA} />)

    expect(MockUPlot).toHaveBeenCalledTimes(3)
  })

  it('destroys uPlot instances on unmount', () => {
    const { unmount } = render(<FrequencyChart data={SAMPLE_DATA} />)
    unmount()

    expect(mockDestroy).toHaveBeenCalledTimes(3)
  })
})

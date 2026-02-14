import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BomTable } from './BomTable.tsx'
import type { Component } from '@/types/filter.ts'

const SAMPLE_COMPONENTS: Component[] = [
  { id: 'L1', type: 'inductor', value: 0.00796, position: 'series' },
  { id: 'C1', type: 'capacitor', value: 3.18e-7, position: 'shunt' },
  { id: 'L2', type: 'inductor', value: 0.00796, position: 'series' },
]

// Set up clipboard mock for jsdom
const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  configurable: true,
})

describe('BomTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows placeholder when components is null', () => {
    render(<BomTable components={null} />)
    expect(screen.getByTestId('bom-placeholder')).toBeInTheDocument()
    expect(screen.getByText('No BOM data. Run a calculation first.')).toBeInTheDocument()
  })

  it('shows placeholder when components is empty', () => {
    render(<BomTable components={[]} />)
    expect(screen.getByTestId('bom-placeholder')).toBeInTheDocument()
  })

  it('renders table with correct number of rows', () => {
    render(<BomTable components={SAMPLE_COMPONENTS} />)
    expect(screen.getByTestId('bom-table')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    // 1 header + 3 data
    expect(rows).toHaveLength(4)
  })

  it('displays component symbols and formatted values', () => {
    render(<BomTable components={SAMPLE_COMPONENTS} />)
    expect(screen.getByText('L1')).toBeInTheDocument()
    expect(screen.getByText('C1')).toBeInTheDocument()
    expect(screen.getByText('L2')).toBeInTheDocument()
    expect(screen.getAllByText('7.96 mH')).toHaveLength(2)
    expect(screen.getByText('318 nF')).toBeInTheDocument()
  })

  it('copies CSV to clipboard on button click', async () => {
    render(<BomTable components={SAMPLE_COMPONENTS} />)

    const button = screen.getByText('Copy CSV')
    button.click()

    // Wait for the async clipboard operation and state update
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1)
    })

    const csv = mockWriteText.mock.calls[0][0] as string
    expect(csv).toContain('#,Symbol,Type,Value,Position')
    expect(csv).toContain('1,L1,Inductor,7.96 mH,Series')
    expect(csv).toContain('2,C1,Capacitor,318 nF,Shunt')
    expect(csv).toContain('3,L2,Inductor,7.96 mH,Series')

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CircuitDiagram } from './CircuitDiagram.tsx'
import type { Component, CircuitTopology } from '@/types/filter.ts'

const LADDER_COMPONENTS: Component[] = [
  { id: 'L1', type: 'inductor', value: 0.00796, position: 'series' },
  { id: 'C1', type: 'capacitor', value: 3.18e-7, position: 'shunt' },
  { id: 'L2', type: 'inductor', value: 0.00796, position: 'series' },
]

const LATTICE_COMPONENTS: Component[] = [
  { id: 'L1', type: 'inductor', value: 0.00796, position: 'series' },
  { id: 'C1', type: 'capacitor', value: 3.18e-7, position: 'shunt' },
]

const SALLEN_KEY_COMPONENTS: Component[] = [
  { id: 'S1_R1', type: 'resistor', value: 10000, position: 'series' },
  { id: 'S1_R2', type: 'resistor', value: 10000, position: 'series' },
  { id: 'S1_C1', type: 'capacitor', value: 1.59e-8, position: 'feedback' },
  { id: 'S1_C2', type: 'capacitor', value: 1.59e-8, position: 'shunt' },
  { id: 'S1_U', type: 'opamp', value: 0, position: 'active' },
]

describe('CircuitDiagram', () => {
  it('shows placeholder when components is null', () => {
    render(<CircuitDiagram components={null} topology={null} />)
    expect(screen.getByTestId('circuit-placeholder')).toBeInTheDocument()
    expect(screen.getByText('No circuit data. Run a calculation first.')).toBeInTheDocument()
  })

  it('shows placeholder when components is empty', () => {
    render(<CircuitDiagram components={[]} topology={'ladder-t' as CircuitTopology} />)
    expect(screen.getByTestId('circuit-placeholder')).toBeInTheDocument()
  })

  it('renders ladder-t SVG with correct structure', () => {
    render(
      <CircuitDiagram
        components={LADDER_COMPONENTS}
        topology="ladder-t"
        sourceImpedance={50}
        loadImpedance={50}
      />,
    )
    expect(screen.getByTestId('circuit-diagram')).toBeInTheDocument()
    // Should contain SVG with circuit diagram role
    const svg = screen.getByRole('img', { name: 'Circuit diagram' })
    expect(svg).toBeInTheDocument()
    // Should display component labels
    expect(screen.getByText('L1')).toBeInTheDocument()
    expect(screen.getByText('C1')).toBeInTheDocument()
    expect(screen.getByText('L2')).toBeInTheDocument()
    // Should display Rs/Rl labels
    expect(screen.getByText('Rs')).toBeInTheDocument()
    expect(screen.getByText('Rl')).toBeInTheDocument()
  })

  it('renders lattice SVG for APF topology', () => {
    render(
      <CircuitDiagram
        components={LATTICE_COMPONENTS}
        topology="lattice"
        sourceImpedance={50}
        loadImpedance={50}
      />,
    )
    expect(screen.getByTestId('circuit-diagram')).toBeInTheDocument()
    const svg = screen.getByRole('img', { name: 'Lattice circuit diagram' })
    expect(svg).toBeInTheDocument()
    // Za (L1) appears twice (top & bottom rail), Zb (C1) appears twice (two diagonal arms)
    expect(screen.getAllByText('L1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('C1').length).toBeGreaterThanOrEqual(1)
  })

  it('displays formatted component values', () => {
    render(
      <CircuitDiagram
        components={LADDER_COMPONENTS}
        topology="ladder-t"
        sourceImpedance={50}
        loadImpedance={50}
      />,
    )
    // L1 = 0.00796 H → 7.96 mH
    expect(screen.getAllByText('7.96 mH').length).toBeGreaterThanOrEqual(1)
    // C1 = 3.18e-7 F → 318 nF
    expect(screen.getAllByText('318 nF').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Sallen-Key SVG with op-amp components', () => {
    render(
      <CircuitDiagram
        components={SALLEN_KEY_COMPONENTS}
        topology="sallen-key"
      />,
    )
    expect(screen.getByTestId('circuit-diagram')).toBeInTheDocument()
    const svg = screen.getByRole('img', { name: 'Sallen-Key circuit diagram' })
    expect(svg).toBeInTheDocument()
    // Should display component labels (stage prefix stripped)
    expect(screen.getByText('R1')).toBeInTheDocument()
    expect(screen.getByText('R2')).toBeInTheDocument()
    expect(screen.getByText('U')).toBeInTheDocument()
    // Should display stage label
    expect(screen.getByText('Stage 1')).toBeInTheDocument()
    // Should display Vin/Vout labels
    expect(screen.getByText('Vin')).toBeInTheDocument()
    expect(screen.getByText('Vout')).toBeInTheDocument()
  })
})

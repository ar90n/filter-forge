import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransferFunction } from './TransferFunction.tsx'

describe('TransferFunction', () => {
  it('shows placeholder when latex is null', () => {
    render(<TransferFunction latex={null} />)
    expect(screen.getByTestId('transfer-function-placeholder')).toBeInTheDocument()
    expect(
      screen.getByText('No transfer function data. Run a calculation first.'),
    ).toBeInTheDocument()
  })

  it('renders KaTeX output for valid LaTeX', () => {
    const latex = 'H(s) = \\frac{1}{s + 1}'
    render(<TransferFunction latex={latex} />)
    expect(screen.getByTestId('transfer-function')).toBeInTheDocument()
    expect(screen.getByTestId('transfer-function-equation')).toBeInTheDocument()
    // KaTeX renders elements with the .katex-display class
    const container = screen.getByTestId('transfer-function-equation')
    expect(container.querySelector('.katex-display')).not.toBeNull()
  })

  it('shows the "Transfer Function" header', () => {
    const latex = 'H(s) = \\frac{s}{s + 1}'
    render(<TransferFunction latex={latex} />)
    expect(screen.getByText('Transfer Function')).toBeInTheDocument()
  })

  it('handles complex equations (high-order filters)', () => {
    const latex =
      'H(s) = \\frac{1.0 s^{5} + 2.345 s^{4} + 100.0 s^{3} + 500.0 s^{2} + 1000.0 s + 200.0}{s^{5} + 3.236 s^{4} + 5.236 s^{3} + 5.236 s^{2} + 3.236 s + 1.0}'
    render(<TransferFunction latex={latex} />)
    expect(screen.getByTestId('transfer-function')).toBeInTheDocument()
    const container = screen.getByTestId('transfer-function-equation')
    expect(container.querySelector('.katex-display')).not.toBeNull()
  })

  it('shows placeholder for empty string latex', () => {
    render(<TransferFunction latex="" />)
    expect(screen.getByTestId('transfer-function-placeholder')).toBeInTheDocument()
  })
})

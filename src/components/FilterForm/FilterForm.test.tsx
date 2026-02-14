import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterForm } from './FilterForm.tsx'

describe('FilterForm', () => {
  const mockSubmit = vi.fn()

  beforeEach(() => {
    mockSubmit.mockClear()
  })

  it('renders with default values', () => {
    render(<FilterForm onSubmit={mockSubmit} />)

    expect(screen.getByLabelText('Filter Type')).toHaveValue('lc_passive')
    expect(screen.getByLabelText('Characteristics')).toHaveValue('lpf')
    expect(screen.getByLabelText('Approximation')).toHaveValue('butterworth')
    expect(screen.getByLabelText('Order')).toHaveValue(3)
    expect(screen.getByLabelText('Source Impedance (Ω)')).toHaveValue(50)
    expect(screen.getByLabelText('Load Impedance (Ω)')).toHaveValue(50)
  })

  it('shows cutoff frequency for LPF', () => {
    render(<FilterForm onSubmit={mockSubmit} />)
    expect(screen.getByLabelText('Cutoff Frequency')).toBeInTheDocument()
    expect(screen.queryByLabelText('Center Frequency')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Bandwidth')).not.toBeInTheDocument()
  })

  it('switches to center frequency + bandwidth for BPF', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    await user.selectOptions(screen.getByLabelText('Characteristics'), 'bpf')

    expect(screen.queryByLabelText('Cutoff Frequency')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Center Frequency')).toBeInTheDocument()
    expect(screen.getByLabelText('Bandwidth')).toBeInTheDocument()
  })

  it('hides approximation selector for APF', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    expect(screen.getByLabelText('Approximation')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Characteristics'), 'apf')

    expect(screen.queryByLabelText('Approximation')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Center Frequency')).toBeInTheDocument()
    expect(screen.queryByLabelText('Bandwidth')).not.toBeInTheDocument()
  })

  it('shows ripple for Chebyshev I', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    expect(screen.queryByLabelText('Passband Ripple (dB)')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Approximation'), 'chebyshev1')

    expect(screen.getByLabelText('Passband Ripple (dB)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Stopband Attenuation (dB)')).not.toBeInTheDocument()
  })

  it('shows ripple + attenuation for Elliptic', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    await user.selectOptions(screen.getByLabelText('Approximation'), 'elliptic')

    expect(screen.getByLabelText('Passband Ripple (dB)')).toBeInTheDocument()
    expect(screen.getByLabelText('Stopband Attenuation (dB)')).toBeInTheDocument()
  })

  it('shows attenuation only for Chebyshev II', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    await user.selectOptions(screen.getByLabelText('Approximation'), 'chebyshev2')

    expect(screen.queryByLabelText('Passband Ripple (dB)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Stopband Attenuation (dB)')).toBeInTheDocument()
  })

  it('shows validation error for invalid order', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    const orderInput = screen.getByLabelText('Order')
    await user.clear(orderInput)
    await user.click(screen.getByRole('button', { name: 'Calculate' }))

    expect(screen.getByText('Filter order must be an integer between 1 and 10.')).toBeInTheDocument()
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('shows validation error for negative frequency', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    const cutoffInput = screen.getByLabelText('Cutoff Frequency')
    await user.clear(cutoffInput)
    await user.click(screen.getByRole('button', { name: 'Calculate' }))

    expect(screen.getByText('Cutoff frequency must be positive.')).toBeInTheDocument()
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('calls onSubmit with correct FilterParams for LC Passive LPF', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Calculate' }))

    expect(mockSubmit).toHaveBeenCalledTimes(1)
    const params = mockSubmit.mock.calls[0][0]
    expect(params.filterType).toBe('lc_passive')
    expect(params.characteristics).toBe('lpf')
    expect(params.approximation).toBe('butterworth')
    expect(params.order).toBe(3)
    expect(params.cutoffFrequency).toBe(1000) // 1 kHz
    expect(params.sourceImpedance).toBe(50)
    expect(params.loadImpedance).toBe(50)
  })

  it('disables calculate button when disabled prop is true', () => {
    render(<FilterForm onSubmit={mockSubmit} disabled />)
    expect(screen.getByRole('button', { name: 'Engine Loading...' })).toBeDisabled()
  })

  // --- Sallen-Key specific tests ---

  it('shows only LPF/HPF/BPF characteristics for Sallen-Key', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    await user.selectOptions(screen.getByLabelText('Filter Type'), 'active_sallen_key')

    const charSelect = screen.getByLabelText('Characteristics')
    const options = Array.from(charSelect.querySelectorAll('option')).map(
      (opt) => (opt as HTMLOptionElement).value,
    )
    expect(options).toEqual(['lpf', 'hpf', 'bpf'])
    expect(options).not.toContain('bef')
    expect(options).not.toContain('apf')
  })

  it('hides impedance fields for Sallen-Key', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    // Initially visible (LC Passive)
    expect(screen.getByLabelText('Source Impedance (Ω)')).toBeInTheDocument()
    expect(screen.getByLabelText('Load Impedance (Ω)')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filter Type'), 'active_sallen_key')

    expect(screen.queryByLabelText('Source Impedance (Ω)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Load Impedance (Ω)')).not.toBeInTheDocument()
  })

  it('rounds odd order to even when switching to Sallen-Key', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    // Default order is 3 (odd)
    expect(screen.getByLabelText('Order')).toHaveValue(3)

    await user.selectOptions(screen.getByLabelText('Filter Type'), 'active_sallen_key')

    // Should be rounded up to 4
    expect(screen.getByLabelText('Order')).toHaveValue(4)
  })

  it('resets unsupported characteristics when switching to Sallen-Key', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    // Select APF (not supported by Sallen-Key)
    await user.selectOptions(screen.getByLabelText('Characteristics'), 'apf')
    expect(screen.getByLabelText('Characteristics')).toHaveValue('apf')

    // Switch to Sallen-Key
    await user.selectOptions(screen.getByLabelText('Filter Type'), 'active_sallen_key')

    // Should reset to 'lpf'
    expect(screen.getByLabelText('Characteristics')).toHaveValue('lpf')
  })

  it('validates even order for Sallen-Key', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    await user.selectOptions(screen.getByLabelText('Filter Type'), 'active_sallen_key')

    const orderInput = screen.getByLabelText('Order')
    await user.clear(orderInput)
    await user.type(orderInput, '3')
    await user.click(screen.getByRole('button', { name: 'Calculate' }))

    expect(screen.getByText('Sallen-Key requires an even order (2, 4, 6, 8, 10).')).toBeInTheDocument()
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it('submits Sallen-Key params without impedance', async () => {
    const user = userEvent.setup()
    render(<FilterForm onSubmit={mockSubmit} />)

    await user.selectOptions(screen.getByLabelText('Filter Type'), 'active_sallen_key')

    // Order should now be 4 (rounded from 3)
    await user.click(screen.getByRole('button', { name: 'Calculate' }))

    expect(mockSubmit).toHaveBeenCalledTimes(1)
    const params = mockSubmit.mock.calls[0][0]
    expect(params.filterType).toBe('active_sallen_key')
    expect(params.characteristics).toBe('lpf')
    expect(params.order).toBe(4)
    expect(params.sourceImpedance).toBeUndefined()
    expect(params.loadImpedance).toBeUndefined()
  })
})

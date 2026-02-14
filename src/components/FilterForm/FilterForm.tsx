import { useState } from 'react'
import type { FilterType, Approximation, FilterParams, FrequencyUnit } from '@/types/filter.ts'
import { convertToHz } from '@/lib/units.ts'

type FilterFormProps = {
  onSubmit: (params: FilterParams) => void
  disabled?: boolean
}

type ValidationErrors = Partial<Record<string, string>>

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: 'lpf', label: 'Low-Pass Filter (LPF)' },
  { value: 'hpf', label: 'High-Pass Filter (HPF)' },
  { value: 'bpf', label: 'Band-Pass Filter (BPF)' },
  { value: 'bef', label: 'Band-Elimination Filter (BEF)' },
  { value: 'apf', label: 'All-Pass Filter (APF)' },
]

const APPROXIMATIONS: { value: Approximation; label: string }[] = [
  { value: 'butterworth', label: 'Butterworth' },
  { value: 'chebyshev1', label: 'Chebyshev Type I' },
  { value: 'chebyshev2', label: 'Chebyshev Type II' },
  { value: 'bessel', label: 'Bessel' },
  { value: 'elliptic', label: 'Elliptic (Cauer)' },
]

const FREQUENCY_UNITS: FrequencyUnit[] = ['Hz', 'kHz', 'MHz']

function needsCutoff(ft: FilterType): boolean {
  return ft === 'lpf' || ft === 'hpf'
}

function needsCenter(ft: FilterType): boolean {
  return ft === 'bpf' || ft === 'bef' || ft === 'apf'
}

function needsBandwidth(ft: FilterType): boolean {
  return ft === 'bpf' || ft === 'bef'
}

function needsApproximation(ft: FilterType): boolean {
  return ft !== 'apf'
}

function needsRipple(approx: Approximation): boolean {
  return approx === 'chebyshev1' || approx === 'elliptic'
}

function needsAttenuation(approx: Approximation): boolean {
  return approx === 'chebyshev2' || approx === 'elliptic'
}

export function FilterForm({ onSubmit, disabled = false }: FilterFormProps) {
  const [filterType, setFilterType] = useState<FilterType>('lpf')
  const [approximation, setApproximation] = useState<Approximation>('butterworth')
  const [cutoffFreq, setCutoffFreq] = useState('1')
  const [cutoffUnit, setCutoffUnit] = useState<FrequencyUnit>('kHz')
  const [centerFreq, setCenterFreq] = useState('1')
  const [centerUnit, setCenterUnit] = useState<FrequencyUnit>('kHz')
  const [bandwidth, setBandwidth] = useState('0.5')
  const [bandwidthUnit, setBandwidthUnit] = useState<FrequencyUnit>('kHz')
  const [order, setOrder] = useState('3')
  const [ripple, setRipple] = useState('1')
  const [attenuation, setAttenuation] = useState('40')
  const [sourceImpedance, setSourceImpedance] = useState('50')
  const [loadImpedance, setLoadImpedance] = useState('50')
  const [errors, setErrors] = useState<ValidationErrors>({})

  function validate(): ValidationErrors {
    const e: ValidationErrors = {}
    const orderNum = parseInt(order, 10)

    if (isNaN(orderNum) || orderNum < 1 || orderNum > 10 || !Number.isInteger(orderNum)) {
      e.order = 'Filter order must be an integer between 1 and 10.'
    }

    if (needsCutoff(filterType)) {
      const v = parseFloat(cutoffFreq)
      if (isNaN(v) || v <= 0) e.cutoffFreq = 'Cutoff frequency must be positive.'
    }

    if (needsCenter(filterType)) {
      const v = parseFloat(centerFreq)
      if (isNaN(v) || v <= 0) e.centerFreq = 'Center frequency must be positive.'
    }

    if (needsBandwidth(filterType)) {
      const bw = parseFloat(bandwidth)
      const cf = parseFloat(centerFreq)
      if (isNaN(bw) || bw <= 0) {
        e.bandwidth = 'Bandwidth must be positive.'
      } else if (!isNaN(cf) && cf > 0 && bw >= cf * 2) {
        e.bandwidth = 'Bandwidth must be less than 2x center frequency.'
      }
    }

    if (needsApproximation(filterType) && needsRipple(approximation)) {
      const v = parseFloat(ripple)
      if (isNaN(v) || v <= 0) e.ripple = 'Passband ripple must be positive.'
    }

    if (needsApproximation(filterType) && needsAttenuation(approximation)) {
      const v = parseFloat(attenuation)
      if (isNaN(v) || v <= 0) e.attenuation = 'Stopband attenuation must be positive.'
    }

    const srcZ = parseFloat(sourceImpedance)
    if (isNaN(srcZ) || srcZ <= 0) e.sourceImpedance = 'Source impedance must be positive.'

    const loadZ = parseFloat(loadImpedance)
    if (isNaN(loadZ) || loadZ <= 0) e.loadImpedance = 'Load impedance must be positive.'

    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    const params: FilterParams = {
      filterType,
      approximation,
      order: parseInt(order, 10),
      cutoffFrequency: needsCutoff(filterType)
        ? convertToHz(parseFloat(cutoffFreq), cutoffUnit)
        : 0,
      sourceImpedance: parseFloat(sourceImpedance),
      loadImpedance: parseFloat(loadImpedance),
    }

    if (needsCenter(filterType)) {
      params.centerFrequency = convertToHz(parseFloat(centerFreq), centerUnit)
    }
    if (needsBandwidth(filterType)) {
      params.bandwidth = convertToHz(parseFloat(bandwidth), bandwidthUnit)
    }
    if (needsApproximation(filterType) && needsRipple(approximation)) {
      params.passbandRipple = parseFloat(ripple)
    }
    if (needsApproximation(filterType) && needsAttenuation(approximation)) {
      params.stopbandAttenuation = parseFloat(attenuation)
    }

    onSubmit(params)
  }

  const inputClass =
    'w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'
  const selectClass =
    'w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'
  const labelClass = 'mb-1 block text-xs font-medium text-gray-600'
  const errorClass = 'mt-0.5 text-xs text-red-500'

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {/* Filter type */}
      <div>
        <label htmlFor="ff-filter-type" className={labelClass}>Filter Type</label>
        <select
          id="ff-filter-type"
          className={selectClass}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
        >
          {FILTER_TYPES.map((ft) => (
            <option key={ft.value} value={ft.value}>
              {ft.label}
            </option>
          ))}
        </select>
      </div>

      {/* Approximation function (hidden for APF) */}
      {needsApproximation(filterType) && (
        <div>
          <label htmlFor="ff-approximation" className={labelClass}>Approximation</label>
          <select
            id="ff-approximation"
            className={selectClass}
            value={approximation}
            onChange={(e) => setApproximation(e.target.value as Approximation)}
          >
            {APPROXIMATIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Cutoff frequency (LPF/HPF) */}
      {needsCutoff(filterType) && (
        <div>
          <label htmlFor="ff-cutoff-freq" className={labelClass}>Cutoff Frequency</label>
          <div className="flex gap-1">
            <input
              id="ff-cutoff-freq"
              type="number"
              className={`${inputClass} flex-1`}
              value={cutoffFreq}
              onChange={(e) => setCutoffFreq(e.target.value)}
              step="any"
              min="0"
            />
            <select
              aria-label="Cutoff frequency unit"
              className="w-16 rounded border border-gray-300 bg-white px-1 py-1.5 text-sm"
              value={cutoffUnit}
              onChange={(e) => setCutoffUnit(e.target.value as FrequencyUnit)}
            >
              {FREQUENCY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {errors.cutoffFreq && <p className={errorClass}>{errors.cutoffFreq}</p>}
        </div>
      )}

      {/* Center frequency (BPF/BEF/APF) */}
      {needsCenter(filterType) && (
        <div>
          <label htmlFor="ff-center-freq" className={labelClass}>Center Frequency</label>
          <div className="flex gap-1">
            <input
              id="ff-center-freq"
              type="number"
              className={`${inputClass} flex-1`}
              value={centerFreq}
              onChange={(e) => setCenterFreq(e.target.value)}
              step="any"
              min="0"
            />
            <select
              aria-label="Center frequency unit"
              className="w-16 rounded border border-gray-300 bg-white px-1 py-1.5 text-sm"
              value={centerUnit}
              onChange={(e) => setCenterUnit(e.target.value as FrequencyUnit)}
            >
              {FREQUENCY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {errors.centerFreq && <p className={errorClass}>{errors.centerFreq}</p>}
        </div>
      )}

      {/* Bandwidth (BPF/BEF) */}
      {needsBandwidth(filterType) && (
        <div>
          <label htmlFor="ff-bandwidth" className={labelClass}>Bandwidth</label>
          <div className="flex gap-1">
            <input
              id="ff-bandwidth"
              type="number"
              className={`${inputClass} flex-1`}
              value={bandwidth}
              onChange={(e) => setBandwidth(e.target.value)}
              step="any"
              min="0"
            />
            <select
              aria-label="Bandwidth unit"
              className="w-16 rounded border border-gray-300 bg-white px-1 py-1.5 text-sm"
              value={bandwidthUnit}
              onChange={(e) => setBandwidthUnit(e.target.value as FrequencyUnit)}
            >
              {FREQUENCY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {errors.bandwidth && <p className={errorClass}>{errors.bandwidth}</p>}
        </div>
      )}

      {/* Filter order */}
      <div>
        <label htmlFor="ff-order" className={labelClass}>Order</label>
        <input
          id="ff-order"
          type="number"
          className={inputClass}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          min="1"
          max="10"
          step="1"
        />
        {errors.order && <p className={errorClass}>{errors.order}</p>}
      </div>

      {/* Passband ripple */}
      {needsApproximation(filterType) && needsRipple(approximation) && (
        <div>
          <label htmlFor="ff-ripple" className={labelClass}>Passband Ripple (dB)</label>
          <input
            id="ff-ripple"
            type="number"
            className={inputClass}
            value={ripple}
            onChange={(e) => setRipple(e.target.value)}
            step="any"
            min="0"
          />
          {errors.ripple && <p className={errorClass}>{errors.ripple}</p>}
        </div>
      )}

      {/* Stopband attenuation */}
      {needsApproximation(filterType) && needsAttenuation(approximation) && (
        <div>
          <label htmlFor="ff-attenuation" className={labelClass}>Stopband Attenuation (dB)</label>
          <input
            id="ff-attenuation"
            type="number"
            className={inputClass}
            value={attenuation}
            onChange={(e) => setAttenuation(e.target.value)}
            step="any"
            min="0"
          />
          {errors.attenuation && <p className={errorClass}>{errors.attenuation}</p>}
        </div>
      )}

      {/* Source impedance */}
      <div>
        <label htmlFor="ff-source-z" className={labelClass}>Source Impedance (Ω)</label>
        <input
          id="ff-source-z"
          type="number"
          className={inputClass}
          value={sourceImpedance}
          onChange={(e) => setSourceImpedance(e.target.value)}
          step="any"
          min="0"
        />
        {errors.sourceImpedance && <p className={errorClass}>{errors.sourceImpedance}</p>}
      </div>

      {/* Load impedance */}
      <div>
        <label htmlFor="ff-load-z" className={labelClass}>Load Impedance (Ω)</label>
        <input
          id="ff-load-z"
          type="number"
          className={inputClass}
          value={loadImpedance}
          onChange={(e) => setLoadImpedance(e.target.value)}
          step="any"
          min="0"
        />
        {errors.loadImpedance && <p className={errorClass}>{errors.loadImpedance}</p>}
      </div>

      {/* Calculate button */}
      <button
        type="submit"
        disabled={disabled}
        className="w-full rounded bg-primary-600 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {disabled ? 'Engine Loading...' : 'Calculate'}
      </button>
    </form>
  )
}

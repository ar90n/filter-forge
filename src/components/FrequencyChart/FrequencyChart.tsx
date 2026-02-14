import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { FrequencyResponse } from '@/types/filter.ts'

type FrequencyChartProps = {
  data: FrequencyResponse | null
}

const SYNC_KEY = 'filterforge'

const COLORS = {
  magnitude: '#2563eb',
  phase: '#16a34a',
  groupDelay: '#dc2626',
  marker: '#f59e0b',
}

/** Find the frequency where magnitude first crosses -3 dB */
function findMinus3dBPoint(
  frequencies: number[],
  magnitude: number[],
): { freq: number; mag: number } | null {
  const dcMag = magnitude[0] ?? 0
  const target = dcMag - 3

  for (let i = 1; i < magnitude.length; i++) {
    if (magnitude[i]! <= target) {
      const m0 = magnitude[i - 1]!
      const m1 = magnitude[i]!
      const f0 = frequencies[i - 1]!
      const f1 = frequencies[i]!
      const t = (target - m0) / (m1 - m0)
      const freq = f0 * Math.pow(f1 / f0, t)
      return { freq, mag: target }
    }
  }
  return null
}

/**
 * Compute an appropriate Y-axis range from the min/max of the data.
 * Adds padding above and below (default 10%).
 */
function computeYRange(
  values: number[],
  paddingFraction = 0.1,
): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]

  const span = max - min
  if (span < 1e-12) {
    // Nearly constant value: ensure a +/-1 range
    return [min - 1, max + 1]
  }

  const pad = span * paddingFraction
  return [min - pad, max + pad]
}

/** Frequency axis label formatter */
function freqAxisValues(_u: uPlot, vals: (number | null | undefined)[]) {
  return vals.map((v) => {
    if (v == null) return ''
    if (v >= 1e6) return `${v / 1e6}M`
    if (v >= 1e3) return `${v / 1e3}k`
    return String(v)
  })
}

function makeOpts(
  title: string,
  yLabel: string,
  seriesColor: string,
  height: number,
  yRange: [number, number],
  drawHook?: (u: uPlot) => void,
): uPlot.Options {
  const opts: uPlot.Options = {
    width: 800,
    height,
    cursor: {
      sync: {
        key: SYNC_KEY,
        setSeries: true,
      },
    },
    scales: {
      x: {
        distr: 3, // log10
      },
      y: {
        range: yRange,
      },
    },
    axes: [
      {
        label: 'Frequency (Hz)',
        values: freqAxisValues,
      },
      {
        label: yLabel,
        size: 60,
      },
    ],
    series: [
      {},
      {
        label: title,
        stroke: seriesColor,
        width: 2,
      },
    ],
    legend: {
      show: false,
    },
    hooks: {},
  }

  if (drawHook) {
    opts.hooks!.draw = [drawHook]
  }

  return opts
}

// Chart heights
const MAG_HEIGHT = 240
const PHASE_HEIGHT = 200
const GD_HEIGHT = 200

export function FrequencyChart({ data }: FrequencyChartProps) {
  const magContainerRef = useRef<HTMLDivElement>(null)
  const phaseContainerRef = useRef<HTMLDivElement>(null)
  const gdContainerRef = useRef<HTMLDivElement>(null)

  const magChartRef = useRef<uPlot | null>(null)
  const phaseChartRef = useRef<uPlot | null>(null)
  const gdChartRef = useRef<uPlot | null>(null)

  const dataRef = useRef<FrequencyResponse | null>(null)

  useEffect(() => {
    dataRef.current = data
  })

  // Create / destroy uPlot instances
  useEffect(() => {
    if (!magContainerRef.current || !phaseContainerRef.current || !gdContainerRef.current) return
    if (!data) return

    const containerWidth = magContainerRef.current.clientWidth || 800

    // Compute data-adaptive Y ranges
    const magRange = computeYRange(data.magnitude)
    const phaseRange = computeYRange(data.phase)
    const gdRange = computeYRange(data.groupDelay, 0.15)

    const minus3dBDraw = (u: uPlot) => {
      const currentData = dataRef.current
      if (!currentData) return
      const point = findMinus3dBPoint(currentData.frequencies, currentData.magnitude)
      if (!point) return

      const cx = u.valToPos(point.freq, 'x', true)
      const cy = u.valToPos(point.mag, 'y', true)

      u.ctx.save()
      u.ctx.beginPath()
      u.ctx.arc(cx, cy, 5, 0, 2 * Math.PI)
      u.ctx.fillStyle = COLORS.marker
      u.ctx.fill()
      u.ctx.strokeStyle = '#fff'
      u.ctx.lineWidth = 1.5
      u.ctx.stroke()
      u.ctx.restore()

      // Label
      u.ctx.save()
      u.ctx.font = '11px sans-serif'
      u.ctx.fillStyle = COLORS.marker
      const label = `-3dB @ ${formatFreq(point.freq)}`
      u.ctx.fillText(label, cx + 8, cy - 4)
      u.ctx.restore()
    }

    const magOpts = makeOpts('Magnitude', 'Magnitude (dB)', COLORS.magnitude, MAG_HEIGHT, magRange, minus3dBDraw)
    magOpts.width = containerWidth

    const phaseOpts = makeOpts('Phase', 'Phase (°)', COLORS.phase, PHASE_HEIGHT, phaseRange)
    phaseOpts.width = containerWidth

    const gdOpts = makeOpts('Group Delay', 'Group Delay (s)', COLORS.groupDelay, GD_HEIGHT, gdRange)
    gdOpts.width = containerWidth

    const magData: uPlot.AlignedData = [data.frequencies, data.magnitude]
    const phaseData: uPlot.AlignedData = [data.frequencies, data.phase]
    const gdData: uPlot.AlignedData = [data.frequencies, data.groupDelay]

    magChartRef.current = new uPlot(magOpts, magData, magContainerRef.current)
    phaseChartRef.current = new uPlot(phaseOpts, phaseData, phaseContainerRef.current)
    gdChartRef.current = new uPlot(gdOpts, gdData, gdContainerRef.current)

    // Double-click to reset zoom
    const handleDblClick = () => {
      const freqs = dataRef.current?.frequencies
      if (!freqs || freqs.length === 0) return
      const min = freqs[0]!
      const max = freqs[freqs.length - 1]!
      magChartRef.current?.setScale('x', { min, max })
      phaseChartRef.current?.setScale('x', { min, max })
      gdChartRef.current?.setScale('x', { min, max })
    }

    magContainerRef.current.addEventListener('dblclick', handleDblClick)
    phaseContainerRef.current.addEventListener('dblclick', handleDblClick)
    gdContainerRef.current.addEventListener('dblclick', handleDblClick)

    const magEl = magContainerRef.current
    const phaseEl = phaseContainerRef.current
    const gdEl = gdContainerRef.current

    return () => {
      magChartRef.current?.destroy()
      phaseChartRef.current?.destroy()
      gdChartRef.current?.destroy()
      magChartRef.current = null
      phaseChartRef.current = null
      gdChartRef.current = null
      magEl.removeEventListener('dblclick', handleDblClick)
      phaseEl.removeEventListener('dblclick', handleDblClick)
      gdEl.removeEventListener('dblclick', handleDblClick)
    }
  }, [data])

  // Resize observer
  useEffect(() => {
    const container = magContainerRef.current
    if (!container) return

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (!width) return
      magChartRef.current?.setSize({ width, height: MAG_HEIGHT })
      phaseChartRef.current?.setSize({ width, height: PHASE_HEIGHT })
      gdChartRef.current?.setSize({ width, height: GD_HEIGHT })
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white">
        <p className="text-sm text-gray-400">No frequency response data. Run a calculation first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-right text-xs text-gray-400">Drag to zoom · Double-click to reset</p>
      <div ref={magContainerRef} data-testid="chart-magnitude" />
      <div ref={phaseContainerRef} data-testid="chart-phase" />
      <div ref={gdContainerRef} data-testid="chart-group-delay" />
    </div>
  )
}

function formatFreq(hz: number): string {
  if (hz >= 1e6) return `${(hz / 1e6).toPrecision(3)} MHz`
  if (hz >= 1e3) return `${(hz / 1e3).toPrecision(3)} kHz`
  return `${hz.toPrecision(3)} Hz`
}

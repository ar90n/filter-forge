import { useRef, useCallback } from 'react'
import type { Component, CircuitTopology } from '@/types/filter.ts'
import { formatCapacitance, formatInductance, formatResistance } from '@/lib/units.ts'

type CircuitDiagramProps = {
  components: Component[] | null
  topology: CircuitTopology | null
  sourceImpedance?: number
  loadImpedance?: number
}

function formatComponentValue(comp: Component): string {
  switch (comp.type) {
    case 'capacitor':
      return formatCapacitance(comp.value)
    case 'inductor':
      return formatInductance(comp.value)
    case 'resistor':
      return formatResistance(comp.value)
  }
}

// --- Layout constants ---
const MAIN_Y = 50 // Main line Y coordinate
const GND_Y = 170 // Ground line Y coordinate (room for shunt components + wires)
const MARGIN_LEFT = 80 // Left margin (for Rs display)
const WIRE_GAP = 30 // Wire length between components
const SHUNT_SECTION_W = 80 // Horizontal space for shunt components

// --- Component dimensions ---
// Resistor/Inductor: width=60, center line y=10 (height 20)
// Capacitor: width=40, center line y=15 (height 30)
const SERIES_W = 60 // Series component horizontal width (R, L)
const CAP_W = 40 // Capacitor horizontal width
const WIRE_CENTER_Y = 10 // R/L center line Y (relative to translate)

/**
 * Render a series component. Component is placed horizontally.
 * Connection points: left (x, y+10), right (x+W, y+10)
 */
function SeriesGlyph({ type, x, y }: { type: Component['type']; x: number; y: number }) {
  switch (type) {
    case 'resistor':
      return (
        <g transform={`translate(${x}, ${y})`}>
          <polyline
            points="0,10 10,10 15,0 25,20 35,0 45,20 50,10 60,10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </g>
      )
    case 'inductor':
      return (
        <g transform={`translate(${x}, ${y})`}>
          <path
            d="M 0,10 L 6,10 A 6,6 0 0,1 18,10 A 6,6 0 0,1 30,10 A 6,6 0 0,1 42,10 A 6,6 0 0,1 54,10 L 60,10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </g>
      )
    case 'capacitor':
      // Capacitor is 40px wide. Centered in the 60px slot with lead wires on both sides
      return (
        <g transform={`translate(${x}, ${y})`}>
          <line x1="0" y1="10" x2="26" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="34" y1="10" x2="60" y2="10" stroke="currentColor" strokeWidth="1.5" />
          <line x1="26" y1="-2" x2="26" y2="22" stroke="currentColor" strokeWidth="2" />
          <line x1="34" y1="-2" x2="34" y2="22" stroke="currentColor" strokeWidth="2" />
        </g>
      )
  }
}

/**
 * Render a shunt component. Placed vertically.
 * centerX: Center X coordinate (connection point on main line)
 * topY: Top Y coordinate (start of connection wire)
 *
 * Connection points: top (centerX, topY), bottom (centerX, topY + height)
 */
function ShuntGlyph({
  type,
  centerX,
  topY,
}: {
  type: Component['type']
  centerX: number
  topY: number
}) {
  // Draw each component vertically (90-degree rotation)
  // Connection points run through the center top and bottom
  switch (type) {
    case 'capacitor': {
      // Original: width=40, center y=15. After rotation: height=40
      // Top lead(0->16), gap(16->24), bottom lead(24->40)
      const h = CAP_W // Height after rotation = original width = 40
      const midY = topY + h / 2
      return (
        <g>
          {/* Top lead */}
          <line x1={centerX} y1={topY} x2={centerX} y2={midY - 4} stroke="currentColor" strokeWidth="1.5" />
          {/* Parallel plates (horizontal lines with vertical gap) */}
          <line x1={centerX - 12} y1={midY - 4} x2={centerX + 12} y2={midY - 4} stroke="currentColor" strokeWidth="2" />
          <line x1={centerX - 12} y1={midY + 4} x2={centerX + 12} y2={midY + 4} stroke="currentColor" strokeWidth="2" />
          {/* Bottom lead */}
          <line x1={centerX} y1={midY + 4} x2={centerX} y2={topY + h} stroke="currentColor" strokeWidth="1.5" />
        </g>
      )
    }
    case 'inductor': {
      // Original: width=60, center y=10. After rotation: height=60
      const h = SERIES_W // 60
      // 4 semicircular arcs drawn vertically
      const startY = topY
      return (
        <g>
          <path
            d={[
              `M ${centerX},${startY} L ${centerX},${startY + 6}`,
              `A 6,6 0 0,0 ${centerX},${startY + 18}`,
              `A 6,6 0 0,0 ${centerX},${startY + 30}`,
              `A 6,6 0 0,0 ${centerX},${startY + 42}`,
              `A 6,6 0 0,0 ${centerX},${startY + 54}`,
              `L ${centerX},${startY + h}`,
            ].join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </g>
      )
    }
    case 'resistor': {
      // Original: width=60, center y=10. After rotation: height=60
      const h = SERIES_W // 60
      const startY = topY
      return (
        <g>
          <polyline
            points={[
              `${centerX},${startY}`,
              `${centerX},${startY + 10}`,
              `${centerX - 10},${startY + 15}`,
              `${centerX + 10},${startY + 25}`,
              `${centerX - 10},${startY + 35}`,
              `${centerX + 10},${startY + 45}`,
              `${centerX},${startY + 50}`,
              `${centerX},${startY + h}`,
            ].join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </g>
      )
    }
  }
}

/** Vertical height of a shunt component */
function shuntHeight(type: Component['type']): number {
  return type === 'capacitor' ? CAP_W : SERIES_W
}

// --- Ground symbol ---
function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="-8" y1="6" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="-5" y1="10" x2="5" y2="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="-2" y1="14" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" />
    </g>
  )
}

// --- Position descriptor for layout ---
type PlacedItem =
  | { kind: 'series'; comp: Component; x: number }
  | { kind: 'shunt'; comp: Component; centerX: number }

// --- Ladder-T layout ---
function LadderTLayout({
  components,
  sourceImpedance,
  loadImpedance,
}: {
  components: Component[]
  sourceImpedance?: number
  loadImpedance?: number
}) {
  // ===== Pass 1: calculate positions =====
  const placed: PlacedItem[] = []
  let xCursor = MARGIN_LEFT

  for (const comp of components) {
    if (comp.position === 'series') {
      placed.push({ kind: 'series', comp, x: xCursor })
      xCursor += SERIES_W + WIRE_GAP
    } else {
      const centerX = xCursor + SHUNT_SECTION_W / 2
      placed.push({ kind: 'shunt', comp, centerX })
      xCursor += SHUNT_SECTION_W
    }
  }

  const endX = xCursor + 40
  const totalWidth = endX + 60
  const totalHeight = GND_Y + 20

  const lineY = MAIN_Y + WIRE_CENTER_Y // Main line Y (component center line)

  // ===== Pass 2: render =====
  const elements: React.ReactNode[] = []

  // Source impedance
  const rsLabel = sourceImpedance != null ? formatResistance(sourceImpedance) : 'Rs'
  elements.push(
    <g key="rs">
      <text x={10} y={MAIN_Y - 16} fontSize="10" fill="#374151" fontWeight="bold">
        Rs
      </text>
      <text x={10} y={MAIN_Y - 4} fontSize="9" fill="#6b7280">
        {rsLabel}
      </text>
      <circle cx={40} cy={lineY} r="3" fill="currentColor" />
      <line x1={40} y1={lineY} x2={MARGIN_LEFT} y2={lineY} stroke="currentColor" strokeWidth="1.5" />
      <line x1={40} y1={lineY} x2={40} y2={GND_Y} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4,3" />
      <Ground x={40} y={GND_Y} />
    </g>,
  )

  // Place components
  let prevEndX = MARGIN_LEFT
  for (const item of placed) {
    if (item.kind === 'series') {
      // Connecting wire
      if (prevEndX < item.x) {
        elements.push(
          <line
            key={`wire-to-${item.comp.id}`}
            x1={prevEndX} y1={lineY} x2={item.x} y2={lineY}
            stroke="currentColor" strokeWidth="1.5"
          />,
        )
      }
      // Component
      elements.push(
        <g key={`comp-${item.comp.id}`}>
          <SeriesGlyph type={item.comp.type} x={item.x} y={MAIN_Y} />
          <text
            x={item.x + SERIES_W / 2} y={MAIN_Y - 16}
            textAnchor="middle" fontSize="9" fill="#374151" fontWeight="bold"
          >
            {item.comp.id}
          </text>
          <text
            x={item.x + SERIES_W / 2} y={MAIN_Y - 4}
            textAnchor="middle" fontSize="9" fill="#6b7280"
          >
            {formatComponentValue(item.comp)}
          </text>
        </g>,
      )
      prevEndX = item.x + SERIES_W
    } else {
      // shunt: connect to main line
      if (prevEndX < item.centerX) {
        elements.push(
          <line
            key={`wire-to-shunt-${item.comp.id}`}
            x1={prevEndX} y1={lineY} x2={item.centerX} y2={lineY}
            stroke="currentColor" strokeWidth="1.5"
          />,
        )
      }
      const shuntRightX = item.centerX + SHUNT_SECTION_W / 2
      elements.push(
        <line
          key={`wire-past-shunt-${item.comp.id}`}
          x1={item.centerX} y1={lineY} x2={shuntRightX} y2={lineY}
          stroke="currentColor" strokeWidth="1.5"
        />,
      )
      prevEndX = shuntRightX

      // Connection dot
      elements.push(
        <circle key={`dot-${item.comp.id}`} cx={item.centerX} cy={lineY} r="3" fill="currentColor" />,
      )

      // Top wire (from main line to component top)
      const compTopY = lineY + 10
      elements.push(
        <line
          key={`shunt-wire-top-${item.comp.id}`}
          x1={item.centerX} y1={lineY} x2={item.centerX} y2={compTopY}
          stroke="currentColor" strokeWidth="1.5"
        />,
      )

      // Vertical component (dedicated ShuntGlyph — no rotation)
      const h = shuntHeight(item.comp.type)
      elements.push(
        <ShuntGlyph
          key={`comp-${item.comp.id}`}
          type={item.comp.type}
          centerX={item.centerX}
          topY={compTopY}
        />,
      )

      // Label (right side of component)
      const labelX = item.centerX + 18
      const labelY = compTopY + h / 2
      elements.push(
        <g key={`label-${item.comp.id}`}>
          <text x={labelX} y={labelY - 6} fontSize="9" fill="#374151" fontWeight="bold">
            {item.comp.id}
          </text>
          <text x={labelX} y={labelY + 6} fontSize="9" fill="#6b7280">
            {formatComponentValue(item.comp)}
          </text>
        </g>,
      )

      // Bottom wire (from component bottom to ground)
      const compBottomY = compTopY + h
      elements.push(
        <line
          key={`shunt-wire-bot-${item.comp.id}`}
          x1={item.centerX} y1={compBottomY} x2={item.centerX} y2={GND_Y}
          stroke="currentColor" strokeWidth="1.5"
        />,
      )
      elements.push(<Ground key={`gnd-${item.comp.id}`} x={item.centerX} y={GND_Y} />)
    }
  }

  // End wire to load
  const rlX = endX
  elements.push(
    <line
      key="wire-to-rl"
      x1={prevEndX} y1={lineY} x2={rlX} y2={lineY}
      stroke="currentColor" strokeWidth="1.5"
    />,
  )

  // Load impedance
  const rlLabel = loadImpedance != null ? formatResistance(loadImpedance) : 'Rl'
  elements.push(
    <g key="rl">
      <circle cx={rlX} cy={lineY} r="3" fill="currentColor" />
      <text x={rlX + 8} y={MAIN_Y - 16} fontSize="10" fill="#374151" fontWeight="bold">
        Rl
      </text>
      <text x={rlX + 8} y={MAIN_Y - 4} fontSize="9" fill="#6b7280">
        {rlLabel}
      </text>
      <line x1={rlX} y1={lineY} x2={rlX} y2={GND_Y} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4,3" />
      <Ground x={rlX} y={GND_Y} />
    </g>,
  )

  // Ground line
  const gndLineStart = 30
  const gndLineEnd = rlX + 10

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className="text-gray-800"
      role="img"
      aria-label="Circuit diagram"
    >
      <line
        x1={gndLineStart} y1={GND_Y} x2={gndLineEnd} y2={GND_Y}
        stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="4,4"
      />
      {elements}
    </svg>
  )
}

// --- Lattice layout (X-section) ---
// Lattice network: Two horizontal rails (top/bottom) + diagonal crossing (X).
//
//   TL ────Za(top)──── TR
//   |         ╲╱         |
//   |          X  Zb     |
//   |         ╱╲         |
//   BL ────Za(bot)──── BR
//
// Za (series arms): Top rail TL->TR, bottom rail BL->BR (horizontal)
// Zb (lattice/diagonal arms): TL->BR, BL->TR (diagonal crossing)
// Input: TL-BL (Port 1), Output: TR-BR (Port 2)
//

/**
 * Capacitor drawn natively along any direction.
 * Placed on the line from (x1,y1) to (x2,y2).
 */
function DirectionalCapacitor({
  x1, y1, x2, y2,
}: { x1: number; y1: number; x2: number; y2: number }) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux

  const gap = 4
  const plateLen = 12

  const p1x = mx - gap * ux
  const p1y = my - gap * uy
  const p2x = mx + gap * ux
  const p2y = my + gap * uy

  return (
    <g>
      <line x1={x1} y1={y1} x2={p1x} y2={p1y} stroke="currentColor" strokeWidth="1.5" />
      <line
        x1={p1x - plateLen * nx} y1={p1y - plateLen * ny}
        x2={p1x + plateLen * nx} y2={p1y + plateLen * ny}
        stroke="currentColor" strokeWidth="2"
      />
      <line
        x1={p2x - plateLen * nx} y1={p2y - plateLen * ny}
        x2={p2x + plateLen * nx} y2={p2y + plateLen * ny}
        stroke="currentColor" strokeWidth="2"
      />
      <line x1={p2x} y1={p2y} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" />
    </g>
  )
}

/**
 * Inductor drawn natively along any direction.
 * Placed on the line from (x1,y1) to (x2,y2).
 */
function DirectionalInductor({
  x1, y1, x2, y2,
}: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux

  const coilLen = len * 0.6
  const startOff = (len - coilLen) / 2
  const arcLen = coilLen / 4
  const bulge = arcLen * 0.8

  let d = `M ${x1} ${y1}`
  const arcStart = { x: x1 + startOff * ux, y: y1 + startOff * uy }
  d += ` L ${arcStart.x} ${arcStart.y}`

  for (let i = 0; i < 4; i++) {
    const t = startOff + (i + 1) * arcLen
    const ex = x1 + t * ux
    const ey = y1 + t * uy
    const cmx = x1 + (startOff + (i + 0.5) * arcLen) * ux
    const cmy = y1 + (startOff + (i + 0.5) * arcLen) * uy
    const cx = cmx + bulge * nx
    const cy = cmy + bulge * ny
    d += ` Q ${cx} ${cy} ${ex} ${ey}`
  }

  d += ` L ${x2} ${y2}`
  return <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
}

/**
 * Resistor drawn natively along any direction.
 * Placed on the line from (x1,y1) to (x2,y2).
 */
function DirectionalResistor({
  x1, y1, x2, y2,
}: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux

  const zigLen = len * 0.6
  const startOff = (len - zigLen) / 2
  const amp = 10
  const segments = 6

  let points = `${x1},${y1}`
  const zStart = { x: x1 + startOff * ux, y: y1 + startOff * uy }
  points += ` ${zStart.x},${zStart.y}`

  for (let i = 1; i <= segments; i++) {
    const t = startOff + (i / segments) * zigLen
    const px = x1 + t * ux
    const py = y1 + t * uy
    const sign = i % 2 === 1 ? 1 : -1
    const offsetX = sign * amp * nx
    const offsetY = sign * amp * ny
    if (i < segments) {
      points += ` ${px + offsetX},${py + offsetY}`
    } else {
      points += ` ${px},${py}`
    }
  }

  points += ` ${x2},${y2}`
  return <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
}

/** Dispatch directional component rendering */
function DirectionalGlyph({
  type, x1, y1, x2, y2,
}: { type: Component['type']; x1: number; y1: number; x2: number; y2: number }) {
  switch (type) {
    case 'capacitor':
      return <DirectionalCapacitor x1={x1} y1={y1} x2={x2} y2={y2} />
    case 'inductor':
      return <DirectionalInductor x1={x1} y1={y1} x2={x2} y2={y2} />
    case 'resistor':
      return <DirectionalResistor x1={x1} y1={y1} x2={x2} y2={y2} />
  }
}

function LatticeLayout({
  components,
  sourceImpedance,
  loadImpedance,
}: {
  components: Component[]
  sourceImpedance?: number
  loadImpedance?: number
}) {
  const sections: Array<{ seriesComp: Component; shuntComp: Component }> = []
  for (let i = 0; i < components.length - 1; i += 2) {
    sections.push({
      seriesComp: components[i]!,
      shuntComp: components[i + 1]!,
    })
  }

  // X-section single section dimensions
  const sectionW = 160 // Section horizontal width (Za arm length)
  const railGap = 120 // Vertical distance between top/bottom rails
  const gapBetween = 40 // Wire length between sections
  const marginL = 80 // Left margin (for Rs display)
  const marginR = 80 // Right margin (for Rl display)
  const topPad = 40 // Top padding (for labels)

  const topY = topPad // Top rail Y
  const botY = topPad + railGap // Bottom rail Y

  // Overall dimensions
  const sectionSpan = sectionW + gapBetween
  const totalWidth = marginL + sections.length * sectionSpan - gapBetween + marginR
  const totalHeight = botY + 50

  const rsLabel = sourceImpedance != null ? formatResistance(sourceImpedance) : 'Rs'
  const rlLabel = loadImpedance != null ? formatResistance(loadImpedance) : 'Rl'

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className="text-gray-800"
      role="img"
      aria-label="Lattice circuit diagram"
    >
      {sections.map((sec, idx) => {
        const x0 = marginL + idx * sectionSpan
        const x1 = x0 + sectionW

        // 4 nodes: TL, TR, BL, BR
        const TL = { x: x0, y: topY }
        const TR = { x: x1, y: topY }
        const BL = { x: x0, y: botY }
        const BR = { x: x1, y: botY }

        // Diagonal crossing center
        const cx = (x0 + x1) / 2
        const cy = (topY + botY) / 2

        // Crossing avoidance for Zb: split each diagonal arm into segments.
        // Zb1 (TL->BR): TL -> component (upper-left quadrant) -> crossing -> wire to BR
        // Zb2 (BL->TR): BL -> crossing -> component (upper-right quadrant) -> wire to TR
        //
        // Zb label positions: midpoint of each diagonal arm
        const zb1Mid = { x: (TL.x + cx) / 2, y: (TL.y + cy) / 2 } // upper-left quadrant
        const zb2Mid = { x: (cx + TR.x) / 2, y: (cy + TR.y) / 2 } // upper-right quadrant

        return (
          <g key={idx}>
            {/* 4 nodes */}
            <circle cx={TL.x} cy={TL.y} r="3" fill="currentColor" />
            <circle cx={TR.x} cy={TR.y} r="3" fill="currentColor" />
            <circle cx={BL.x} cy={BL.y} r="3" fill="currentColor" />
            <circle cx={BR.x} cy={BR.y} r="3" fill="currentColor" />

            {/* ── Za (series arms): top rail TL->TR, bottom rail BL->BR (horizontal) ── */}
            <DirectionalGlyph type={sec.seriesComp.type}
              x1={TL.x} y1={TL.y} x2={TR.x} y2={TR.y} />
            <DirectionalGlyph type={sec.seriesComp.type}
              x1={BL.x} y1={BL.y} x2={BR.x} y2={BR.y} />

            {/* Za label (above top rail) */}
            <text x={(TL.x + TR.x) / 2} y={topY - 20}
              textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">
              {sec.seriesComp.id}
            </text>
            <text x={(TL.x + TR.x) / 2} y={topY - 8}
              textAnchor="middle" fontSize="9" fill="#6b7280">
              {formatComponentValue(sec.seriesComp)}
            </text>

            {/* Za label (below bottom rail) */}
            <text x={(BL.x + BR.x) / 2} y={botY + 16}
              textAnchor="middle" fontSize="10" fill="#374151" fontWeight="bold">
              {sec.seriesComp.id}
            </text>
            <text x={(BL.x + BR.x) / 2} y={botY + 28}
              textAnchor="middle" fontSize="9" fill="#6b7280">
              {formatComponentValue(sec.seriesComp)}
            </text>

            {/* ── Zb1 (TL->BR): component in upper-left quadrant, wire to BR ── */}
            <DirectionalGlyph type={sec.shuntComp.type}
              x1={TL.x} y1={TL.y} x2={cx} y2={cy} />
            <line x1={cx} y1={cy} x2={BR.x} y2={BR.y}
              stroke="currentColor" strokeWidth="1.5" />

            {/* Zb1 label (upper-left quadrant) */}
            <text x={zb1Mid.x - 16} y={zb1Mid.y - 4}
              textAnchor="end" fontSize="10" fill="#374151" fontWeight="bold">
              {sec.shuntComp.id}
            </text>
            <text x={zb1Mid.x - 16} y={zb1Mid.y + 10}
              textAnchor="end" fontSize="9" fill="#6b7280">
              {formatComponentValue(sec.shuntComp)}
            </text>

            {/* ── Zb2 (BL->TR): wire to crossing, component in upper-right quadrant ── */}
            <line x1={BL.x} y1={BL.y} x2={cx} y2={cy}
              stroke="currentColor" strokeWidth="1.5" />
            <DirectionalGlyph type={sec.shuntComp.type}
              x1={cx} y1={cy} x2={TR.x} y2={TR.y} />

            {/* Zb2 label (upper-right quadrant) */}
            <text x={zb2Mid.x + 16} y={zb2Mid.y - 4}
              textAnchor="start" fontSize="10" fill="#374151" fontWeight="bold">
              {sec.shuntComp.id}
            </text>
            <text x={zb2Mid.x + 16} y={zb2Mid.y + 10}
              textAnchor="start" fontSize="9" fill="#6b7280">
              {formatComponentValue(sec.shuntComp)}
            </text>

            {/* Inter-section connecting wires */}
            {idx > 0 && (
              <>
                <line x1={x0 - gapBetween} y1={topY} x2={TL.x} y2={topY}
                  stroke="currentColor" strokeWidth="1.5" />
                <line x1={x0 - gapBetween} y1={botY} x2={BL.x} y2={botY}
                  stroke="currentColor" strokeWidth="1.5" />
              </>
            )}
          </g>
        )
      })}

      {/* Source — connected to left nodes (TL, BL) of the first section */}
      {sections.length > 0 && (() => {
        const firstX = marginL
        return (
          <g>
            {/* Input wires (top/bottom) */}
            <line x1={marginL - 30} y1={topY} x2={firstX} y2={topY}
              stroke="currentColor" strokeWidth="1.5" />
            <line x1={marginL - 30} y1={botY} x2={firstX} y2={botY}
              stroke="currentColor" strokeWidth="1.5" />
            {/* Rs label (left center) */}
            <text x={14} y={(topY + botY) / 2 - 8} fontSize="10" fill="#374151" fontWeight="bold">Rs</text>
            <text x={14} y={(topY + botY) / 2 + 6} fontSize="9" fill="#6b7280">{rsLabel}</text>
            <circle cx={marginL - 30} cy={topY} r="3" fill="currentColor" />
            <circle cx={marginL - 30} cy={botY} r="3" fill="currentColor" />
            {/* Port labels */}
            <text x={marginL - 30} y={topY - 10}
              textAnchor="middle" fontSize="8" fill="#9ca3af">+</text>
            <text x={marginL - 30} y={botY + 40}
              textAnchor="middle" fontSize="8" fill="#9ca3af">−</text>
          </g>
        )
      })()}

      {/* Load — connected to right nodes (TR, BR) of the last section */}
      {sections.length > 0 && (() => {
        const lastRightX = marginL + (sections.length - 1) * sectionSpan + sectionW
        return (
          <g>
            <line x1={lastRightX} y1={topY} x2={lastRightX + 30} y2={topY}
              stroke="currentColor" strokeWidth="1.5" />
            <line x1={lastRightX} y1={botY} x2={lastRightX + 30} y2={botY}
              stroke="currentColor" strokeWidth="1.5" />
            <circle cx={lastRightX + 30} cy={topY} r="3" fill="currentColor" />
            <circle cx={lastRightX + 30} cy={botY} r="3" fill="currentColor" />
            <text x={lastRightX + 40} y={(topY + botY) / 2 - 8}
              fontSize="10" fill="#374151" fontWeight="bold">Rl</text>
            <text x={lastRightX + 40} y={(topY + botY) / 2 + 6}
              fontSize="9" fill="#6b7280">{rlLabel}</text>
            <text x={lastRightX + 30} y={topY - 10}
              textAnchor="middle" fontSize="8" fill="#9ca3af">+</text>
            <text x={lastRightX + 30} y={botY + 40}
              textAnchor="middle" fontSize="8" fill="#9ca3af">−</text>
          </g>
        )
      })()}
    </svg>
  )
}

// --- SVG Export ---
function saveSvgAsPng(svgElement: SVGSVGElement, filename: string) {
  // Get pixel dimensions from viewBox
  const viewBox = svgElement.getAttribute('viewBox')
  let w = svgElement.clientWidth || 800
  let h = svgElement.clientHeight || 400
  if (viewBox) {
    const parts = viewBox.split(/\s+/)
    w = Number(parts[2])
    h = Number(parts[3])
  }

  // Set explicit width/height on SVG clone (width="100%" prevents correct rendering in Image)
  const clone = svgElement.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))

  const svgData = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const scale = 2 // Retina-quality export
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)

    canvas.toBlob((blob) => {
      if (!blob) return
      const pngUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')
  }
  img.src = url
}

// --- Main component ---
export function CircuitDiagram({
  components,
  topology,
  sourceImpedance,
  loadImpedance,
}: CircuitDiagramProps) {
  const svgContainerRef = useRef<HTMLDivElement>(null)

  const handleSave = useCallback(() => {
    const svg = svgContainerRef.current?.querySelector('svg')
    if (!svg) return
    saveSvgAsPng(svg, 'circuit-diagram.png')
  }, [])

  if (!components || components.length === 0 || !topology) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400"
        data-testid="circuit-placeholder"
      >
        No circuit data. Run a calculation first.
      </div>
    )
  }

  return (
    <div data-testid="circuit-diagram" className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Circuit Diagram</h3>
        <button
          onClick={handleSave}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Save PNG
        </button>
      </div>
      <div ref={svgContainerRef}>
        {topology === 'lattice' ? (
          <LatticeLayout
            components={components}
            sourceImpedance={sourceImpedance}
            loadImpedance={loadImpedance}
          />
        ) : (
          <LadderTLayout
            components={components}
            sourceImpedance={sourceImpedance}
            loadImpedance={loadImpedance}
          />
        )}
      </div>
    </div>
  )
}

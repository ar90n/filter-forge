/**
 * Capacitor symbol (parallel plates)
 * viewBox: 40x30, center y=15
 */
export function Capacitor({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Lead wires */}
      <line x1="0" y1="15" x2="16" y2="15" stroke="currentColor" strokeWidth="1.5" />
      <line x1="24" y1="15" x2="40" y2="15" stroke="currentColor" strokeWidth="1.5" />
      {/* Parallel plates */}
      <line x1="16" y1="3" x2="16" y2="27" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="3" x2="24" y2="27" stroke="currentColor" strokeWidth="2" />
      {label && (
        <text x="20" y="44" textAnchor="middle" fontSize="10" fill="#374151">
          {label}
        </text>
      )}
    </g>
  )
}

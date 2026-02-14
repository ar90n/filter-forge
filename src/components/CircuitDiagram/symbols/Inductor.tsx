/**
 * Inductor symbol (coil semicircular arcs)
 * viewBox: 60x20, center y=10
 */
export function Inductor({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d={[
          'M 0,10 L 6,10',
          'A 6,6 0 0,1 18,10',
          'A 6,6 0 0,1 30,10',
          'A 6,6 0 0,1 42,10',
          'A 6,6 0 0,1 54,10',
          'L 60,10',
        ].join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {label && (
        <text x="30" y="35" textAnchor="middle" fontSize="10" fill="#374151">
          {label}
        </text>
      )}
    </g>
  )
}

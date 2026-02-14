/**
 * Resistor symbol (zigzag shape)
 * viewBox: 60x20, center y=10
 */
export function Resistor({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polyline
        points="0,10 10,10 15,0 25,20 35,0 45,20 50,10 60,10"
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

import { useState } from 'react'
import type { Component } from '@/types/filter.ts'
import { formatCapacitance, formatInductance, formatResistance } from '@/lib/units.ts'

type BomTableProps = {
  components: Component[] | null
}

function formatValue(comp: Component): string {
  switch (comp.type) {
    case 'capacitor':
      return formatCapacitance(comp.value)
    case 'inductor':
      return formatInductance(comp.value)
    case 'resistor':
      return formatResistance(comp.value)
  }
}

function formatType(type: Component['type']): string {
  switch (type) {
    case 'capacitor':
      return 'Capacitor'
    case 'inductor':
      return 'Inductor'
    case 'resistor':
      return 'Resistor'
  }
}

function formatPosition(position: Component['position']): string {
  return position === 'series' ? 'Series' : 'Shunt'
}

function buildCsv(components: Component[]): string {
  const header = '#,Symbol,Type,Value,Position'
  const rows = components.map(
    (comp, i) =>
      `${i + 1},${comp.id},${formatType(comp.type)},${formatValue(comp)},${formatPosition(comp.position)}`,
  )
  return [header, ...rows].join('\n')
}

export function BomTable({ components }: BomTableProps) {
  const [copied, setCopied] = useState(false)

  if (!components || components.length === 0) {
    return (
      <div
        className="flex h-40 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400"
        data-testid="bom-placeholder"
      >
        No BOM data. Run a calculation first.
      </div>
    )
  }

  const handleCopy = async () => {
    const csv = buildCsv(components)
    await navigator.clipboard.writeText(csv)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div data-testid="bom-table" className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Bill of Materials</h3>
        <button
          onClick={handleCopy}
          className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
        >
          {copied ? 'Copied!' : 'Copy CSV'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs font-medium uppercase text-gray-500">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Symbol</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Value</th>
              <th className="px-2 py-2">Position</th>
            </tr>
          </thead>
          <tbody>
            {components.map((comp, i) => (
              <tr key={comp.id} className="border-b border-gray-100">
                <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
                <td className="px-2 py-1.5 font-medium text-gray-800">{comp.id}</td>
                <td className="px-2 py-1.5 text-gray-600">{formatType(comp.type)}</td>
                <td className="px-2 py-1.5 text-gray-600">{formatValue(comp)}</td>
                <td className="px-2 py-1.5 text-gray-600">{formatPosition(comp.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

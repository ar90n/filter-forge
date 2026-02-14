import { useCallback, useEffect, useState } from 'react'
import { usePyodide } from '@/hooks/usePyodide.ts'
import { useFilterDesign } from '@/hooks/useFilterDesign.ts'
import { FilterForm } from '@/components/FilterForm/FilterForm.tsx'
import { LoadingOverlay } from '@/components/LoadingOverlay/LoadingOverlay.tsx'
import { FrequencyChart } from '@/components/FrequencyChart/FrequencyChart.tsx'
import { CircuitDiagram } from '@/components/CircuitDiagram/CircuitDiagram.tsx'
import { BomTable } from '@/components/BomTable/BomTable.tsx'
import { TransferFunction } from '@/components/TransferFunction/TransferFunction.tsx'
import type { FilterParams } from '@/types/filter.ts'

function App() {
  const { status: pyodideStatus, error: pyodideError, api, retry } = usePyodide()
  const { calculationStatus, result, error: calcError, designFilter } = useFilterDesign(api, pyodideStatus)

  // State for passing impedance values to the circuit diagram
  const [impedance, setImpedance] = useState<{ source: number; load: number }>({
    source: 50,
    load: 50,
  })

  const handleDesign = useCallback(
    (params: FilterParams) => {
      setImpedance({
        source: params.sourceImpedance ?? 0,
        load: params.loadImpedance ?? 0,
      })
      return designFilter(params)
    },
    [designFilter],
  )

  // Log calculation results to console
  useEffect(() => {
    if (calculationStatus === 'done' && result) {
      console.log('[FilterForge] Calculation result:', result)
    }
    if (calculationStatus === 'error' && calcError) {
      console.error('[FilterForge] Calculation error:', calcError)
    }
  }, [calculationStatus, result, calcError])

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <LoadingOverlay status={pyodideStatus} error={pyodideError} onRetry={retry} />

      {/* Header */}
      <header className="flex items-center border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <h1 className="text-xl font-bold text-primary-700">FilterForge</h1>
        <span className="ml-3 text-sm text-gray-500">Analog Filter Circuit Designer</span>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Filter specification input form */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4">
          <FilterForm
            onSubmit={handleDesign}
            disabled={pyodideStatus !== 'ready' || calculationStatus === 'calculating'}
          />
        </aside>

        {/* Main area: Charts, circuit diagram, and BOM */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Calculation status */}
          {calculationStatus === 'calculating' && (
            <p className="mb-4 text-sm text-gray-600">Calculating...</p>
          )}
          {calculationStatus === 'error' && calcError && (
            <p className="mb-4 text-sm text-red-600">Error: {calcError.message}</p>
          )}

          {/* Frequency response charts */}
          <FrequencyChart data={result?.frequencyResponse ?? null} />

          {/* Transfer function equation */}
          <TransferFunction latex={result?.transferFunctionLatex ?? null} />

          {/* Circuit diagram + BOM side by side */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <CircuitDiagram
              components={result?.components ?? null}
              topology={result?.circuitTopology ?? null}
              sourceImpedance={impedance.source}
              loadImpedance={impedance.load}
            />
            <BomTable components={result?.components ?? null} />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App

import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

type TransferFunctionProps = {
  latex: string | null
}

export function TransferFunction({ latex }: TransferFunctionProps) {
  const html = useMemo(() => {
    if (!latex) return null
    try {
      return katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
        output: 'htmlAndMathml',
      })
    } catch {
      return null
    }
  }, [latex])

  if (!latex || !html) {
    return (
      <div
        className="flex h-24 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400"
        data-testid="transfer-function-placeholder"
      >
        No transfer function data. Run a calculation first.
      </div>
    )
  }

  return (
    <div data-testid="transfer-function" className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-gray-700">Transfer Function</h2>
      <div
        className="overflow-x-auto"
        data-testid="transfer-function-equation"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

import type { PyodideStatus } from '@/types/filter.ts'

type LoadingOverlayProps = {
  status: PyodideStatus
  error: string | null
  onRetry: () => void
}

export function LoadingOverlay({ status, error, onRetry }: LoadingOverlayProps) {
  if (status === 'ready' || status === 'idle') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-white px-8 py-6 text-center shadow-xl">
        {status === 'loading' && (
          <>
            <div
              className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"
              role="status"
              aria-label="Loading"
            />
            <p className="text-sm text-gray-700">Loading computation engine...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="mb-3 text-sm text-red-600">{error ?? 'An error occurred.'}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'

// Merkle DAG: error_safe -> fallback_page
// Safe fallback page for authentication redirect loops and errors (Client Component for interactivity)
export default function ErrorSafe() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Authentication Error
          </h1>
          <p className="text-gray-600 mb-6">
            We&apos;re experiencing issues with authentication. This could be due to:
          </p>

          <ul className="text-left text-sm text-gray-600 space-y-2 mb-8">
            <li>• Redirect loop detected</li>
            <li>• Session validation issues</li>
            <li>• Network connectivity problems</li>
          </ul>

          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Φ-monotonic routing protection activated
            </p>

            <div className="space-y-3">
              <Link
                href="/"
                className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
              >
                Return to Home
              </Link>

              <button
                onClick={() => window.location.reload()}
                className="block w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400">
          If this problem persists, please contact support.
        </div>
      </div>
    </div>
  )
}

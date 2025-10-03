import { createClient } from '@/utils/supabase/server-utils'
import Link from 'next/link'

// Merkle DAG: protected_app -> server_auth_check
// Server Component for protected application content with server-side authentication
export default async function ProtectedApp() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  // This should be protected by middleware, but double-check for safety
  if (!user || error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You must be signed in to access this page.</p>
          <Link
            href="/signin"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="border-b border-gray-200 pb-4 mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Welcome to your Dashboard</h1>
            <p className="mt-2 text-gray-600">
              You are successfully authenticated and accessing protected content.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-blue-900 mb-3">User Information</h2>
              <div className="space-y-2">
                <p><span className="font-medium">Email:</span> {user.email}</p>
                <p><span className="font-medium">User ID:</span> {user.id}</p>
                <p><span className="font-medium">Created:</span> {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="bg-green-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-green-900 mb-3">Application Features</h2>
              <ul className="space-y-2 text-green-800">
                <li>• Server-side authentication</li>
                <li>• DAG-based routing</li>
                <li>• ActorDB integration ready</li>
                <li>• Secure session management</li>
                <li>• TODO task management</li>
              </ul>
              <div className="mt-4">
                <Link
                  href="/todo"
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Try TODO App →
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                Protected by middleware-based authentication (Φ=0)
              </div>
              <form action="/auth/signout" method="post" className="inline">
                <button
                  type="submit"
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-medium transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

// Merkle DAG: home_page -> auth_state_display
// Server Component that checks authentication state and displays appropriate content
export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="font-sans min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-8 items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            Welcome to Dekigoto
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            ActorDB-powered Next.js application with Supabase authentication
          </p>

          {user ? (
            <div className="space-y-4">
              <p className="text-green-600 font-medium">
                Welcome back, {user.email}!
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/app"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Go to App
                </Link>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                  >
                    Sign Out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">
                Get started by signing in or creating an account
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/signin"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">ActorDB Integration</h3>
              <p className="text-sm text-gray-600">
                Powered by ActorDB for reliable event-driven architecture
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">Supabase Auth</h3>
              <p className="text-sm text-gray-600">
                Secure authentication with server-side session management
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold mb-2">DAG-based Routing</h3>
              <p className="text-sm text-gray-600">
                Φ-monotonic routing with middleware-based authentication
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

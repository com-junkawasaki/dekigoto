import { createBrowserClient } from '@supabase/ssr'

// Merkle DAG: browser_client -> supabase_auth_flow
// Browser client for client-side operations (authentication, real-time subscriptions)
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

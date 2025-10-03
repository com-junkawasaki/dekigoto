'use client'

// Merkle DAG: session_provider -> auth_state_management
// Note: Using @supabase/ssr pattern instead of deprecated auth-helpers-react
// Session management is handled via middleware and server components
export function SessionProvider({ children }: { children: React.ReactNode }) {
  // With @supabase/ssr, session management is primarily server-side
  // Client components can use the client directly when needed
  return <>{children}</>
}

import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Merkle DAG: auth_confirm -> email_verification
// Route handler for email confirmation with OTP verification
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('token_hash')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      token_hash: code,
      type: 'email',
    })

    if (!error) {
      // Successfully verified email
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        // We can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}

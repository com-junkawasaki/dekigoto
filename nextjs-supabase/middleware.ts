import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Merkle DAG: middleware_auth -> dag_routing_control
// Authentication middleware with DAG-based routing (Φ decreasing principle)
// Φ values: 2=unauthenticated, 1=additional_requirements(MFA/onboarding), 0=completed

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get current user (server-side authentication)
  const { data: { user }, error } = await supabase.auth.getUser()

  const url = request.nextUrl
  const pathname = url.pathname

  // Get redirect count for fallback protection
  const redirectCount = parseInt(request.cookies.get('redirect_count')?.value || '0')

  // Debug headers
  response.headers.set('x-phi-before', getPhiValue(user, pathname).toString())
  response.headers.set('x-redirect-from', pathname)
  response.headers.set('x-redirect-count', redirectCount.toString())

  // Routes that don't require authentication
  const publicRoutes = ['/', '/signin', '/signup', '/auth/confirm']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Current Φ value
  const currentPhi = getPhiValue(user, pathname)

  if (isPublicRoute) {
    // Public routes: allow access but redirect authenticated users to app
    if (user && currentPhi === 0) {
      const appUrl = new URL('/app', url)
      response.headers.set('x-redirect-to', '/app')
      return NextResponse.redirect(appUrl)
    }
  } else {
    // Protected routes: check authentication and Φ decreasing
    if (!user) {
      // Φ=2: Unauthenticated - redirect to signin
      const signinUrl = new URL('/signin', url)
      signinUrl.searchParams.set('redirectTo', pathname)
      response.cookies.set('redirect_count', (redirectCount + 1).toString(), {
        maxAge: 60 * 5, // 5 minutes
      })

      // Prevent infinite redirect loops
      if (redirectCount >= 3) {
        const safeUrl = new URL('/error-safe', url)
        response.headers.set('x-redirect-reason', 'redirect_loop_detected')
        return NextResponse.redirect(safeUrl)
      }

      response.headers.set('x-redirect-to', signinUrl.pathname)
      return NextResponse.redirect(signinUrl)
    }

    // Check for additional requirements (MFA, onboarding)
    const additionalRequirements = await checkAdditionalRequirements(user)

    if (additionalRequirements.length > 0) {
      // Φ=1: Additional requirements
      if (!pathname.startsWith('/onboarding') && !pathname.startsWith('/mfa')) {
        const onboardingUrl = new URL('/onboarding', url)
        response.cookies.set('redirect_count', (redirectCount + 1).toString(), {
          maxAge: 60 * 5,
        })

        if (redirectCount >= 3) {
          const safeUrl = new URL('/error-safe', url)
          response.headers.set('x-redirect-reason', 'onboarding_loop_detected')
          return NextResponse.redirect(safeUrl)
        }

        response.headers.set('x-redirect-to', onboardingUrl.pathname)
        return NextResponse.redirect(onboardingUrl)
      }
    }

    // Φ=0: Fully authenticated - allow access
  }

  response.headers.set('x-phi-after', currentPhi.toString())
  return response
}

// Calculate Φ value based on user state and route
function getPhiValue(user: any, pathname: string): number {
  if (!user) return 2 // Unauthenticated

  // Check if user has completed all requirements
  // This would typically check user metadata, MFA status, etc.
  const hasCompletedOnboarding = user.user_metadata?.onboarding_completed === true
  const hasMFAEnabled = user.user_metadata?.mfa_enabled === true

  if (!hasCompletedOnboarding || !hasMFAEnabled) {
    return 1 // Additional requirements
  }

  return 0 // Completed
}

// Check for additional requirements (MFA, onboarding, etc.)
async function checkAdditionalRequirements(user: any): Promise<string[]> {
  const requirements = []

  if (!user.user_metadata?.onboarding_completed) {
    requirements.push('onboarding')
  }

  if (!user.user_metadata?.mfa_enabled) {
    requirements.push('mfa')
  }

  return requirements
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

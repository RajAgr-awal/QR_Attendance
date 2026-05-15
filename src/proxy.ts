/**
 * proxy.ts — Next.js Route Protection (Next.js 16+)
 * Previously: middleware.ts (renamed in Next.js 16)
 *
 * Protected routes:
 *   /admin/*     — requires authenticated user with role: admin
 *   /scan/*      — requires authenticated user with role: admin | scanner
 *   /dashboard/* — requires any authenticated user
 *
 * Unauthenticated users are redirected to /login.
 * After login, Supabase redirects back to the originally requested URL.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that require authentication
const PROTECTED_PATTERNS = [
  /^\/admin(\/.*)?$/,   // /admin and /admin/*
  /^\/scan(\/.*)?$/,    // /scan and /scan/*
  /^\/dashboard(\/.*)?$/, // /dashboard and /dashboard/*
]

// Routes that authenticated users should NOT visit (redirect to dashboard)
const AUTH_ROUTES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PATTERNS.some((p) => p.test(pathname))
  const isAuthRoute = AUTH_ROUTES.includes(pathname)

  // Unauthenticated user trying to access a protected route → /login
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user visiting login/register → /dashboard
  if (isAuthRoute && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  // Return the Supabase response (contains refreshed session cookies)
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets in /public
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

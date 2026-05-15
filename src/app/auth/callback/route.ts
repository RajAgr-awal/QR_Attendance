/**
 * Auth callback route — handles the OAuth redirect and email confirmation.
 * Supabase sends users here after clicking the confirmation link.
 * We exchange the code for a session, then redirect to /dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth failed — redirect to login with error message
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

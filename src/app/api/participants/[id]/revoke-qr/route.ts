/**
 * POST /api/participants/[id]/revoke-qr   — invalidates the current QR
 * POST /api/participants/[id]/regenerate-qr — issues a new QR code
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') return null
  return user
}

// POST /api/participants/[id]/revoke-qr
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('participants')
    .update({ qr_revoked_at: new Date().toISOString() } as any)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ participant: data })
}

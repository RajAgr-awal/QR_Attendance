/**
 * POST /api/participants/[id]/regenerate-qr
 * Issues a brand-new QR code, clears revocation, increments version.
 * Old printed badges become invalid immediately.
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch current version
  const { data: current } = await supabase
    .from('participants')
    .select('qr_version')
    .eq('id', id)
    .single()

  const newVersion = ((current as any)?.qr_version ?? 1) + 1
  const newQrCode = `QR-${id}-v${newVersion}`

  const { data, error } = await supabase
    .from('participants')
    .update({
      qr_code: newQrCode,
      qr_revoked_at: null,
      qr_version: newVersion,
    } as any)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ participant: data, newQrCode })
}

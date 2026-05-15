/**
 * POST /api/scan — Check-in / Check-out State Machine
 *
 * Input:  { token, event_day_id, device_info? }
 * States: absent/none → check_in → check_out → reject
 *
 * Returns: { action, participant, message, duration? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'scanner'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { token: string; event_day_id: string; device_info?: string; scannedAt?: string }
  const { token, event_day_id, device_info, scannedAt } = body
  if (!token || !event_day_id) return NextResponse.json({ error: 'Missing token or event_day_id' }, { status: 400 })

  const now = scannedAt ?? new Date().toISOString()
  const ip = request.headers.get('x-forwarded-for') ?? null
  const ua = device_info ?? request.headers.get('user-agent') ?? null

  // ── Helper: insert scan log ────────────────────────────────
  const log = async (action: string, participantId: string | null) => {
    await supabase.from('scan_logs').insert({
      participant_id: participantId ?? '00000000-0000-0000-0000-000000000000',
      event_day_id,
      scanned_by: user.id,
      raw_qr_data: token,
      scan_result: action === 'check_in' || action === 'check_out' ? 'success' : (action as any),
      scan_action: action,
      device_info: ua,
      ip_address: ip,
      user_agent: ua,
    } as any)
  }

  // ── 1. Find participant ────────────────────────────────────
  const { data: participant } = await supabase
    .from('participants')
    .select('id, name, organization, reg_id, qr_revoked_at')
    .eq('qr_code', token)
    .maybeSingle() as any

  if (!participant) {
    await log('not_found', null)
    return NextResponse.json({ action: 'not_found', message: 'QR code not recognised' })
  }
  if (participant.qr_revoked_at) {
    await log('invalid', participant.id)
    return NextResponse.json({ action: 'invalid', message: 'This QR badge has been revoked' })
  }

  // ── 2. Find attendance record ──────────────────────────────
  const { data: att } = await supabase
    .from('attendance')
    .select('id, status, check_in_time, check_out_time')
    .eq('participant_id', participant.id)
    .eq('event_day_id', event_day_id)
    .maybeSingle() as any

  const p = { name: participant.name, organization: participant.organization, reg_id: participant.reg_id }

  // ── State machine ──────────────────────────────────────────
  // State: no record OR status=absent → CHECK IN
  if (!att || att.status === 'absent') {
    if (att) {
      await supabase.from('attendance').update({ status: 'checked_in', check_in_time: now, scanned_by: user.id } as any).eq('id', att.id)
    } else {
      await supabase.from('attendance').insert({ participant_id: participant.id, event_day_id, status: 'checked_in', check_in_time: now, scanned_by: user.id } as any)
    }
    await log('check_in', participant.id)
    return NextResponse.json({ action: 'check_in', participant: p, message: `Welcome, ${participant.name}!` })
  }

  // State: checked_in, no check_out → CHECK OUT
  if (att.status === 'checked_in' && !att.check_out_time) {
    await supabase.from('attendance').update({ status: 'checked_out', check_out_time: now, scanned_by: user.id } as any).eq('id', att.id)
    await log('check_out', participant.id)
    const checkInMs = new Date(att.check_in_time).getTime()
    const checkOutMs = new Date(now).getTime()
    const mins = Math.round((checkOutMs - checkInMs) / 60000)
    const duration = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
    return NextResponse.json({ action: 'check_out', participant: p, message: `Goodbye, ${participant.name}!`, duration })
  }

  // State: checked_out → REJECT
  if (att.status === 'checked_out') {
    await log('rejected', participant.id)
    return NextResponse.json({ action: 'rejected', participant: p, message: 'Already checked out for today' })
  }

  return NextResponse.json({ action: 'rejected', message: 'Unexpected attendance state' })
}

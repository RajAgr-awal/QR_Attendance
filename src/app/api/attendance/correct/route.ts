/**
 * POST /api/attendance/correct
 * Admin manually marks check-in or check-out for a participant.
 * Logs who made the correction and when.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { participant_id, event_day_id, action } = await request.json() as {
    participant_id: string; event_day_id: string; action: 'check_in' | 'check_out' | 'reset'
  }
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('participant_id', participant_id)
    .eq('event_day_id', event_day_id)
    .maybeSingle() as any

  const update: Record<string, any> = {
    manually_corrected_by: user.id,
    manually_corrected_at: now,
    scanned_by: user.id,
  }

  if (action === 'check_in') {
    update.status = 'checked_in'; update.check_in_time = now; update.check_out_time = null
  } else if (action === 'check_out') {
    update.status = 'checked_out'; update.check_out_time = now
    if (!existing) return NextResponse.json({ error: 'Cannot check out — no check-in record' }, { status: 400 })
  } else if (action === 'reset') {
    update.status = 'absent'; update.check_in_time = null; update.check_out_time = null
  }

  if (existing) {
    await supabase.from('attendance').update(update as any).eq('id', existing.id)
  } else {
    await supabase.from('attendance').insert({ participant_id, event_day_id, ...update } as any)
  }

  await supabase.from('scan_logs').insert({
    participant_id, event_day_id, scanned_by: user.id,
    raw_qr_data: `MANUAL:${action}`,
    scan_result: 'success',
    scan_action: action === 'reset' ? 'rejected' : action,
    device_info: 'Manual correction by admin',
    ip_address: null, user_agent: 'admin-panel',
  } as any)

  return NextResponse.json({ success: true, action })
}

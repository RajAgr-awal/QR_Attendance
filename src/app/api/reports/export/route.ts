/**
 * GET /api/reports/export?event_day_id=xxx
 * Returns a CSV: reg_id, name, college, check_in, check_out, duration_mins
 */
import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const eventDayId = searchParams.get('event_day_id')
  if (!eventDayId) return NextResponse.json({ error: 'event_day_id required' }, { status: 400 })

  // Fetch event day label
  const { data: eventDay } = await supabase.from('event_days').select('label, event_date').eq('id', eventDayId).single() as any

  // Fetch attendance with participant info
  const { data: records } = await supabase
    .from('attendance')
    .select('status, check_in_time, check_out_time, participants(name, organization, reg_id, email)')
    .eq('event_day_id', eventDayId)
    .order('check_in_time', { ascending: true }) as any

  const rows = (records ?? []).map((r: any) => {
    const p = r.participants ?? {}
    const checkIn = r.check_in_time ? new Date(r.check_in_time) : null
    const checkOut = r.check_out_time ? new Date(r.check_out_time) : null
    const durationMins = checkIn && checkOut
      ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000)
      : null
    return {
      reg_id: p.reg_id ?? '',
      name: p.name ?? '',
      college: p.organization ?? '',
      email: p.email ?? '',
      status: r.status ?? 'absent',
      check_in_time: checkIn ? checkIn.toLocaleTimeString('en-IN', { hour12: false }) : '',
      check_out_time: checkOut ? checkOut.toLocaleTimeString('en-IN', { hour12: false }) : '',
      duration_minutes: durationMins ?? '',
    }
  })

  const csv = Papa.unparse(rows)

  const filename = `attendance_${(eventDay?.label ?? 'day').replace(/\s+/g, '_')}_${eventDay?.event_date ?? ''}.csv`
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

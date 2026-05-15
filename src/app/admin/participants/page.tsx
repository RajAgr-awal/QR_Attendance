/**
 * /admin/participants — server page
 * Fetches participants + today's check-in status server-side.
 * Delegates all interactivity to ParticipantsClient.
 * Also renders the ImportCSV panel in a collapsible section.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ParticipantsClient, { type ParticipantFull } from '@/components/ParticipantsClient'
import ImportCSV from '@/components/ImportCSV'

export const metadata = { title: 'Participants' }

export default async function ParticipantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') redirect('/dashboard')

  // Find today's event day (if any)
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayEvent } = await supabase
    .from('event_days')
    .select('id')
    .eq('event_date', today)
    .maybeSingle()

  // Fetch all participants
  const { data: participants } = await supabase
    .from('participants')
    .select('id, name, email, organization, reg_id, qr_code, qr_revoked_at, qr_version')
    .order('name', { ascending: true })

  // Fetch today's attendance if there is an event today
  const todayAttendance: Record<string, string> = {}
  if ((todayEvent as any)?.id) {
    const { data: att } = await supabase
      .from('attendance')
      .select('participant_id, status')
      .eq('event_day_id', (todayEvent as any).id)
    for (const a of (att ?? []) as any[]) {
      todayAttendance[a.participant_id] = a.status
    }
  }

  const rows: ParticipantFull[] = (participants ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    organization: p.organization ?? null,
    reg_id: p.reg_id ?? null,
    qr_code: p.qr_code,
    qr_revoked_at: p.qr_revoked_at ?? null,
    qr_version: p.qr_version ?? 1,
    today_status: (todayEvent as any)?.id
      ? ((todayAttendance[p.id] ?? 'absent') as ParticipantFull['today_status'])
      : null,
  }))

  const presentCount = rows.filter(r => r.today_status === 'present').length
  const revokedCount = rows.filter(r => r.qr_revoked_at).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Participants</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
              <span>{rows.length} total</span>
              {todayEvent && <span className="text-emerald-400 font-medium">{presentCount} checked in today</span>}
              {revokedCount > 0 && <span className="text-red-400">{revokedCount} revoked</span>}
            </div>
          </div>
          <a href="/admin/badges"
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all">
            🖨️ Print All Badges
          </a>
        </div>

        {/* CSV Import panel */}
        <div className="bg-white/5 border border-white/10 rounded-xl">
          <details>
            <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-slate-300
                                hover:text-white transition-colors list-none flex items-center gap-2">
              <span>📥</span>
              <span>Import participants from CSV</span>
            </summary>
            <div className="px-5 pb-5">
              <ImportCSV />
            </div>
          </details>
        </div>

        {/* Table */}
        <ParticipantsClient initial={rows} />
      </div>
    </div>
  )
}

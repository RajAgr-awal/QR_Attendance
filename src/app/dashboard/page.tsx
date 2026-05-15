/**
 * /dashboard — Protected page (see middleware.ts).
 * Shows a summary of the logged-in user's session and quick links.
 * Server Component — reads auth directly from cookies.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import RealtimeAttendance from '@/components/RealtimeAttendance'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch the app-level user profile (role etc.)
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // Fetch initial attendance stats for the realtime component
  const { data: eventDays } = await supabase
    .from('event_days')
    .select('id, label')
    .order('event_date', { ascending: true })

  const { data: attendanceCounts } = await supabase
    .from('attendance')
    .select('event_day_id, status')

  const initialStats = (eventDays ?? []).map(day => {
    const dayCounts = (attendanceCounts ?? []).filter(a => a.event_day_id === day.id)
    return {
      eventDayId: day.id,
      label: day.label,
      present: dayCounts.filter(a => a.status === 'present').length,
      absent: dayCounts.filter(a => a.status === 'absent').length,
      late: dayCounts.filter(a => a.status === 'late').length,
      total: dayCounts.length,
    }
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Welcome back, <span className="text-indigo-400">{profile?.full_name ?? user.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold border
              bg-indigo-500/10 border-indigo-500/30 text-indigo-300 capitalize">
              {profile?.role ?? 'viewer'}
            </span>
            <LogoutButton />
          </div>
        </div>

        {/* Quick action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profile?.role === 'admin' && (
            <a href="/admin" id="nav-admin"
              className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/40
                         rounded-xl p-6 transition-all duration-200 cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-1">Admin Panel</h3>
              <p className="text-slate-400 text-sm">Manage participants, event days, and view reports</p>
            </a>
          )}

          {(profile?.role === 'admin' || profile?.role === 'scanner') && (
            <a href="/scan" id="nav-scan"
              className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40
                         rounded-xl p-6 transition-all duration-200 cursor-pointer">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-1">QR Scanner</h3>
              <p className="text-slate-400 text-sm">Scan participant QR codes to mark attendance</p>
            </a>
          )}

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold mb-1">Profile</h3>
            <p className="text-slate-400 text-sm">{user.email}</p>
            <p className="text-slate-500 text-xs mt-1">UID: {user.id.slice(0, 8)}…</p>
          </div>
        </div>

        {/* Live attendance stats */}
        <div className="mt-8">
          <RealtimeAttendance initialStats={initialStats} />
        </div>

        {/* Admin quick links */}
        {profile?.role === 'admin' && (
          <div className="mt-6 flex flex-wrap gap-3">
            {[['Participants', '/admin/participants'], ['Print Badges', '/admin/badges'], ['Audit Trail', '/admin/audit']]
              .map(([label, href]) => (
                <a key={href} href={href}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10
                             text-slate-300 text-sm font-medium transition-all">
                  {label}
                </a>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

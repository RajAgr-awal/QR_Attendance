/**
 * /admin/dashboard — Live attendance dashboard (Server Component).
 * Fetches initial data server-side, delegates interactivity to DashboardClient.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/DashboardClient'
import LogoutButton from '@/components/LogoutButton'

export const metadata = { title: 'Admin Dashboard' }

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('full_name, role').eq('id', user.id).single() as any
  if (!['admin', 'scanner'].includes(profile?.role)) redirect('/dashboard')

  const [{ data: eventDays }, { count: totalParticipants }] = await Promise.all([
    supabase.from('event_days').select('id, label, event_date').order('event_date', { ascending: true }),
    supabase.from('participants').select('id', { count: 'exact', head: true }),
  ])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Nav bar */}
      <header className="border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-white font-bold text-sm">QR Attendance</span>
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            {[
              ['Dashboard', '/admin/dashboard'],
              ['Participants', '/admin/participants'],
              ['Badges', '/admin/badges'],
              ['Audit', '/admin/audit'],
              ['Scanner', '/scan'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-slate-400 hover:text-white transition-colors">{label}</a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-xs hidden sm:block">{(profile as any)?.full_name ?? user.email}</span>
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Live attendance · Updates in real-time</p>
        </div>
        <DashboardClient
          eventDays={(eventDays ?? []) as any}
          totalParticipants={totalParticipants ?? 0}
        />
      </main>
    </div>
  )
}

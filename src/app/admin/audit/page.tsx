/**
 * /admin/audit — Scan history / audit trail.
 * Server Component: fetches data, passes to client AuditLogTable for filtering.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuditLogTable, { type AuditRow } from '@/components/AuditLogTable'

export const metadata = { title: 'Audit Trail' }

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') redirect('/dashboard')

  // Fetch scan_logs with joined names
  // Supabase doesn't support arbitrary SQL joins via the client,
  // so we fetch separately and merge in JS.
  const { data: logs } = await supabase
    .from('scan_logs')
    .select(`
      id, raw_qr_data, scan_result, created_at,
      participants ( name, email ),
      event_days ( label ),
      users ( full_name )
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  const rows: AuditRow[] = (logs ?? []).map((l: any) => ({
    id: l.id,
    raw_qr_data: l.raw_qr_data,
    scan_result: l.scan_result,
    created_at: l.created_at,
    participant_name: l.participants?.name ?? null,
    participant_email: l.participants?.email ?? null,
    event_day_label: l.event_days?.label ?? null,
    scanned_by_name: l.users?.full_name ?? null,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
          <p className="text-slate-400 text-sm mt-1">
            Every scan attempt — valid or not — logged immutably. Showing last 500.
          </p>
        </div>
        <AuditLogTable logs={rows} />
      </div>
    </div>
  )
}

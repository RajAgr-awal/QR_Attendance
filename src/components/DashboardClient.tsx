'use client'
/**
 * DashboardClient — full admin dashboard with:
 * - Day selector
 * - Live stats via Supabase Realtime
 * - Searchable/filterable participant table
 * - Manual attendance correction modal
 * - CSV export
 * - Scan history tab
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface EventDay { id: string; label: string; event_date: string }
interface AttendanceRow {
  id: string; participant_id: string; status: string
  check_in_time: string | null; check_out_time: string | null
  name: string; organization: string | null; reg_id: string | null; email: string
}
interface ScanLog {
  id: string; raw_qr_data: string; scan_action: string | null; scan_result: string
  created_at: string; device_info: string | null
  participant_name: string | null; event_day_label: string | null; scanned_by_name: string | null
}

interface Stats { total: number; checkedIn: number; checkedOut: number; inVenue: number }

function calcStats(rows: AttendanceRow[], total: number): Stats {
  const checkedIn = rows.filter(r => r.status === 'checked_in' || r.status === 'checked_out').length
  const checkedOut = rows.filter(r => r.status === 'checked_out').length
  return { total, checkedIn, checkedOut, inVenue: checkedIn - checkedOut }
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_PILL: Record<string, string> = {
  checked_in:  'bg-emerald-500/20 text-emerald-300',
  checked_out: 'bg-blue-500/20 text-blue-300',
  absent:      'bg-slate-500/20 text-slate-400',
  present:     'bg-emerald-500/20 text-emerald-300',
  late:        'bg-amber-500/20 text-amber-300',
}

// ── Manual correction modal ───────────────────────────────────
function CorrectionModal({ row, eventDayId, onClose, onDone }:
  { row: AttendanceRow; eventDayId: string; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState<string | null>(null)
  async function correct(action: 'check_in' | 'check_out' | 'reset') {
    setLoading(action)
    await fetch('/api/attendance/correct', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_id: row.participant_id, event_day_id: eventDayId, action }) })
    setLoading(null); onDone(); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-1">Manual Correction</h3>
        <p className="text-slate-400 text-sm mb-5">{row.name} · {row.reg_id ?? '—'}</p>
        <div className="space-y-2">
          {[
            { action: 'check_in'  as const, label: '✅ Mark Check-In',  cls: 'bg-emerald-600 hover:bg-emerald-500' },
            { action: 'check_out' as const, label: '👋 Mark Check-Out', cls: 'bg-blue-600 hover:bg-blue-500' },
            { action: 'reset'     as const, label: '↺ Reset to Absent',  cls: 'bg-slate-600 hover:bg-slate-500' },
          ].map(({ action, label, cls }) => (
            <button key={action} onClick={() => correct(action)} disabled={!!loading}
              className={`w-full py-2.5 rounded-lg text-white font-semibold text-sm ${cls} transition-all disabled:opacity-50`}>
              {loading === action ? '…' : label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-3 w-full py-2 text-slate-500 text-sm hover:text-slate-300">Cancel</button>
      </div>
    </div>
  )
}

// ── Main Dashboard Client ─────────────────────────────────────
export default function DashboardClient({ eventDays, totalParticipants }: { eventDays: EventDay[]; totalParticipants: number }) {
  const [dayId, setDayId] = useState(eventDays[0]?.id ?? '')
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([])
  const [tab, setTab] = useState<'attendance' | 'logs'>('attendance')
  const [search, setSearch] = useState('')
  const [filterCollege, setFilterCollege] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [correcting, setCorrecting] = useState<AttendanceRow | null>(null)
  const [loadingData, setLoadingData] = useState(false)

  const fetchData = useCallback(async () => {
    if (!dayId) return
    setLoadingData(true)
    const supabase = createClient()
    const { data: att } = await supabase
      .from('attendance')
      .select('id, participant_id, status, check_in_time, check_out_time, participants(name, organization, reg_id, email)')
      .eq('event_day_id', dayId) as any
    setAttendance((att ?? []).map((a: any) => ({
      id: a.id, participant_id: a.participant_id, status: a.status,
      check_in_time: a.check_in_time, check_out_time: a.check_out_time,
      name: a.participants?.name ?? '', organization: a.participants?.organization ?? null,
      reg_id: a.participants?.reg_id ?? null, email: a.participants?.email ?? '',
    })))

    const { data: logs } = await supabase
      .from('scan_logs')
      .select('id, raw_qr_data, scan_action, scan_result, created_at, device_info, participants(name), event_days(label), users(full_name)')
      .eq('event_day_id', dayId).order('created_at', { ascending: false }).limit(200) as any
    setScanLogs((logs ?? []).map((l: any) => ({
      id: l.id, raw_qr_data: l.raw_qr_data, scan_action: l.scan_action, scan_result: l.scan_result,
      created_at: l.created_at, device_info: l.device_info,
      participant_name: l.participants?.name ?? null,
      event_day_label: l.event_days?.label ?? null,
      scanned_by_name: l.users?.full_name ?? null,
    })))
    setLoadingData(false)
  }, [dayId])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime subscription
  useEffect(() => {
    if (!dayId) return
    const supabase = createClient()
    const channel = supabase.channel(`dashboard-${dayId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_logs' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dayId, fetchData])

  const stats = useMemo(() => calcStats(attendance, totalParticipants), [attendance, totalParticipants])

  const colleges = useMemo(() => [...new Set(attendance.map(a => a.organization).filter(Boolean))].sort() as string[], [attendance])

  const filtered = useMemo(() => attendance.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.name.toLowerCase().includes(q) || (r.reg_id ?? '').toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    const matchC = !filterCollege || r.organization === filterCollege
    const matchS = !filterStatus || r.status === filterStatus
    return matchQ && matchC && matchS
  }), [attendance, search, filterCollege, filterStatus])

  async function exportCSV() {
    window.open(`/api/reports/export?event_day_id=${dayId}`, '_blank')
  }

  const STAT_CARDS = [
    { label: 'Registered', value: stats.total, color: 'text-slate-300', bg: 'bg-slate-500/20' },
    { label: 'Checked In', value: stats.checkedIn, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { label: 'In Venue',   value: stats.inVenue,   color: 'text-blue-400',   bg: 'bg-blue-500/20' },
    { label: 'Checked Out',value: stats.checkedOut, color: 'text-violet-400', bg: 'bg-violet-500/20' },
  ]

  return (
    <div className="space-y-6">
      {correcting && (
        <CorrectionModal row={correcting} eventDayId={dayId}
          onClose={() => setCorrecting(null)} onDone={fetchData} />
      )}

      {/* Day selector + export */}
      <div className="flex flex-wrap gap-3 items-center">
        <select id="day-selector" value={dayId} onChange={e => setDayId(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {eventDays.map(d => <option key={d.id} value={d.id}>{d.label} ({d.event_date})</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-500 text-xs">Live</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={fetchData} className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-sm hover:bg-white/10 transition-all">↻ Refresh</button>
          <button id="export-csv-btn" onClick={exportCSV}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all">
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border border-white/10 rounded-xl p-5 text-center`}>
            <div className={`text-3xl font-black tabular-nums ${color}`}>{value}</div>
            <div className="text-slate-400 text-xs mt-1 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {(['attendance', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize
              ${tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'attendance' ? '👥 Participants' : '📋 Scan Logs'}
          </button>
        ))}
      </div>

      {/* ── Attendance Tab ── */}
      {tab === 'attendance' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input id="dashboard-search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, reg ID, email…"
              className="flex-1 min-w-48 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All colleges</option>
              {colleges.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All statuses</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="absent">Not Yet</option>
            </select>
            <span className="text-slate-500 text-sm self-center">{filtered.length} shown</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead><tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider text-left">
                {['Participant', 'College', 'Reg ID', 'Status', 'Check-In', 'Check-Out', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {loadingData ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No participants found</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white text-sm">{r.name}</div>
                      <div className="text-slate-500 text-xs">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-32 truncate">{r.organization ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-indigo-300 text-xs">{r.reg_id ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_PILL[r.status] ?? STATUS_PILL.absent}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{fmtTime(r.check_in_time)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">{fmtTime(r.check_out_time)}</td>
                    <td className="px-4 py-3">
                      <button id={`correct-${r.participant_id}`} onClick={() => setCorrecting(r)}
                        className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all">
                        ✏️ Correct
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Scan Logs Tab ── */}
      {tab === 'logs' && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead><tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider text-left">
              {['Time', 'Participant', 'Action', 'QR Data', 'Device'].map(h => (
                <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {scanLogs.map(l => (
                <tr key={l.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-2 text-slate-500 text-xs font-mono whitespace-nowrap">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-2 text-white text-sm">{l.participant_name ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      l.scan_action === 'check_in' ? 'bg-emerald-500/20 text-emerald-300' :
                      l.scan_action === 'check_out' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-red-500/20 text-red-300'}`}>
                      {l.scan_action ?? l.scan_result}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-500 text-xs max-w-28 truncate">{l.raw_qr_data}</td>
                  <td className="px-4 py-2 text-slate-600 text-xs max-w-32 truncate" title={l.device_info ?? ''}>
                    {l.device_info?.slice(0, 30) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

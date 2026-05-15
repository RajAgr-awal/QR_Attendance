'use client'
/**
 * AuditLogTable — client-side filterable table of scan_logs.
 * Receives raw logs from the server page; handles filter state locally.
 */
import { useState, useMemo } from 'react'

export interface AuditRow {
  id: string
  raw_qr_data: string
  scan_result: string
  created_at: string
  participant_name: string | null
  participant_email: string | null
  event_day_label: string | null
  scanned_by_name: string | null
}

const RESULT_BADGE: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-300',
  already_scanned: 'bg-amber-500/20 text-amber-300',
  not_found: 'bg-red-500/20 text-red-300',
  invalid: 'bg-red-500/20 text-red-300',
}

export default function AuditLogTable({ logs }: { logs: AuditRow[] }) {
  const [search, setSearch] = useState('')
  const [filterResult, setFilterResult] = useState('')
  const [filterDay, setFilterDay] = useState('')

  const days = useMemo(() => [...new Set(logs.map(l => l.event_day_label).filter(Boolean))], [logs])

  const filtered = useMemo(() => logs.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || [l.participant_name, l.participant_email, l.raw_qr_data, l.scanned_by_name]
      .some(v => v?.toLowerCase().includes(q))
    const matchResult = !filterResult || l.scan_result === filterResult
    const matchDay = !filterDay || l.event_day_label === filterDay
    return matchSearch && matchResult && matchDay
  }), [logs, search, filterResult, filterDay])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          id="audit-search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, QR…"
          className="flex-1 min-w-48 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <select id="audit-filter-result" value={filterResult} onChange={e => setFilterResult(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All results</option>
          <option value="success">✅ Success</option>
          <option value="already_scanned">⚠️ Already scanned</option>
          <option value="not_found">❌ Not found</option>
          <option value="invalid">🚫 Invalid (revoked)</option>
        </select>
        <select id="audit-filter-day" value={filterDay} onChange={e => setFilterDay(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All days</option>
          {days.map(d => <option key={d} value={d!}>{d}</option>)}
        </select>
        <span className="flex items-center text-slate-500 text-sm px-2">{filtered.length} rows</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-slate-400 text-left">
              {['Time', 'Participant', 'Event Day', 'QR Data', 'Result', 'Scanned By'].map(h => (
                <th key={h} className="px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No logs match filters</td></tr>
            ) : filtered.map(row => (
              <tr key={row.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs font-mono">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{row.participant_name ?? '—'}</div>
                  <div className="text-slate-500 text-xs">{row.participant_email}</div>
                </td>
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap text-xs">{row.event_day_label ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-slate-400 text-xs max-w-32 truncate">{row.raw_qr_data}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${RESULT_BADGE[row.scan_result] ?? 'bg-slate-500/20 text-slate-300'}`}>
                    {row.scan_result.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{row.scanned_by_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

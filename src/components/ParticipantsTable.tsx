'use client'
/**
 * ParticipantsTable — admin view with inline QR revoke/regenerate controls.
 */
import { useState } from 'react'
import QRCode from 'react-qr-code'

export interface ParticipantRow {
  id: string
  name: string
  email: string
  organization: string | null
  qr_code: string
  qr_revoked_at: string | null
  qr_version: number
}

export default function ParticipantsTable({ initial }: { initial: ParticipantRow[] }) {
  const [rows, setRows] = useState<ParticipantRow[]>(initial)
  const [loading, setLoading] = useState<string | null>(null)

  async function revokeQR(id: string) {
    setLoading(id + '-revoke')
    const res = await fetch(`/api/participants/${id}/revoke-qr`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setRows(prev => prev.map(r => r.id === id ? { ...r, ...(data.participant as any) } : r))
    setLoading(null)
  }

  async function regenerateQR(id: string) {
    setLoading(id + '-regen')
    const res = await fetch(`/api/participants/${id}/regenerate-qr`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) setRows(prev => prev.map(r => r.id === id ? { ...r, ...(data.participant as any) } : r))
    setLoading(null)
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/5 text-slate-400 text-left">
            {['Participant', 'QR Code', 'Status', 'Actions'].map(h => (
              <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map(p => {
            const isRevoked = !!p.qr_revoked_at
            const busy = loading?.startsWith(p.id)
            return (
              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{p.name}</div>
                  <div className="text-slate-500 text-xs">{p.email}</div>
                  {p.organization && <div className="text-slate-600 text-xs">{p.organization}</div>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isRevoked ? (
                      <div className="w-10 h-10 flex items-center justify-center bg-red-900/30 rounded border border-red-500/30">
                        <span className="text-red-400 text-[9px] font-bold text-center">VOID</span>
                      </div>
                    ) : (
                      <QRCode value={p.qr_code} size={40} level="L" />
                    )}
                    <span className="font-mono text-xs text-slate-400 max-w-24 truncate">{p.qr_code}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {isRevoked ? (
                    <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-300 font-semibold">Revoked</span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 font-semibold">Active v{p.qr_version}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {!isRevoked ? (
                      <button
                        id={`revoke-${p.id}`}
                        onClick={() => revokeQR(p.id)}
                        disabled={!!busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all disabled:opacity-40">
                        {loading === p.id + '-revoke' ? '…' : 'Revoke'}
                      </button>
                    ) : (
                      <button
                        id={`regen-${p.id}`}
                        onClick={() => regenerateQR(p.id)}
                        disabled={!!busy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all disabled:opacity-40">
                        {loading === p.id + '-regen' ? '…' : 'New QR'}
                      </button>
                    )}
                    <a href="/admin/badges"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all">
                      Badge
                    </a>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

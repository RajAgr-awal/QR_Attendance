'use client'
/**
 * ParticipantsClient — full admin participants table with:
 * - Search by name or reg_id
 * - Today's check-in status pill
 * - Individual PNG badge download (canvas)
 * - Revoke / Regenerate QR
 * - Bulk ZIP download (via BulkQRDownload)
 */
import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import QRCode from 'qrcode'

const BulkQRDownload = dynamic(() => import('./BulkQRDownload'), { ssr: false })

export interface ParticipantFull {
  id: string
  name: string
  email: string
  organization: string | null
  reg_id: string | null
  qr_code: string
  qr_revoked_at: string | null
  qr_version: number
  today_status: 'present' | 'absent' | 'late' | null // null = no event today
}

const STATUS_BADGE: Record<string, string> = {
  present: 'bg-emerald-500/20 text-emerald-300',
  absent:  'bg-slate-500/20 text-slate-400',
  late:    'bg-amber-500/20 text-amber-300',
}

// ── Individual badge PNG download ──────────────────────────────
async function downloadBadge(p: ParticipantFull) {
  const W = 400, H = 220
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // BG
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  // Header
  const g = ctx.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, '#4f46e5'); g.addColorStop(1, '#7c3aed')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 28)
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'
  ctx.fillText('TechConf 2026', 12, 19)
  // Left bar
  ctx.fillStyle = '#4f46e5'; ctx.fillRect(0, 28, 4, H - 28)

  // QR
  if (!p.qr_revoked_at) {
    const dataUrl = await QRCode.toDataURL(p.qr_code, { width: 160, margin: 1 })
    await new Promise<void>(res => {
      const img = new Image()
      img.onload = () => { ctx.drawImage(img, 12, 36, 160, 160); res() }
      img.src = dataUrl
    })
  } else {
    ctx.fillStyle = '#fee2e2'; ctx.fillRect(12, 36, 160, 160)
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'; ctx.fillText('REVOKED', 92, 122); ctx.textAlign = 'left'
  }

  // Text
  const tx = 184
  ctx.fillStyle = '#1e1b4b'; ctx.font = 'bold 15px sans-serif'
  ctx.fillText(p.name.slice(0, 22), tx, 60)
  if (p.organization) {
    ctx.fillStyle = '#4338ca'; ctx.font = '12px sans-serif'
    ctx.fillText(p.organization.slice(0, 28), tx, 80)
  }
  ctx.fillStyle = '#374151'; ctx.font = 'bold 12px monospace'
  ctx.fillText(p.reg_id ?? '—', tx, 160)
  ctx.fillStyle = '#9ca3af'; ctx.font = '9px monospace'
  ctx.fillText(p.qr_code.slice(0, 30) + '…', tx, 178)
  ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)

  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `badge_${(p.reg_id ?? p.name).replace(/\W/g, '_')}.png`
    a.click(); URL.revokeObjectURL(url)
  }, 'image/png')
}

export default function ParticipantsClient({ initial }: { initial: ParticipantFull[] }) {
  const [rows, setRows] = useState<ParticipantFull[]>(initial)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? rows : rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.reg_id ?? '').toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q)
    )
  }, [rows, search])

  async function revokeQR(id: string) {
    setLoading(id + '-r')
    const res = await fetch(`/api/participants/${id}/revoke-qr`, { method: 'POST' })
    if (res.ok) {
      const { participant } = await res.json()
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...participant } : r))
    }
    setLoading(null)
  }

  async function regenQR(id: string) {
    setLoading(id + '-g')
    const res = await fetch(`/api/participants/${id}/regenerate-qr`, { method: 'POST' })
    if (res.ok) {
      const { participant } = await res.json()
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...participant } : r))
    }
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      {/* Search + bulk download */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          id="participant-search"
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or reg ID…"
          className="flex-1 min-w-48 px-3 py-2 rounded-lg bg-white/5 border border-white/10
                     text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <span className="text-slate-500 text-sm">{filtered.length} of {rows.length}</span>
        <BulkQRDownload participants={rows} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-slate-400 text-left text-xs uppercase tracking-wider">
              {['Participant', 'College', 'Reg ID', "Today's Status", 'QR', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No participants match</td></tr>
            ) : filtered.map(p => {
              const isRevoked = !!p.qr_revoked_at
              const busy = loading?.startsWith(p.id)
              return (
                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{p.name}</div>
                    <div className="text-slate-500 text-xs">{p.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs max-w-36 truncate">
                    {p.organization ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-indigo-300 text-xs">
                    {p.reg_id ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.today_status ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[p.today_status]}`}>
                        {p.today_status}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs italic">no event</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isRevoked ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-300">Revoked</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300">
                        v{p.qr_version}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        id={`dl-badge-${p.id}`}
                        onClick={() => downloadBadge(p)}
                        title="Download badge PNG"
                        className="px-2 py-1 rounded text-xs bg-indigo-500/10 hover:bg-indigo-500/20
                                   text-indigo-400 border border-indigo-500/20 transition-all">
                        ⬇ PNG
                      </button>
                      {!isRevoked ? (
                        <button
                          id={`revoke-${p.id}`}
                          onClick={() => revokeQR(p.id)}
                          disabled={!!busy}
                          className="px-2 py-1 rounded text-xs bg-red-500/10 hover:bg-red-500/20
                                     text-red-400 border border-red-500/20 transition-all disabled:opacity-40">
                          {loading === p.id + '-r' ? '…' : 'Revoke'}
                        </button>
                      ) : (
                        <button
                          id={`regen-${p.id}`}
                          onClick={() => regenQR(p.id)}
                          disabled={!!busy}
                          className="px-2 py-1 rounded text-xs bg-slate-500/10 hover:bg-slate-500/20
                                     text-slate-300 border border-white/10 transition-all disabled:opacity-40">
                          {loading === p.id + '-g' ? '…' : 'New QR'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

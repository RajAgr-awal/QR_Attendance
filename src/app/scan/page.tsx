'use client'
/**
 * /scan — QR Scanner with check-in/check-out state machine.
 *
 * Features:
 * - Camera scanner via QRScannerCamera (jsqr + getUserMedia)
 * - 3-second debounce per token (client-side)
 * - Full-screen visual feedback: green (check-in) / blue (check-out) / red (error)
 * - Offline queue: IndexedDB via offline-queue.ts, auto-sync on reconnect
 * - Manual QR entry fallback
 * - Recent scan history list
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { enqueueScan, getPendingScans, markSynced, markFailed, clearSynced } from '@/lib/offline-queue'

const QRScannerCamera = dynamic(() => import('@/components/QRScannerCamera'), { ssr: false })

// ── Types ────────────────────────────────────────────────────
type ScanAction = 'check_in' | 'check_out' | 'rejected' | 'not_found' | 'invalid' | 'queued' | 'error'

interface ScanResult {
  id: string
  action: ScanAction
  message: string
  name?: string
  duration?: string
  token: string
  time: string
}

interface FeedbackState {
  visible: boolean
  action: ScanAction
  message: string
  name?: string
  duration?: string
}

// ── Config ───────────────────────────────────────────────────
const FEEDBACK_DURATION_MS = 2500
const DEBOUNCE_MS = 3000

const FEEDBACK_STYLES: Record<ScanAction, { bg: string; icon: string; title: string }> = {
  check_in:  { bg: 'bg-emerald-500', icon: '✅', title: 'CHECKED IN' },
  check_out: { bg: 'bg-blue-500',    icon: '👋', title: 'CHECKED OUT' },
  rejected:  { bg: 'bg-amber-500',   icon: '⚠️', title: 'REJECTED' },
  not_found: { bg: 'bg-red-600',     icon: '❓', title: 'UNKNOWN QR' },
  invalid:   { bg: 'bg-red-700',     icon: '🚫', title: 'QR REVOKED' },
  queued:    { bg: 'bg-indigo-500',  icon: '📶', title: 'QUEUED OFFLINE' },
  error:     { bg: 'bg-red-600',     icon: '❌', title: 'ERROR' },
}

const HISTORY_COLORS: Record<ScanAction, string> = {
  check_in:  'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  check_out: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  rejected:  'border-amber-500/40 bg-amber-500/10 text-amber-300',
  not_found: 'border-red-500/40 bg-red-500/10 text-red-300',
  invalid:   'border-red-600/40 bg-red-600/10 text-red-400',
  queued:    'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  error:     'border-red-500/40 bg-red-500/10 text-red-300',
}

// ── Full-screen Feedback Overlay ─────────────────────────────
function ScanFeedback({ state, onDismiss }: { state: FeedbackState; onDismiss: () => void }) {
  if (!state.visible) return null
  const style = FEEDBACK_STYLES[state.action]
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${style.bg}
                  animate-pulse-once cursor-pointer select-none`}
      onClick={onDismiss}
    >
      <div className="text-8xl mb-6 animate-bounce-once">{style.icon}</div>
      <div className="text-white font-black text-4xl tracking-widest mb-3">{style.title}</div>
      {state.name && <div className="text-white/90 text-2xl font-semibold mb-2">{state.name}</div>}
      {state.duration && <div className="text-white/70 text-lg">Duration: {state.duration}</div>}
      {state.message && !state.name && <div className="text-white/80 text-xl">{state.message}</div>}
      <div className="mt-8 text-white/50 text-sm">Tap to dismiss</div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function ScanPage() {
  const [eventDayId, setEventDayId] = useState('')
  const [eventDays, setEventDays] = useState<{ id: string; label: string }[]>([])
  const [history, setHistory] = useState<ScanResult[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>({ visible: false, action: 'error', message: '' })
  const debounceRef = useRef<Map<string, number>>(new Map())
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/event-days').then(r => r.json()).then(d => setEventDays(d.eventDays ?? []))
    refreshPending()
  }, [])

  async function refreshPending() {
    const p = await getPendingScans(); setPendingCount(p.length)
  }

  // ── Show full-screen feedback ─────────────────────────────
  function showFeedback(action: ScanAction, data: Partial<FeedbackState>) {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setFeedback({ visible: true, action, message: data.message ?? '', name: data.name, duration: data.duration })
    feedbackTimer.current = setTimeout(() => setFeedback(f => ({ ...f, visible: false })), FEEDBACK_DURATION_MS)
  }

  function pushHistory(action: ScanAction, message: string, name?: string, token = '') {
    setHistory(prev => [{
      id: crypto.randomUUID(),
      action, message, name, token,
      time: new Date().toLocaleTimeString(),
    }, ...prev.slice(0, 14)])
  }

  // ── Sync offline queue ────────────────────────────────────
  const syncQueue = useCallback(async () => {
    if (syncing || !eventDayId) return
    setSyncing(true)
    const pending = await getPendingScans()
    for (const scan of pending) {
      try {
        const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: scan.qrData, event_day_id: scan.eventDayId, scannedAt: scan.scannedAt, device_info: navigator.userAgent }) })
        if (res.ok) await markSynced(scan.id!)
        else await markFailed(scan.id!, 'API error')
      } catch { await markFailed(scan.id!, 'Network error') }
    }
    await clearSynced(); await refreshPending(); setSyncing(false)
  }, [syncing, eventDayId])

  const isOnline = useOnlineStatus(syncQueue)

  // ── Core scan handler ─────────────────────────────────────
  const handleScan = useCallback(async (token: string) => {
    if (!eventDayId) return

    // Client-side debounce
    const lastSeen = debounceRef.current.get(token) ?? 0
    if (Date.now() - lastSeen < DEBOUNCE_MS) return
    debounceRef.current.set(token, Date.now())

    if (!isOnline) {
      await enqueueScan({ qrData: token, eventDayId, scannedAt: new Date().toISOString() })
      await refreshPending()
      showFeedback('queued', { message: 'Saved offline — will sync when reconnected' })
      pushHistory('queued', 'Saved offline', undefined, token)
      return
    }

    try {
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, event_day_id: eventDayId, device_info: navigator.userAgent }) })
      const data = await res.json()
      const action = (data.action ?? 'error') as ScanAction
      showFeedback(action, { message: data.message, name: data.participant?.name, duration: data.duration })
      pushHistory(action, data.message, data.participant?.name, token)
    } catch {
      showFeedback('error', { message: 'Network error — check connection' })
      pushHistory('error', 'Network error', undefined, token)
    }
  }, [eventDayId, isOnline])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      {/* Full-screen feedback overlay */}
      <ScanFeedback state={feedback} onDismiss={() => setFeedback(f => ({ ...f, visible: false }))} />

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-xl font-bold text-white">QR Scanner</h1>
            <p className="text-slate-500 text-xs">Check-in → Check-out</p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button onClick={syncQueue} disabled={syncing || !isOnline}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/80 text-white disabled:opacity-50">
                {syncing ? '⟳' : `📶 ${pendingCount} queued`}
              </button>
            )}
            <span className={`text-xs px-2 py-1 rounded-full ${isOnline ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {isOnline ? '● Online' : '○ Offline'}
            </span>
          </div>
        </div>

        {/* Day selector */}
        <select id="event-day-select" value={eventDayId} onChange={e => setEventDayId(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm">
          <option value="">— Select event day —</option>
          {eventDays.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>

        {/* Camera */}
        {eventDayId ? (
          <div className="rounded-xl overflow-hidden border border-white/10">
            <QRScannerCamera onScan={handleScan} active />
            <div className="px-4 py-2 bg-black/40 text-slate-400 text-xs text-center">
              Point at participant badge QR code
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/20 p-16 text-center text-slate-500 text-sm">
            Select an event day to enable camera
          </div>
        )}

        {/* Manual entry */}
        <div className="flex gap-2">
          <input id="manual-qr-input" value={manualInput} onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && manualInput.trim()) { handleScan(manualInput.trim()); setManualInput('') }}}
            placeholder="Manual QR code entry…"
            className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button id="manual-scan-btn" disabled={!eventDayId}
            onClick={() => { if (manualInput.trim()) { handleScan(manualInput.trim()); setManualInput('') }}}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 transition-all">
            Scan
          </button>
        </div>

        {/* Scan history */}
        {history.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Recent</p>
            {history.map(r => (
              <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm ${HISTORY_COLORS[r.action]}`}>
                <span>{FEEDBACK_STYLES[r.action].icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{r.name ?? r.message}</span>
                  {r.name && <span className="text-xs opacity-60 ml-2">{r.message}</span>}
                </div>
                <span className="text-xs opacity-50 shrink-0">{r.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

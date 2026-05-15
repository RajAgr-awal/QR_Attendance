'use client'
/**
 * ImportCSV — drag-and-drop or file-picker CSV uploader.
 * Calls POST /api/participants/import and shows the result summary.
 */
import { useState, useRef } from 'react'

interface ImportResult {
  imported: number
  skipped: number
  failed: number
  total: number
  errors: { row: number; email: string; reason: string }[]
}

interface Props {
  onImported?: () => void
}

export default function ImportCSV({ onImported }: Props) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (!file.name.endsWith('.csv')) { setError('Please select a .csv file'); return }
    setLoading(true); setResult(null); setError(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/participants/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Import failed'); return }
      setResult(data)
      onImported?.()
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${dragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/20 hover:border-indigo-400/50 hover:bg-white/5'}`}
      >
        <input id="csv-file-input" ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <span className="w-8 h-8 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Importing…</span>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">📂</div>
            <p className="text-slate-300 text-sm font-medium">Drop CSV here or click to browse</p>
            <p className="text-slate-500 text-xs mt-1">Columns: name*, email*, phone, college, reg_id</p>
            <a href="/sample-import.csv" download onClick={e => e.stopPropagation()}
              className="inline-block mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline">
              Download sample CSV (50 rows)
            </a>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Result summary */}
      {result && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
          <h3 className="text-white font-semibold text-sm">Import complete — {result.total} rows processed</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Imported', value: result.imported, color: 'text-emerald-400' },
              { label: 'Skipped (dup)', value: result.skipped, color: 'text-amber-400' },
              { label: 'Failed', value: result.failed, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
                <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-slate-500 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <details className="cursor-pointer">
              <summary className="text-slate-400 text-xs font-medium">
                {result.errors.length} error{result.errors.length > 1 ? 's' : ''} (click to expand)
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-xs bg-red-500/10 rounded px-3 py-2 text-red-300">
                    Row {e.row > 0 ? e.row : '?'} · {e.email || 'no email'} — {e.reason}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

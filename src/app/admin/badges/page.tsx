/**
 * /admin/badges — Printable QR badge sheet.
 * Fetches all participants server-side, renders a grid of badges.
 * Hitting Ctrl+P / ⌘+P prints A4 pages with 6 badges per page.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import QRBadge from '@/components/QRBadge'

export const metadata = { title: 'Print Badges' }

export default async function BadgesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') redirect('/dashboard')

  const { data: participants } = await supabase
    .from('participants')
    .select('id, name, organization, email, qr_code, qr_revoked_at')
    .order('name', { ascending: true })

  return (
    <>
      {/* Print-only global styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .badge-grid {
            display: grid;
            grid-template-columns: repeat(2, 85mm);
            gap: 8mm;
            padding: 10mm;
          }
          .badge-card { page-break-inside: avoid; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* Screen UI */}
      <div className="no-print min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Print Badges</h1>
              <p className="text-slate-400 text-sm mt-1">
                {participants?.length ?? 0} participants · A4 · 2 badges per row
              </p>
            </div>
            <button
              id="print-badges-btn"
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all"
            >
              🖨️ Print All
            </button>
          </div>

          {/* Preview grid */}
          <div className="bg-white rounded-xl p-8 shadow-2xl">
            <div className="badge-grid grid grid-cols-2 gap-4">
              {((participants ?? []) as any[]).map(p => (
                <QRBadge
                  key={p.id}
                  name={p.name}
                  organization={p.organization}
                  email={p.email}
                  qrCode={p.qr_code}
                  isRevoked={!!(p as any).qr_revoked_at}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Print-only: no headers, just badges */}
      <div className="hidden print:block">
        <div className="badge-grid">
          {((participants ?? []) as any[]).map(p => (
            <QRBadge
              key={p.id}
              name={p.name}
              organization={p.organization}
              email={p.email}
              qrCode={p.qr_code}
              isRevoked={!!(p as any).qr_revoked_at}
            />
          ))}
        </div>
      </div>
    </>
  )
}

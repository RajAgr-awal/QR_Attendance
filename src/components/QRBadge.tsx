/**
 * QRBadge — renders a single printable attendee badge.
 * Used on the /admin/badges print page.
 */
import QRCode from 'react-qr-code'

interface Props {
  name: string
  organization: string | null
  email: string
  qrCode: string
  eventName?: string
  isRevoked?: boolean
}

export default function QRBadge({
  name, organization, email, qrCode, eventName = 'TechConf 2026', isRevoked = false,
}: Props) {
  return (
    <div className="badge-card w-[85mm] h-[55mm] bg-white border border-slate-200 rounded-lg p-3
                    flex items-center gap-3 relative overflow-hidden print:rounded-none print:border-slate-300">
      {/* Left: QR */}
      <div className="flex-shrink-0">
        {isRevoked ? (
          <div className="w-20 h-20 flex items-center justify-center bg-red-50 rounded border border-red-200">
            <span className="text-xs text-red-500 font-bold text-center leading-tight">REVOKED</span>
          </div>
        ) : (
          <QRCode value={qrCode} size={80} level="M" />
        )}
      </div>

      {/* Right: Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-indigo-600 mb-0.5 truncate">
          {eventName}
        </p>
        <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">{name}</h3>
        {organization && (
          <p className="text-[10px] text-slate-600 mt-0.5 truncate">{organization}</p>
        )}
        <p className="text-[9px] text-slate-400 mt-1 truncate">{email}</p>
        <p className="text-[8px] text-slate-300 mt-1 font-mono truncate">{qrCode}</p>
      </div>

      {/* Decorative stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-600" />
    </div>
  )
}

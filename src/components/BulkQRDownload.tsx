'use client'
/**
 * BulkQRDownload — generates a PNG badge for every participant and
 * bundles them into a ZIP using JSZip. All work is done client-side.
 *
 * Badge layout (400×220px):
 *   - White background
 *   - QR code (160×160) on left
 *   - Name, college, reg_id on right
 *   - Indigo header stripe at top
 */
import { useState } from 'react'
import QRCode from 'qrcode'
import JSZip from 'jszip'

export interface ParticipantForBadge {
  id: string
  name: string
  organization: string | null
  reg_id: string | null
  qr_code: string
  qr_revoked_at: string | null
}

const W = 400, H = 220
const HEADER_H = 28
const EVENT = 'TechConf 2026'

async function drawBadge(p: ParticipantForBadge): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Header stripe
  const grad = ctx.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, '#4f46e5')
  grad.addColorStop(1, '#7c3aed')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, HEADER_H)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillText(EVENT, 12, 19)

  // Left accent bar
  ctx.fillStyle = '#4f46e5'
  ctx.fillRect(0, HEADER_H, 4, H - HEADER_H)

  if (p.qr_revoked_at) {
    // Revoked watermark
    ctx.fillStyle = '#fee2e2'
    ctx.fillRect(12, HEADER_H + 8, 160, 160)
    ctx.fillStyle = '#ef4444'
    ctx.font = 'bold 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('REVOKED', 92, HEADER_H + 95)
    ctx.textAlign = 'left'
  } else {
    // QR code
    const qrDataUrl = await QRCode.toDataURL(p.qr_code, { width: 160, margin: 1, errorCorrectionLevel: 'M' })
    const img = await loadImage(qrDataUrl)
    ctx.drawImage(img, 12, HEADER_H + 8, 160, 160)
  }

  // Right panel text
  const textX = 184
  let textY = HEADER_H + 32

  ctx.fillStyle = '#1e1b4b'
  ctx.font = 'bold 15px sans-serif'
  wrapText(ctx, p.name, textX, textY, W - textX - 12, 20)
  textY += 30

  if (p.organization) {
    ctx.fillStyle = '#4338ca'
    ctx.font = '12px sans-serif'
    wrapText(ctx, p.organization, textX, textY, W - textX - 12, 16)
    textY += 22
  }

  textY = H - 36
  ctx.fillStyle = '#6b7280'
  ctx.font = '11px monospace'
  ctx.fillText(p.reg_id ?? '', textX, textY)
  textY += 16
  ctx.font = '9px monospace'
  ctx.fillStyle = '#9ca3af'
  ctx.fillText(p.qr_code.slice(0, 32) + '…', textX, textY)

  // Border
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lineH
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, y)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

interface Props {
  participants: ParticipantForBadge[]
}

export default function BulkQRDownload({ participants }: Props) {
  const [progress, setProgress] = useState(0)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    setProgress(0)
    const zip = new JSZip()
    const folder = zip.folder('badges')!

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i]
      const blob = await drawBadge(p)
      const safeName = p.name.replace(/[^a-z0-9]/gi, '_')
      folder.file(`${p.reg_id ?? safeName}_${safeName}.png`, blob)
      setProgress(Math.round(((i + 1) / participants.length) * 100))
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `badges-${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    URL.revokeObjectURL(url)
    setDownloading(false)
    setProgress(0)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        id="bulk-download-btn"
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500
                   disabled:opacity-60 text-white text-sm font-semibold transition-all"
      >
        {downloading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {progress}%
          </>
        ) : (
          <>📦 Download All as ZIP</>
        )}
      </button>
      {downloading && (
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-400 transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

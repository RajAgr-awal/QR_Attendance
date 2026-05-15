'use client'
/**
 * QRScannerCamera — uses the native camera API + jsqr to decode QR codes.
 * No SSR issues. Debounces repeated scans of the same code (3 s cooldown).
 */
import { useRef, useEffect, useCallback } from 'react'
import jsQR from 'jsqr'

interface Props {
  onScan: (data: string) => void
  active?: boolean
}

export default function QRScannerCamera({ onScan, active = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const lastData = useRef('')
  const lastTime = useRef(0)

  const tick = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(video, 0, 0)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
    if (code?.data) {
      const now = Date.now()
      if (code.data !== lastData.current || now - lastTime.current > 3000) {
        lastData.current = code.data
        lastTime.current = now
        onScan(code.data)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [onScan])

  useEffect(() => {
    if (!active) return
    let stream: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      .then((s) => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
          rafRef.current = requestAnimationFrame(tick)
        }
      })
      .catch(console.error)

    return () => {
      cancelAnimationFrame(rafRef.current)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [active, tick])

  return (
    <div className="relative rounded-xl overflow-hidden bg-black">
      <video ref={videoRef} className="w-full aspect-video object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
      {/* Corner frame overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-56 h-56">
          {/* corners */}
          {['top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
            'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
            'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
            'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
          ].map((cls, i) => (
            <span key={i} className={`absolute w-8 h-8 border-emerald-400 ${cls}`} />
          ))}
          {/* scan line */}
          <div className="absolute inset-x-2 h-0.5 bg-emerald-400/70 top-1/2 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

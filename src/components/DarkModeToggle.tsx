'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-9 h-9" /> // prevent hydration mismatch

  const isDark = theme === 'dark'
  return (
    <button
      id="dark-mode-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10
                 border border-white/10 text-slate-300 transition-all"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}

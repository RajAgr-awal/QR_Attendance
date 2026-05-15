'use client'
/**
 * RealtimeAttendance — subscribes to Supabase postgres_changes on the
 * attendance table and updates live counts without page refresh.
 */
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DayStat {
  eventDayId: string
  label: string
  present: number
  absent: number
  late: number
  total: number
}

interface Props {
  initialStats: DayStat[]
}

export default function RealtimeAttendance({ initialStats }: Props) {
  const [stats, setStats] = useState<DayStat[]>(initialStats)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('realtime-attendance')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attendance' },
        (payload) => {
          const { event_day_id, status: newStatus } = payload.new as {
            event_day_id: string; status: string
          }
          const { status: oldStatus } = payload.old as { status: string }

          setStats(prev =>
            prev.map(day => {
              if (day.eventDayId !== event_day_id) return day
              const next = { ...day }
              // Decrement old status count
              if (oldStatus === 'present') next.present = Math.max(0, next.present - 1)
              else if (oldStatus === 'absent') next.absent = Math.max(0, next.absent - 1)
              else if (oldStatus === 'late') next.late = Math.max(0, next.late - 1)
              // Increment new status count
              if (newStatus === 'present') next.present++
              else if (newStatus === 'absent') next.absent++
              else if (newStatus === 'late') next.late++
              return next
            })
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Live Attendance</h2>
      </div>

      <div className="grid gap-4">
        {stats.map(day => {
          const pct = day.total > 0 ? Math.round((day.present / day.total) * 100) : 0
          return (
            <div key={day.eventDayId}
              className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">{day.label}</h3>
                <span className="text-2xl font-bold text-emerald-400">{pct}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Present', count: day.present, color: 'text-emerald-400' },
                  { label: 'Absent', count: day.absent, color: 'text-slate-400' },
                  { label: 'Late', count: day.late, color: 'text-amber-400' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="bg-white/5 rounded-lg py-2">
                    <div className={`text-xl font-bold tabular-nums ${color}`}>{count}</div>
                    <div className="text-slate-500 text-xs">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

-- ============================================================
-- Migration v4: Check-in / Check-out State Machine
-- Run AFTER migration_v3 in Supabase SQL Editor
-- ============================================================

-- 1. Add new attendance status values
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'checked_out';

-- 2. Add check-in/check-out timestamps + manual correction tracking
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_time          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS check_out_time         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manually_corrected_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manually_corrected_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.attendance.check_in_time  IS 'Timestamp of first QR scan (check-in)';
COMMENT ON COLUMN public.attendance.check_out_time IS 'Timestamp of second QR scan (check-out)';
COMMENT ON COLUMN public.attendance.manually_corrected_by IS 'Admin who manually overrode this record';

-- 3. Add device_info and scan_action to scan_logs
ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS scan_action  TEXT CHECK (scan_action IN ('check_in','check_out','rejected','invalid','not_found')),
  ADD COLUMN IF NOT EXISTS device_info  TEXT;

COMMENT ON COLUMN public.scan_logs.scan_action IS 'Outcome of this scan attempt';
COMMENT ON COLUMN public.scan_logs.device_info IS 'navigator.userAgent from scanner device';

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_status_day
  ON public.attendance(event_day_id, status);

CREATE INDEX IF NOT EXISTS idx_scan_logs_action
  ON public.scan_logs(scan_action, created_at DESC);

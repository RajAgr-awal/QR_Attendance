-- ============================================================
-- QR Attendance System — Full Database Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── 0. Extensions ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ─── 1. Custom ENUM Types ────────────────────────────────────
-- Create enums before tables that reference them
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'scanner', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE scan_result AS ENUM ('success', 'already_scanned', 'invalid', 'not_found');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── 2. TABLE: users ─────────────────────────────────────────
-- Mirrors auth.users — extended with app-specific fields.
-- id is the Supabase auth UID (UUID).
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT,
  role          user_role NOT NULL DEFAULT 'viewer',

  -- CHECK constraint on role ensures only valid roles can be inserted
  -- even if someone bypasses the ENUM type (e.g., raw SQL)
  CONSTRAINT chk_users_role CHECK (role IN ('admin', 'scanner', 'viewer')),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS
  'App-level user profiles mirroring auth.users, with role-based access.';
COMMENT ON COLUMN public.users.role IS
  'Allowed: admin | scanner | viewer. CHECK constraint enforced at DB level.';

-- ─── 3. TABLE: participants ───────────────────────────────────
-- People who attend the event. Each has a unique QR code.
CREATE TABLE IF NOT EXISTS public.participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  organization  TEXT,

  -- qr_code is a stable unique identifier embedded in the QR image.
  -- Format: "QR-{UUID}" — generated at insert time.
  qr_code       TEXT NOT NULL UNIQUE DEFAULT 'QR-' || gen_random_uuid()::TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.participants IS
  'Event attendees with a unique QR code per participant.';
COMMENT ON COLUMN public.participants.qr_code IS
  'Stable QR identifier. Format: QR-{UUID}. Never changes after generation.';

-- ─── 4. TABLE: event_days ────────────────────────────────────
-- One row per day of the event (supports multi-day events).
CREATE TABLE IF NOT EXISTS public.event_days (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label         TEXT NOT NULL,           -- e.g. "Day 1 — Keynote"
  event_date    DATE NOT NULL UNIQUE,    -- one row per calendar date
  description   TEXT,

  CONSTRAINT chk_event_days_date CHECK (event_date >= '2000-01-01'),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.event_days IS
  'Each row represents a single day of the event for multi-day tracking.';

-- ─── 5. TABLE: attendance ────────────────────────────────────
-- One row per (participant × event_day). Updated on scan.
CREATE TABLE IF NOT EXISTS public.attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  event_day_id    UUID NOT NULL REFERENCES public.event_days(id)  ON DELETE CASCADE,
  status          attendance_status NOT NULL DEFAULT 'absent',

  -- CHECK constraint mirrors ENUM — defense-in-depth
  CONSTRAINT chk_attendance_status CHECK (status IN ('present', 'absent', 'late')),

  scanned_at      TIMESTAMPTZ,                                   -- NULL until scanned
  scanned_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only ONE attendance record per participant per day
  CONSTRAINT uq_attendance_participant_day UNIQUE (participant_id, event_day_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_event_day ON public.attendance(event_day_id);
CREATE INDEX IF NOT EXISTS idx_attendance_participant ON public.attendance(participant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);

COMMENT ON TABLE public.attendance IS
  'One row per (participant, event_day). Updated by scanner on QR scan.';

-- ─── 6. TABLE: scan_logs ─────────────────────────────────────
-- Immutable audit trail of every scan attempt (good or bad).
CREATE TABLE IF NOT EXISTS public.scan_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  event_day_id    UUID NOT NULL REFERENCES public.event_days(id)  ON DELETE CASCADE,
  scanned_by      UUID NOT NULL REFERENCES public.users(id)       ON DELETE RESTRICT,
  raw_qr_data     TEXT NOT NULL,           -- exactly what the scanner read
  scan_result     scan_result NOT NULL,

  CONSTRAINT chk_scan_logs_result CHECK (
    scan_result IN ('success', 'already_scanned', 'invalid', 'not_found')
  ),

  ip_address      INET,
  user_agent      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No UPDATE: scan_logs is append-only
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_event_day   ON public.scan_logs(event_day_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_participant  ON public.scan_logs(participant_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_by  ON public.scan_logs(scanned_by);
CREATE INDEX IF NOT EXISTS idx_scan_logs_created_at  ON public.scan_logs(created_at DESC);

COMMENT ON TABLE public.scan_logs IS
  'Append-only audit log of every QR scan attempt. Never UPDATE or DELETE.';

-- ─── 7. updated_at Trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 8. ROW LEVEL SECURITY ────────────────────────────────────
-- Enable RLS on ALL tables. Without explicit policies, all rows are hidden.
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_days   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_logs    ENABLE ROW LEVEL SECURITY;

-- ── users policies ──
-- Users can read their own profile
CREATE POLICY "users: read own row"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "users: admin read all"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Admins can update any user's role
CREATE POLICY "users: admin update"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ── participants policies ──
-- Admin and scanner can read participants
CREATE POLICY "participants: admin/scanner read"
  ON public.participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'scanner')
    )
  );

-- Only admins can insert/update/delete participants
CREATE POLICY "participants: admin write"
  ON public.participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ── event_days policies ──
-- Any authenticated user can read event days
CREATE POLICY "event_days: authenticated read"
  ON public.event_days FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can manage event days
CREATE POLICY "event_days: admin write"
  ON public.event_days FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ── attendance policies ──
-- Admin/scanner can read attendance
CREATE POLICY "attendance: admin/scanner read"
  ON public.attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'scanner')
    )
  );

-- Admin/scanner can insert/update attendance (on scan)
CREATE POLICY "attendance: admin/scanner write"
  ON public.attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'scanner')
    )
  );

-- ── scan_logs policies ──
-- Admin/scanner can insert scan logs
CREATE POLICY "scan_logs: admin/scanner insert"
  ON public.scan_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'scanner')
    )
  );

-- Admin/scanner can read scan logs
CREATE POLICY "scan_logs: admin/scanner read"
  ON public.scan_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'scanner')
    )
  );

-- ─── 9. auto-create user profile on signup ────────────────────
-- Trigger: when a new auth.user is created, insert into public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'viewer'          -- default role for new signups
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

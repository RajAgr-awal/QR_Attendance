-- ============================================================
-- Migration v2: QR Token Revocation & Regeneration
-- Run in Supabase SQL Editor AFTER schema.sql
-- ============================================================

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS qr_revoked_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS qr_version    INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.participants.qr_revoked_at IS
  'Set to NOW() when QR is revoked. NULL means active.';
COMMENT ON COLUMN public.participants.qr_version IS
  'Incremented on each regeneration so old printed badges become invalid.';

-- Partial index: fast lookup of active (non-revoked) QR codes
CREATE INDEX IF NOT EXISTS idx_participants_active_qr
  ON public.participants(qr_code)
  WHERE qr_revoked_at IS NULL;

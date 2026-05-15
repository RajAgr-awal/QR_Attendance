-- ============================================================
-- Migration v3: Add reg_id column to participants
-- Run in Supabase SQL Editor AFTER migration_v2.
-- ============================================================

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS reg_id TEXT UNIQUE;

COMMENT ON COLUMN public.participants.reg_id IS
  'Human-readable registration ID (e.g. REG-0001). Unique. From CSV or auto-generated on import.';

CREATE INDEX IF NOT EXISTS idx_participants_reg_id ON public.participants(reg_id);

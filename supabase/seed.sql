-- ============================================================
-- QR Attendance System — Seed Data
-- Run AFTER schema.sql in Supabase Dashboard → SQL Editor
-- ============================================================
-- NOTE: Replace the UUIDs in admin_user_id with a real auth.users ID
--       after you create your admin account via the Auth dashboard.
-- ============================================================

-- ─── Seed: event_days (3 days) ───────────────────────────────
INSERT INTO public.event_days (id, label, event_date, description) VALUES
  (
    'aaaaaaaa-0001-0000-0000-000000000001',
    'Day 1 — Opening Keynote & Registration',
    '2026-06-10',
    'Welcome address, keynote by Dr. Priya Sharma, booth setup, networking lunch.'
  ),
  (
    'aaaaaaaa-0002-0000-0000-000000000002',
    'Day 2 — Technical Sessions',
    '2026-06-11',
    'Six parallel tracks: AI/ML, Cloud, DevOps, Security, Mobile, and Data Engineering.'
  ),
  (
    'aaaaaaaa-0003-0000-0000-000000000003',
    'Day 3 — Workshops & Closing',
    '2026-06-12',
    'Hands-on workshops, hackathon results, awards ceremony, closing gala dinner.'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Seed: participants (10 realistic attendees) ──────────────
INSERT INTO public.participants (id, name, email, phone, organization, qr_code) VALUES
  (
    'bbbbbbbb-0001-0000-0000-000000000001',
    'Arjun Mehta',
    'arjun.mehta@techcorp.in',
    '+91-98765-43210',
    'TechCorp India Pvt. Ltd.',
    'QR-ARJUN-MEHTA-001'
  ),
  (
    'bbbbbbbb-0002-0000-0000-000000000002',
    'Priya Nair',
    'priya.nair@cloudbase.io',
    '+91-97654-32109',
    'CloudBase Solutions',
    'QR-PRIYA-NAIR-002'
  ),
  (
    'bbbbbbbb-0003-0000-0000-000000000003',
    'Rohan Desai',
    'rohan.desai@aiventures.co',
    '+91-96543-21098',
    'AI Ventures Co.',
    'QR-ROHAN-DESAI-003'
  ),
  (
    'bbbbbbbb-0004-0000-0000-000000000004',
    'Sneha Kulkarni',
    'sneha.kulkarni@infosys.com',
    '+91-95432-10987',
    'Infosys Limited',
    'QR-SNEHA-KULKARNI-004'
  ),
  (
    'bbbbbbbb-0005-0000-0000-000000000005',
    'Vikram Singh',
    'vikram.singh@wipro.com',
    '+91-94321-09876',
    'Wipro Technologies',
    'QR-VIKRAM-SINGH-005'
  ),
  (
    'bbbbbbbb-0006-0000-0000-000000000006',
    'Ananya Iyer',
    'ananya.iyer@startupnest.in',
    '+91-93210-98765',
    'StartupNest Accelerator',
    'QR-ANANYA-IYER-006'
  ),
  (
    'bbbbbbbb-0007-0000-0000-000000000007',
    'Karthik Rajan',
    'karthik.rajan@tcs.com',
    '+91-92109-87654',
    'Tata Consultancy Services',
    'QR-KARTHIK-RAJAN-007'
  ),
  (
    'bbbbbbbb-0008-0000-0000-000000000008',
    'Meera Pillai',
    'meera.pillai@zoho.com',
    '+91-91098-76543',
    'Zoho Corporation',
    'QR-MEERA-PILLAI-008'
  ),
  (
    'bbbbbbbb-0009-0000-0000-000000000009',
    'Suresh Babu',
    'suresh.babu@hcl.com',
    '+91-90987-65432',
    'HCL Technologies',
    'QR-SURESH-BABU-009'
  ),
  (
    'bbbbbbbb-0010-0000-0000-000000000010',
    'Deepika Sharma',
    'deepika.sharma@microsoft.com',
    '+91-89876-54321',
    'Microsoft India',
    'QR-DEEPIKA-SHARMA-010'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Seed: attendance rows (pre-populate as 'absent') ─────────
-- Creates one row per participant per event day (30 rows total).
-- These will be updated to 'present' or 'late' on scan.
INSERT INTO public.attendance (participant_id, event_day_id, status)
SELECT
  p.id AS participant_id,
  d.id AS event_day_id,
  'absent' AS status
FROM public.participants p
CROSS JOIN public.event_days d
ON CONFLICT (participant_id, event_day_id) DO NOTHING;

-- ─── Verify seed ──────────────────────────────────────────────
SELECT 'event_days'   AS tbl, COUNT(*) FROM public.event_days
UNION ALL
SELECT 'participants' AS tbl, COUNT(*) FROM public.participants
UNION ALL
SELECT 'attendance'   AS tbl, COUNT(*) FROM public.attendance;

-- ============================================================
-- 124_error_reports.sql
-- Laporan ralat dari error boundary storefront (src/app/error.tsx,
-- global-error.tsx, checkout/error.tsx, lp/[slug]/error.tsx)
--   → POST /api/error-report (rate-limit 10/IP/10min, medan dipotong)
--   → sisip di sini via service role.
-- Ringkasan harian (/api/cron/daily-summary) baca jadual ni: "Ralat semalam".
-- Tiada PII: IP disimpan sebagai hash pendek sahaja.
-- Akses: service-role sahaja (RLS deny-all, tiada policy). ADDITIVE. Idempotent.
-- ============================================================

create table if not exists public.error_reports (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  digest     text,               -- Next.js error digest (padan log server)
  message    text,               -- dipotong 500 aksara
  path       text,               -- pathname sahaja (tanpa query)
  user_agent text,
  ip_hash    text                -- sha256(ip + secret) 16 hex
);

create index if not exists idx_error_reports_created on public.error_reports (created_at desc);

alter table public.error_reports enable row level security;
-- Tiada policy = deny-all; insert/select via service role sahaja.

-- Heartbeat cron baru: ringkasan harian 08:30 (cron-job.org).
-- Dashboard admin alert "CRON SENYAP" bila stamp lewat > 3 hari.
insert into public.cron_heartbeats (job, expected_minutes) values ('daily-summary', 1440)
on conflict (job) do nothing;

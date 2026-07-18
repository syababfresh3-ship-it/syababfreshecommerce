-- ============================================================
-- 109_cron_heartbeats.sql
-- Heartbeat cron — setiap cron stamp masa siap. Dashboard admin papar
-- alert merah bila sesuatu cron senyap melebihi jangkaan (7/9 cron kita
-- di penjadual luar cron-job.org; kalau mati, tiada siapa perasan).
-- expected_minutes = selang jangkaan; stale bila senyap > 3x selang.
-- Akses: service-role sahaja (RLS deny-all). ADDITIVE. Idempotent.
-- ============================================================

create table if not exists public.cron_heartbeats (
  job              text primary key,
  last_ok_at       timestamptz,
  last_error       text,
  last_error_at    timestamptz,
  expected_minutes int not null default 1440,
  updated_at       timestamptz not null default now()
);

alter table public.cron_heartbeats enable row level security;
-- Tiada policy = deny-all; akses via service role sahaja.

-- Seed semua cron + selang jangkaan (ubah di sini / terus di DB kalau
-- jadual cron-job.org berubah).
insert into public.cron_heartbeats (job, expected_minutes) values
  ('abandoned-cart',     1440),  -- Vercel cron 09:00 harian
  ('reconcile-payments', 1440),  -- Vercel cron 01:00 harian
  ('auto-followup',        30),  -- cron-job.org tiap 30 min
  ('blast-drain',          15),  -- cron-job.org
  ('wa-outbox-drain',      15),  -- cron-job.org
  ('auto-deliver',       1440),  -- cron-job.org harian
  ('external-sync',      1440),  -- cron-job.org harian
  ('payment-reminder',    120),  -- cron-job.org
  ('refresh-customers',  1440)   -- cron-job.org harian
on conflict (job) do nothing;

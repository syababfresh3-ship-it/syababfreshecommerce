-- ============================================================
-- 128_checkout_sessions.sql
-- Sprint 3F — Pemulihan troli terbengkalai (EMAIL SAHAJA, keputusan
-- pemilik: tiada WhatsApp).
--
-- checkout_sessions: snapshot troli + email/nama/telefon yang ditangkap di
-- /checkout sebaik email sah (tetamu & member). Token rawak = pautan
-- pemulihan /checkout?recover=<token> (sah 7 hari). Cron
-- /api/cron/abandoned-checkout hantar 2 email (1j & 24j selepas last_seen_at),
-- stamp *_sent_at sekali sahaja (claim atomik). Order masuk → recovered_at
-- diisi oleh /api/orders & /api/store/guest-order (attribution).
--
-- email_suppressions: senarai "Tak mahu peringatan ini" (pautan nyah-langgan
-- dalam email). Hanya email PEMASARAN (peringatan troli) semak jadual ini —
-- email transaksi (resit, tracking) TIDAK terjejas.
--
-- Akses: service-role sahaja (RLS deny-all, tiada policy awam).
-- ADDITIVE. Idempotent — selamat dijalankan semula. Run di Supabase SQL Editor.
-- Kod server tolerate jadual belum wujud (42P01 / PGRST205 → no-op senyap).
-- ============================================================

create table if not exists public.checkout_sessions (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  name              text,
  phone             text,                       -- dinormalisasi (60xxxxxxxxx) — padanan attribution
  items             jsonb not null default '[]'::jsonb,
  subtotal          numeric,
  token             text not null unique,       -- pautan pemulihan + nyah-langgan
  source            text default 'checkout',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),  -- aktiviti terakhir di checkout
  email_1h_sent_at  timestamptz,
  email_24h_sent_at timestamptz,
  recovered_at      timestamptz,                -- order masuk (mana-mana jalur)
  order_ref         text,                       -- order_number yang memulihkan
  unsubscribed_at   timestamptz
);

create index if not exists idx_checkout_sessions_email_created
  on public.checkout_sessions (email, created_at desc);
create index if not exists idx_checkout_sessions_last_seen
  on public.checkout_sessions (last_seen_at);

alter table public.checkout_sessions enable row level security;
-- Tiada policy = deny-all; akses via service role sahaja.

create table if not exists public.email_suppressions (
  email      text primary key,
  reason     text,
  created_at timestamptz not null default now()
);

alter table public.email_suppressions enable row level security;
-- Tiada policy = deny-all; akses via service role sahaja.

-- Heartbeat cron baru (lihat 109): cron-job.org tiap 30 min.
-- Dashboard admin alert "CRON SENYAP" bila stamp lewat > 90 min.
insert into public.cron_heartbeats (job, expected_minutes)
  values ('abandoned-checkout', 30)
on conflict (job) do nothing;

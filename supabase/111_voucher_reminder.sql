-- ============================================================
-- 111_voucher_reminder.sql
-- Nudge voucher hampir luput (Tier 2.2): cron harian email peringatan
-- kepada pemilik voucher peribadi (user_id terisi) yang belum ditebus
-- dan luput dalam 7 hari. reminder_sent_at = stamp sekali sahaja per
-- voucher (tak spam). ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

alter table public.promo_codes
  add column if not exists reminder_sent_at timestamptz;

-- Cron scan: voucher peribadi aktif belum diperingat.
create index if not exists idx_promo_codes_reminder
  on public.promo_codes (expires_at)
  where user_id is not null and reminder_sent_at is null and active = true;

-- Daftar heartbeat untuk cron baru (lihat 109).
insert into public.cron_heartbeats (job, expected_minutes)
  values ('voucher-reminder', 1440)
on conflict (job) do nothing;

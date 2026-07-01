-- ============================================================
-- 100_promo_user_voucher.sql
-- Voucher per-user (cth welcome RM5). promo_codes.user_id diisi = voucher milik
-- seorang; null = kod kongsi biasa. Checkout & once-per-user tak berubah.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================
alter table public.promo_codes
  add column if not exists user_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_promo_codes_user on public.promo_codes (user_id) where user_id is not null;

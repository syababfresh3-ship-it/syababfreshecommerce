-- ============================================================
-- 099_blast_header_video.sql
-- Sokong blast template ber-header VIDEO (cth promo_ceri_2x_pika_3006).
-- Simpan URL video header (public). header_image kekal untuk template IMAGE.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================
alter table public.crm_blasts
  add column if not exists header_video text;

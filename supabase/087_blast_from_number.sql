-- ============================================================
-- 087_blast_from_number.sql
-- Blaster multi-number: pilih nombor mana hantar kempen.
-- null = guna nombor default (env). ADDITIVE. Idempotent.
-- ============================================================

alter table public.crm_blasts
  add column if not exists phone_number_id text;

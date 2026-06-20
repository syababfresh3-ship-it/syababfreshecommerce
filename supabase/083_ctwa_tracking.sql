-- ============================================================
-- 083_ctwa_tracking.sql
-- Click-to-WhatsApp (CTWA) conversion attribution untuk Meta CAPI
-- (action_source = business_messaging). ADDITIVE. Idempotent.
-- Run di Supabase SQL Editor.
-- ============================================================

-- Click id ditangkap dari mesej PERTAMA chat yang berasal dari iklan CTWA.
-- Meta hantar `referral.ctwa_clid` dalam webhook mesej masuk.
alter table public.wa_contacts
  add column if not exists ctwa_clid      text,
  add column if not exists ctwa_source_id text,
  add column if not exists ctwa_at        timestamptz;

-- Snapshot click id ke order masa cipta supaya event Purchase boleh dihantar
-- kemudian (FPX) tanpa join semula ke contact.
alter table public.lp_guest_orders
  add column if not exists ctwa_clid text;

create index if not exists idx_lp_guest_orders_ctwa
  on public.lp_guest_orders(ctwa_clid) where ctwa_clid is not null;

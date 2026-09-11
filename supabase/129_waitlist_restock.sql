-- ============================================================
-- 129_waitlist_restock.sql
-- Sprint 3 G: notis restock satu-klik dari waitlist.
-- Jejak SALURAN notis (wa | email | wa+email | manual) + kempen Blaster yang
-- dicipta, supaya admin nampak macam mana setiap entri dimaklum.
-- ADDITIVE. Idempotent. Jalankan di Supabase SQL Editor.
--
-- Kod (lib/waitlist-restock.ts, api/admin/waitlist/*) TOLERAN kalau migration
-- ini belum dijalankan: 42703 / PGRST204 → jatuh balik tanda notified_at sahaja.
-- ============================================================

alter table public.product_waitlist
  add column if not exists notified_via      text,   -- wa | email | wa+email | manual
  add column if not exists notified_blast_id uuid references public.crm_blasts(id) on delete set null;

create index if not exists idx_product_waitlist_blast
  on public.product_waitlist (notified_blast_id)
  where notified_blast_id is not null;

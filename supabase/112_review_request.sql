-- ============================================================
-- 112_review_request.sql
-- Email jemput ulasan selepas order delivered (baki Tier 1.1).
-- review_request_sent_at = jaminan SEKALI sahaja per order.
-- Member sahaja (orders) — ulasan perlukan akaun; LP guest tiada login.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

alter table public.orders
  add column if not exists review_request_sent_at timestamptz;

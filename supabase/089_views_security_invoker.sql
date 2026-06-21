-- ============================================================
-- 089_views_security_invoker.sql
-- Fix Supabase Security Advisor: "Security Definer View" (CRITICAL).
-- View default jalan dgn kebenaran PEMILIK (postgres) → pintas RLS.
-- security_invoker = on → view ikut kebenaran USER yang query (hormati RLS).
--
-- Selamat: 3 view ni admin-only, di-query via service role (createAdminClient)
-- yang pintas RLS tanpa kira setting ni → dashboard admin tak terjejas.
-- product_stock SENGAJA tak diubah (pre-existing, mungkin layan storefront awam).
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

alter view public.crm_blast_progress           set (security_invoker = on);
alter view public.crm_blast_roas               set (security_invoker = on);
alter view public.crm_blast_order_attribution  set (security_invoker = on);

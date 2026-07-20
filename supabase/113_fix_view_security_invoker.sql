-- ============================================================
-- 113_fix_view_security_invoker.sql
-- FIX regression: Supabase Security Advisor "Security Definer View" muncul
-- semula untuk crm_blast_order_attribution.
--
-- Punca: 089 dah set security_invoker = on, TAPI 090 buat
-- `create or replace view` tanpa klausa WITH — dalam Postgres itu RESET
-- reloptions ke default, dan default security_invoker ialah OFF (iaitu
-- kelakuan SECURITY DEFINER). Jadi 090 tanpa sedar batalkan fix 089.
--
-- Kesan sebenar rendah: view ni tidak di-query terus oleh kod app; ia hanya
-- dipakai dalam definisi crm_blast_roas, yang dibaca via service role
-- (createAdminClient) yang pintas RLS tanpa mengira setting ini. Dibetulkan
-- untuk kekalkan pertahanan berlapis.
--
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

alter view public.crm_blast_order_attribution set (security_invoker = on);

-- Sahkan (patut pulang security_invoker=on untuk kelima-lima view):
-- select c.relname, c.reloptions
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'v'
--   and c.relname like 'crm_blast%'
-- order by c.relname;

-- ============================================================
-- 091_wa_msg_costs.sql
-- Kos mesej WhatsApp ikut kategori template (MYR):
--   Marketing = 0.40 (blast kempen — guna oleh crm_blast_roas)
--   Utility   = 0.11 (notifikasi status order/transaksi)
-- crm_blast_roas (084) baca wa_marketing_msg_cost sebab blast = marketing.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor (atau dah diset via app).
-- ============================================================

insert into app_settings (key, value) values ('wa_marketing_msg_cost', '0.40')
  on conflict (key) do update set value = excluded.value;

insert into app_settings (key, value) values ('wa_utility_msg_cost', '0.11')
  on conflict (key) do nothing;

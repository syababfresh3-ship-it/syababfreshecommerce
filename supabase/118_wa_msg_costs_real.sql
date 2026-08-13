-- ============================================================
-- 118_wa_msg_costs_real.sql
-- Betulkan kadar anggaran kos mesej WhatsApp supaya padan kos SEBENAR Meta,
-- TERMASUK SST 8% (Meta cas SST di Malaysia; pricing_analytics pulangkan kos
-- SEBELUM cukai, jadi × 1.08):
--   Marketing = 0.375 (sebenar ~RM0.3467 × 1.08 — dulu 0.40)
--   Utility   = 0.056 (sebenar ~RM0.0516 × 1.08 — dulu 0.11, 2x tinggi)
-- Ganti nilai lama dalam 091_wa_msg_costs.sql. Dipakai oleh view crm_blast_roas
-- (kos per-campaign, anggaran) & kad "Total kos blast" di dashboard Blaster.
-- Kos SEBENAR (bukan anggaran) ditarik terus dari Meta di /api/whatsapp/meta-cost
-- (lib wa-meta-cost.ts juga darab 1.08 untuk SST).
-- ADDITIVE. Idempotent — do update supaya sentiasa selaras bila di-run semula.
-- ============================================================

insert into app_settings (key, value) values ('wa_marketing_msg_cost', '0.375')
  on conflict (key) do update set value = excluded.value;

insert into app_settings (key, value) values ('wa_utility_msg_cost', '0.056')
  on conflict (key) do update set value = excluded.value;

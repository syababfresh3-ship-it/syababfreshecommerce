-- ============================================================
-- 135_ad_spend_leads.sql — metrik leads iklan pada ad_spend (24 Sep 2026)
--
-- Cron meta-ad-spend kini tarik, selain spend, metrik mesej dari Meta Insights
-- (ikut kempen, harian): klik pautan, "perbualan WhatsApp bermula"
-- (onsite_conversion.messaging_conversation_started_7d), balasan pertama
-- (messaging_first_reply) dan pelanggan yang hantar ≥2 mesej
-- (messaging_user_depth_2_message_send). Untuk kempen Click-to-WhatsApp
-- (cth "Pika - Traffic - WhatsApp") inilah "leads" — order Quick Order staf
-- dipadankan ke kempen via app_settings.roas_source_aliases.
--
-- Lajur nullable: baris manual / sebelum migration kekal null. Kod tahan bila
-- lajur belum wujud (jatuh balik ke select/insert tanpa metrik). Idempotent.
-- Tiada view → tiada security_invoker diperlukan.
-- ============================================================

alter table public.ad_spend
  add column if not exists clicks        integer,
  add column if not exists conversations integer,
  add column if not exists replies       integer,
  add column if not exists depth2        integer;

comment on column public.ad_spend.clicks        is 'Klik pautan (inline_link_clicks) — Meta Insights, ikut kempen/hari';
comment on column public.ad_spend.conversations is 'Perbualan WhatsApp bermula (messaging_conversation_started_7d) = leads iklan CTWA';
comment on column public.ad_spend.replies       is 'Balasan pertama (messaging_first_reply)';
comment on column public.ad_spend.depth2        is 'Pelanggan hantar ≥2 mesej (messaging_user_depth_2_message_send)';

-- ============================================================
-- 152_wa_ai_log_detail.sql
-- Fasa 3 chatbot: rekod balasan AI & tool yang dipanggil dalam log, supaya Analytics boleh
-- senaraikan "soalan tak pasti" (AI mengaku tak tahu / carian produk kosong) bersama jawapannya.
-- outcome baharu: 'uncertain' (balasan dihantar tetapi AI tidak yakin). ADDITIVE. Idempotent.
-- ============================================================
alter table public.wa_ai_log add column if not exists reply_preview text;
alter table public.wa_ai_log add column if not exists tools text[];
comment on column public.wa_ai_log.reply_preview is 'Potongan balasan AI (≤300 aksara) untuk semakan.';
comment on column public.wa_ai_log.tools is 'Nama tool yang AI panggil dalam giliran ini.';

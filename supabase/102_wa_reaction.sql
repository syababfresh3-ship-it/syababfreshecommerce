-- 102: Simpan emoji reaction customer pada mesej WhatsApp.
-- WhatsApp Cloud API hantar reaction sebagai mesej jenis "reaction" berasingan
-- { reaction: { message_id, emoji } }. Kita simpan emoji pada baris mesej SASARAN
-- (bukan cipta baris baru). Emoji kosong = reaction ditarik balik (jadi NULL).
alter table public.wa_messages add column if not exists reaction text;

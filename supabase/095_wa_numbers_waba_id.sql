-- ============================================================
-- 095_wa_numbers_waba_id — sokong template PER-WABA untuk multi-number.
-- Template WhatsApp adalah per-WABA. Untuk blast/balas dari nombor #2
-- (Syabab Fresh ll) kita perlu senarai template WABA nombor itu, bukan
-- WABA utama (env WHATSAPP_WABA_ID). Simpan waba_id setiap nombor.
-- Additive sahaja — kolum nullable, fallback ke env bila null.
-- ============================================================
alter table public.wa_numbers add column if not exists waba_id text;

comment on column public.wa_numbers.waba_id is
  'WhatsApp Business Account ID nombor ini. Untuk senarai template per-WABA. Null = guna env WHATSAPP_WABA_ID.';

-- Populate dua nombor sedia ada (WABA ID dari WhatsApp Manager).
-- Nombor utama (Syabab Fresh)    : phone_number_id 1107044612487426 → WABA 1505402361259813
-- Nombor kedua (Syabab Fresh ll) : phone_number_id 1207396515787216 → WABA 1658758955348530
update public.wa_numbers set waba_id = '1505402361259813'
  where phone_number_id = '1107044612487426' and waba_id is null;
update public.wa_numbers set waba_id = '1658758955348530'
  where phone_number_id = '1207396515787216' and waba_id is null;

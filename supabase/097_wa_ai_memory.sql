-- ============================================================
-- 097_wa_ai_memory — memori per-customer untuk AI chatbot (gaya ReplyLa AI Memory).
-- AI ingat fakta tiap customer (nama panggilan, budget, kesukaan, pantang) —
-- kekal selamanya (tak macam sejarah chat yang dipangkas). Additive.
-- ============================================================
alter table public.wa_contacts
  add column if not exists ai_memory jsonb not null default '{}'::jsonb;

comment on column public.wa_contacts.ai_memory is
  'Fakta yang AI ingat tentang customer ini (key-value). Disuntik ke prompt + dikemas oleh tool remember_about_customer.';

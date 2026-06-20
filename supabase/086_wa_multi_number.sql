-- ============================================================
-- 086_wa_multi_number.sql
-- Sokong DUA+ nombor WhatsApp Official (1 nombor 1 team sale).
-- ADDITIVE + backward-compatible: nombor sedia ada = lalai (is_default).
-- Bila nombor baru ready: daftar di Meta → tambah 1 baris di wa_numbers.
-- Idempotent. Jalankan di Supabase SQL Editor.
-- ============================================================

-- Daftar nombor WhatsApp (semua bawah WABA sama → token boleh kongsi env;
-- token nullable = guna WHATSAPP_TOKEN env). owner = salesperson pemilik.
create table if not exists public.wa_numbers (
  phone_number_id text primary key,
  display_name    text not null,
  owner           uuid references public.profiles(id) on delete set null,
  token           text,                              -- null = guna env WHATSAPP_TOKEN
  is_active       boolean not null default true,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Seed nombor sedia ada (dari env WHATSAPP_PHONE_NUMBER_ID) sebagai lalai.
insert into public.wa_numbers (phone_number_id, display_name, is_default)
values ('1107044612487426', 'Nombor Utama', true)
on conflict (phone_number_id) do nothing;

-- Conversation: nombor mana customer hubungi (untuk balas dari nombor betul + routing).
alter table public.wa_conversations
  add column if not exists phone_number_id text;

-- RLS — admin sahaja (sama posture jadual CRM lain).
alter table public.wa_numbers enable row level security;
drop policy if exists "wa_numbers: admin" on public.wa_numbers;
create policy "wa_numbers: admin" on public.wa_numbers
  for all using (public.is_admin()) with check (public.is_admin());

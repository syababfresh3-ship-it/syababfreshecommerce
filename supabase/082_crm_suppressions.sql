-- ============================================================
-- 082_crm_suppressions.sql
-- Blaster Fasa 5: senarai suppression (unsubscribe) dengan SUMBER.
-- Sumber: replied_stop (balas STOP) | wa_opt_out (opt-out WhatsApp) | manual.
-- Boleh simpan nombor yang BUKAN contact (block manual). ADDITIVE. Idempotent.
-- ============================================================

create table if not exists public.crm_suppressions (
  id         uuid primary key default uuid_generate_v4(),
  wa_id      text not null unique,
  source     text not null default 'manual',   -- replied_stop | wa_opt_out | manual
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_suppressions_source on public.crm_suppressions(source);

-- Backfill dari opt_out sedia ada (mekanisme tunggal setakat ini = balas STOP).
insert into public.crm_suppressions (wa_id, source)
select wa_id, 'replied_stop' from public.wa_contacts where opt_out = true
on conflict (wa_id) do nothing;

-- RLS — admin sahaja (sama posture jadual CRM lain).
alter table public.crm_suppressions enable row level security;
drop policy if exists "crm_suppressions: admin" on public.crm_suppressions;
create policy "crm_suppressions: admin" on public.crm_suppressions
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 091_wa_followups.sql
-- Follow-up reminder (nudge DALAMAN) untuk inbox CRM.
-- Salesperson set reminder per contact → muncul di senarai "Follow-up" + badge
-- bila due. TIADA mesej auto ke customer (auto_send off-by-default — risiko ban).
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

create table if not exists public.wa_followups (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid not null references public.wa_contacts(id) on delete cascade,
  conversation_id uuid references public.wa_conversations(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null,
  assigned_to     uuid references public.profiles(id) on delete set null, -- siapa kena follow up
  remind_at       timestamptz not null,
  note            text,
  status          text not null default 'pending',  -- pending | done | cancelled
  auto_send       boolean not null default false,    -- OFF default (risiko ban)
  template_name   text,                              -- hanya kalau auto_send (template rasmi)
  created_at      timestamptz not null default now(),
  done_at         timestamptz
);

create index if not exists idx_wa_followups_due on public.wa_followups(remind_at) where status = 'pending';
create index if not exists idx_wa_followups_contact on public.wa_followups(contact_id);
create index if not exists idx_wa_followups_assigned on public.wa_followups(assigned_to);

alter table public.wa_followups enable row level security;
drop policy if exists wa_followups_admin on public.wa_followups;
create policy wa_followups_admin on public.wa_followups
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

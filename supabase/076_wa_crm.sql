-- ============================================================
-- 076_wa_crm.sql
-- Syabab Sales CRM (WhatsApp) — Fasa A: Inbox + Lead capture.
-- ADDITIVE sahaja: jadual baru wa_* / crm_*. TIDAK menyentuh jadual
-- sedia ada. Idempotent — selamat dijalankan semula.
-- Guna helper sedia ada public.is_admin() (dari 003_rls.sql).
-- ============================================================

-- Trigger updated_at (namespaced, additive)
create or replace function public.wa_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. WA CONTACTS — satu baris setiap nombor WhatsApp
-- ============================================================
create table if not exists public.wa_contacts (
  id              uuid primary key default uuid_generate_v4(),
  wa_id           text not null unique,            -- WhatsApp id (E.164 tanpa +)
  phone           text,
  name            text,                            -- nama profil WhatsApp
  profile_id      uuid references public.profiles(id) on delete set null, -- link customer berdaftar
  tags            text[] not null default '{}',
  opt_out         boolean not null default false,
  last_inbound_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_wa_contacts_phone   on public.wa_contacts(phone);
create index if not exists idx_wa_contacts_profile on public.wa_contacts(profile_id);

drop trigger if exists trg_wa_contacts_updated on public.wa_contacts;
create trigger trg_wa_contacts_updated before update on public.wa_contacts
  for each row execute function public.wa_set_updated_at();

-- ============================================================
-- 2. WA CONVERSATIONS — satu per contact
-- ============================================================
create table if not exists public.wa_conversations (
  id                   uuid primary key default uuid_generate_v4(),
  contact_id           uuid not null unique references public.wa_contacts(id) on delete cascade,
  last_message_at      timestamptz,
  last_message_preview text,
  unread_count         integer not null default 0,
  window_expires_at    timestamptz,                -- tetingkap 24j (dari mesej masuk terakhir)
  status               text not null default 'open', -- open | closed | snoozed
  assigned_to          uuid references public.profiles(id) on delete set null, -- team assign
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_wa_conv_last     on public.wa_conversations(last_message_at desc);
create index if not exists idx_wa_conv_assigned on public.wa_conversations(assigned_to);
create index if not exists idx_wa_conv_status   on public.wa_conversations(status);

drop trigger if exists trg_wa_conv_updated on public.wa_conversations;
create trigger trg_wa_conv_updated before update on public.wa_conversations
  for each row execute function public.wa_set_updated_at();

-- ============================================================
-- 3. WA MESSAGES
-- ============================================================
create table if not exists public.wa_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  contact_id      uuid not null references public.wa_contacts(id) on delete cascade,
  wa_message_id   text unique,                     -- wamid Meta (dedup + kemas status)
  direction       text not null,                   -- in | out
  type            text not null default 'text',    -- text|image|video|audio|document|template|sticker|location
  body            text,
  media_url       text,
  template_name   text,
  status          text not null default 'received',-- received|sent|delivered|read|failed
  error           text,
  sent_by         uuid references public.profiles(id) on delete set null, -- admin yang hantar
  created_at      timestamptz not null default now() -- timestamp mesej
);
create index if not exists idx_wa_msg_conv on public.wa_messages(conversation_id, created_at);

-- ============================================================
-- 4. CRM LEADS — satu lead per contact (Fasa A)
-- ============================================================
create table if not exists public.crm_leads (
  id               uuid primary key default uuid_generate_v4(),
  contact_id       uuid not null unique references public.wa_contacts(id) on delete cascade,
  stage            text not null default 'baru',   -- baru|followup|hangat|won|lost
  source           text,                            -- inbound | blast:<template> | waitlist
  campaign         text,
  owner_id         uuid references public.profiles(id) on delete set null,
  value            numeric(10,2) not null default 0,
  next_followup_at timestamptz,
  order_id         uuid references public.orders(id) on delete set null, -- won → order
  won_at           timestamptz,
  lost_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_crm_leads_stage    on public.crm_leads(stage);
create index if not exists idx_crm_leads_followup on public.crm_leads(next_followup_at);
create index if not exists idx_crm_leads_owner    on public.crm_leads(owner_id);

drop trigger if exists trg_crm_leads_updated on public.crm_leads;
create trigger trg_crm_leads_updated before update on public.crm_leads
  for each row execute function public.wa_set_updated_at();

-- ============================================================
-- 5. CRM NOTES — nota dalaman per contact
-- ============================================================
create table if not exists public.crm_notes (
  id         uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references public.wa_contacts(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_crm_notes_contact on public.crm_notes(contact_id, created_at);

-- ============================================================
-- RLS — admin sahaja (service_role bypass RLS untuk webhook server)
-- ============================================================
alter table public.wa_contacts      enable row level security;
alter table public.wa_conversations enable row level security;
alter table public.wa_messages      enable row level security;
alter table public.crm_leads        enable row level security;
alter table public.crm_notes        enable row level security;

drop policy if exists "wa_contacts: admin"      on public.wa_contacts;
drop policy if exists "wa_conversations: admin" on public.wa_conversations;
drop policy if exists "wa_messages: admin"      on public.wa_messages;
drop policy if exists "crm_leads: admin"        on public.crm_leads;
drop policy if exists "crm_notes: admin"        on public.crm_notes;

create policy "wa_contacts: admin"      on public.wa_contacts      for all using (public.is_admin()) with check (public.is_admin());
create policy "wa_conversations: admin" on public.wa_conversations for all using (public.is_admin()) with check (public.is_admin());
create policy "wa_messages: admin"      on public.wa_messages      for all using (public.is_admin()) with check (public.is_admin());
create policy "crm_leads: admin"        on public.crm_leads        for all using (public.is_admin()) with check (public.is_admin());
create policy "crm_notes: admin"        on public.crm_notes        for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Realtime — supaya inbox live update (Supabase Realtime)
-- ============================================================
do $$ begin alter publication supabase_realtime add table public.wa_messages;      exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.wa_conversations; exception when duplicate_object then null; end $$;

-- ============================================================
-- 077_crm_blast.sql
-- Syabab Sales CRM — Fasa B: Blast (kempen template rasmi).
-- ADDITIVE: jadual crm_blasts + crm_blast_recipients. Idempotent.
-- Guna helper public.is_admin() + public.wa_set_updated_at() (dari 076).
-- ============================================================

create table if not exists public.crm_blasts (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  template_name text not null,
  template_lang text not null default 'ms',
  params        jsonb not null default '{}',     -- params statik (sama utk semua)
  audience      jsonb not null default '{}',      -- { source, tag, ... }
  status        text not null default 'draft',    -- draft|scheduled|sending|sent|failed
  scheduled_at  timestamptz,                      -- Fasa B2: jadual hantar
  total         integer not null default 0,
  sent          integer not null default 0,
  failed        integer not null default 0,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_crm_blasts_status    on public.crm_blasts(status);
create index if not exists idx_crm_blasts_scheduled on public.crm_blasts(scheduled_at);

drop trigger if exists trg_crm_blasts_updated on public.crm_blasts;
create trigger trg_crm_blasts_updated before update on public.crm_blasts
  for each row execute function public.wa_set_updated_at();

-- Penerima setiap kempen (jejak status per nombor, asingkan dari inbox)
create table if not exists public.crm_blast_recipients (
  id            uuid primary key default uuid_generate_v4(),
  blast_id      uuid not null references public.crm_blasts(id) on delete cascade,
  wa_id         text not null,
  name          text,
  status        text not null default 'pending',  -- pending|sent|failed
  error         text,
  wa_message_id text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_crm_blast_rcpt on public.crm_blast_recipients(blast_id);

-- RLS
alter table public.crm_blasts            enable row level security;
alter table public.crm_blast_recipients  enable row level security;
drop policy if exists "crm_blasts: admin"           on public.crm_blasts;
drop policy if exists "crm_blast_recipients: admin" on public.crm_blast_recipients;
create policy "crm_blasts: admin"           on public.crm_blasts           for all using (public.is_admin()) with check (public.is_admin());
create policy "crm_blast_recipients: admin" on public.crm_blast_recipients for all using (public.is_admin()) with check (public.is_admin());

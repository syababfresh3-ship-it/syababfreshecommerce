-- ============================================================
-- 146_quotations.sql
-- Modul Sebut Harga (quotation) dalam website — ganti Refrens untuk
-- sebut harga baharu (gift box, kurma borong, umum). Lihat
-- docs/plan-sebut-harga.md. ADDITIVE. Idempotent.
-- Siri nombor: STSB-Q<YYYY>-<####>, reset setiap tahun (pemilik 24 Okt 2026:
-- tak perlu sambung siri Refrens). Draf tiada nombor; nombor diberi masa
-- dikeluarkan (issue) → tiada lompang.
-- ============================================================

create table if not exists public.quotations (
  id              uuid primary key default gen_random_uuid(),
  quote_number    text unique,                        -- null semasa draf
  status          text not null default 'draft',      -- draft|issued|accepted|rejected|expired|cancelled|converted
  issued_at       timestamptz,
  valid_until     date,
  customer_id     uuid references public.customers(id) on delete set null,
  client          jsonb not null default '{}',        -- snapshot {company,name,reg_no,tin,address,email,phone,attn}
  source_type     text,                               -- gift_order | borong | manual | refrens
  source_id       uuid,                               -- gift_orders.id / resellers.id
  items           jsonb not null default '[]',        -- [{name,description,qty,unit,rate}]
  subtotal        numeric(12,2) not null default 0,
  discount        numeric(12,2) not null default 0,
  charges         jsonb not null default '[]',        -- [{label,amount}]
  total           numeric(12,2) not null default 0,
  currency        text not null default 'MYR',
  terms           text[] not null default '{}',
  notes           text,
  show_bank       boolean not null default true,
  bank_key        text not null default 'publicbank',
  custom_fields   jsonb not null default '[]',        -- [{label,value}]
  share_token     text unique,                        -- pautan awam /q/<token>
  accepted_at     timestamptz,
  accepted_by     text,
  accepted_ip     text,
  cancel_reason   text,
  legacy_source   text,                               -- 'refrens' untuk import fasa 2
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists quotations_status_idx   on public.quotations (status);
create index if not exists quotations_customer_idx on public.quotations (customer_id);
create index if not exists quotations_source_idx   on public.quotations (source_type, source_id);
create index if not exists quotations_created_idx  on public.quotations (created_at desc);

comment on table public.quotations is 'Sebut harga (quotation) dikeluarkan dari admin website; snapshot klien & baris item kekal walau customers berubah.';

create table if not exists public.quotation_events (
  id            bigserial primary key,
  quotation_id  uuid not null references public.quotations(id) on delete cascade,
  type          text not null,                        -- created|issued|edited|emailed|viewed|accepted|rejected|cancelled|applied_gift_order|duplicated
  meta          jsonb not null default '{}',
  actor         text,                                 -- email admin / 'client' / 'system'
  created_at    timestamptz not null default now()
);
create index if not exists quotation_events_q_idx on public.quotation_events (quotation_id, created_at desc);

-- Butiran syarikat klien pada customers (pilihan; sedia untuk e-Invois nanti).
alter table public.customers add column if not exists company          text;
alter table public.customers add column if not exists company_reg_no   text;
alter table public.customers add column if not exists tin              text;
alter table public.customers add column if not exists billing_address  text;

-- Nombor sebut harga: STSB-Q<YYYY>-<####>; kira max dalam tahun semasa (corak 088).
-- Pertembungan serentak → unique violation → route cuba semula sekali.
create or replace function public.generate_quotation_number()
returns text language plpgsql as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_seq  integer;
begin
  select coalesce(max((regexp_match(quote_number, 'STSB-Q\d{4}-(\d+)'))[1]::integer), 0) + 1
    into v_seq
    from public.quotations
   where quote_number like 'STSB-Q' || v_year || '-%';
  return 'STSB-Q' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- RLS: admin sahaja (route guna service role; polisi untuk RLS am).
alter table public.quotations       enable row level security;
alter table public.quotation_events enable row level security;

drop policy if exists quotations_admin on public.quotations;
create policy quotations_admin on public.quotations
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists quotation_events_admin on public.quotation_events;
create policy quotation_events_admin on public.quotation_events
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

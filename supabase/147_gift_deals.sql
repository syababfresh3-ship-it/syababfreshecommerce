-- ============================================================
-- 147_gift_deals.sql
-- Pipeline Gift Kurma (CRM ringan B2B) — satu deal per sebut harga website.
-- KHAS gift kurma: TIDAK sentuh `orders` kedai mahupun `gift_orders` (Studio).
-- Lihat docs/plan-pipeline-gift.md. ADDITIVE. Idempotent.
-- Peringkat: quote → invoice → deposit → artwork → production → delivered → balance → done | lost
-- (medan bebas — auto hanya maju, admin boleh tukar ke mana-mana).
-- ============================================================

-- Tarikh perlu hantar ditanya masa sebut harga (disalin ke deal).
alter table public.quotations add column if not exists needed_by date;
comment on column public.quotations.needed_by is 'Tarikh klien perlu barang (bukan due date bayaran). Dicetak "Required delivery" pada PDF.';

create table if not exists public.gift_deals (
  id                  uuid primary key default gen_random_uuid(),
  quotation_id        uuid unique references public.quotations(id) on delete set null,
  customer_id         uuid references public.customers(id) on delete set null,
  client              jsonb not null default '{}',          -- snapshot dari sebut harga
  title               text,
  stage               text not null default 'quote',        -- quote|invoice|deposit|artwork|production|delivered|balance|done|lost
  amount              numeric(12,2) not null default 0,
  accepted_at         timestamptz,                          -- klien tekan Accept (lencana)
  deposit_pct         integer not null default 50,          -- 0 = bayar penuh selepas hantar
  deposit_paid_at     timestamptz,
  deposit_amount      numeric(12,2),
  deposit_source      text,                                 -- refrens | manual
  deposit_ref         text,
  balance_paid_at     timestamptz,
  balance_amount      numeric(12,2),
  balance_source      text,
  balance_ref         text,
  po_number           text,
  po_file_url         text,
  artwork_approved_at timestamptz,
  artwork_by          text,
  artwork_file_url    text,
  production_due      date,
  needed_by           date,                                 -- tarikh perlu hantar
  delivered_at        timestamptz,
  delivery_method     text,                                 -- lalamove | kurier | ambil | lain
  tracking_no         text,
  pod_url             text,                                 -- foto bukti terima
  received_by         text,
  next_action         text,
  next_action_at      date,
  lost_reason         text,
  notes               text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists gift_deals_stage_idx    on public.gift_deals (stage, next_action_at);
create index if not exists gift_deals_needed_idx   on public.gift_deals (needed_by);
create index if not exists gift_deals_customer_idx on public.gift_deals (customer_id);

create table if not exists public.gift_deal_events (
  id          bigserial primary key,
  deal_id     uuid not null references public.gift_deals(id) on delete cascade,
  type        text not null,                                 -- created|stage|payment|delivered|artwork|edited|synced|note
  meta        jsonb not null default '{}',
  actor       text,
  created_at  timestamptz not null default now()
);
create index if not exists gift_deal_events_deal_idx on public.gift_deal_events (deal_id, created_at desc);

alter table public.gift_deals       enable row level security;
alter table public.gift_deal_events enable row level security;
drop policy if exists gift_deals_admin on public.gift_deals;
create policy gift_deals_admin on public.gift_deals
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
drop policy if exists gift_deal_events_admin on public.gift_deal_events;
create policy gift_deal_events_admin on public.gift_deal_events
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

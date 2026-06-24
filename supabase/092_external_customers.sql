-- ============================================================
-- 092_external_customers.sql
-- Salinan BACA pembeli channel luar (TikTok dll) yang di-sync dari ops app (Neon).
-- One-way: ops = sumber kebenaran; Supabase simpan agregat per phone+channel
-- supaya CRM (indikator "Pembelian", segment) nampak pembelian cross-channel.
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================

create table if not exists public.external_customers (
  id            uuid primary key default uuid_generate_v4(),
  phone         text not null,                  -- 60-prefix (normalized oleh ops)
  channel       text not null default 'tiktok', -- tiktok | shopee | ... (masa depan)
  name          text,
  order_count   integer not null default 0,
  total_spend   numeric not null default 0,
  last_order_at timestamptz,
  synced_at     timestamptz not null default now(),
  unique (phone, channel)
);
create index if not exists idx_external_customers_phone on public.external_customers(phone);

-- Bulk upsert (per channel) — dipanggil endpoint sync.
create or replace function public.upsert_external_customers(p_rows jsonb, p_channel text)
returns integer language plpgsql as $$
declare v_count integer := 0;
begin
  insert into public.external_customers (phone, channel, name, order_count, total_spend, last_order_at, synced_at)
  select
    r->>'phone', coalesce(nullif(p_channel,''), 'tiktok'),
    nullif(r->>'name', ''),
    coalesce((r->>'order_count')::int, 0),
    coalesce((r->>'total_spend')::numeric, 0),
    nullif(r->>'last_order_at', '')::timestamptz,
    now()
  from jsonb_array_elements(p_rows) as r
  where coalesce(r->>'phone', '') <> ''
  on conflict (phone, channel) do update
    set name = excluded.name, order_count = excluded.order_count,
        total_spend = excluded.total_spend, last_order_at = excluded.last_order_at,
        synced_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

alter table public.external_customers enable row level security;
drop policy if exists external_customers_admin on public.external_customers;
create policy external_customers_admin on public.external_customers
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

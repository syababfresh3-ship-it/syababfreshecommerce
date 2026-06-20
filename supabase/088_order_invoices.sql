-- ============================================================
-- 088_order_invoices.sql
-- Invois untuk order customer biasa (table `orders`).
-- Guna semula reka bentuk invois reseller, tapi simpan no. invois
-- stabil per order (download semula = no. sama).
-- Nombor invois kongsi siri INV-YYYYMMDD-#### dengan reseller_invoices
-- (kira max gabungan dua-dua table → tiada pertembungan).
-- ADDITIVE. Idempotent.
-- ============================================================

create table if not exists public.order_invoices (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null unique references public.orders(id) on delete cascade,
  invoice_number text not null unique,
  total          numeric not null default 0,
  status         text not null default 'issued',  -- issued | paid
  issued_at      timestamptz not null default now(),
  paid_at        timestamptz
);

-- Nombor invois: gabungan reseller_invoices + order_invoices supaya siri INV-
-- tunggal & tiada pertembungan (accounting bersih).
create or replace function public.generate_order_invoice_number()
returns text language plpgsql as $$
declare
  v_date text := to_char(now(), 'YYYYMMDD');
  v_seq  integer;
begin
  select coalesce(max(seq), 0) + 1 into v_seq from (
    select (regexp_match(invoice_number, 'INV-\d{8}-(\d+)'))[1]::integer as seq
      from public.reseller_invoices where invoice_number like 'INV-' || v_date || '-%'
    union all
    select (regexp_match(invoice_number, 'INV-\d{8}-(\d+)'))[1]::integer as seq
      from public.order_invoices    where invoice_number like 'INV-' || v_date || '-%'
  ) s;
  return 'INV-' || v_date || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- LP order bukan-reseller pun boleh ada invois → reseller_id jadi nullable.
alter table public.reseller_invoices alter column reseller_id drop not null;

-- Selaraskan generate_invoice_number (dipakai route reseller/LP) supaya kira
-- gabungan dua-dua table juga → siri INV- global unik merentas semua sumber.
create or replace function public.generate_invoice_number()
returns text language plpgsql as $$
declare
  v_date text := to_char(now(), 'YYYYMMDD');
  v_seq  integer;
begin
  select coalesce(max(seq), 0) + 1 into v_seq from (
    select (regexp_match(invoice_number, 'INV-\d{8}-(\d+)'))[1]::integer as seq
      from public.reseller_invoices where invoice_number like 'INV-' || v_date || '-%'
    union all
    select (regexp_match(invoice_number, 'INV-\d{8}-(\d+)'))[1]::integer as seq
      from public.order_invoices    where invoice_number like 'INV-' || v_date || '-%'
  ) s;
  return 'INV-' || v_date || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

alter table public.order_invoices enable row level security;
-- Admin sahaja (route guna service role admin client; polisi ini untuk RLS am).
drop policy if exists order_invoices_admin ON public.order_invoices;
create policy order_invoices_admin on public.order_invoices
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ============================================================
-- 056_refund_replacement_shipment.sql
-- Integrasi ganti-produk dengan modul shipping sebenar.
-- Replacement = order_shipments row KEDUA untuk order yang sama,
-- dikaitkan dengan refund (refund_id). Shipment asal kekal satu sahaja.
-- ============================================================

alter table public.order_shipments
  add column if not exists refund_id uuid references public.refunds(id) on delete set null;

-- Longgarkan unique: hanya SATU shipment 'primary' (bukan-ganti) per order.
-- Replacement (refund_id is not null) tak terikat index ni → boleh wujud serentak.
drop index if exists order_shipments_order_id_key;
create unique index if not exists order_shipments_primary_key
  on public.order_shipments(order_id) where refund_id is null;

-- Satu replacement shipment per refund.
create unique index if not exists order_shipments_refund_key
  on public.order_shipments(refund_id) where refund_id is not null;

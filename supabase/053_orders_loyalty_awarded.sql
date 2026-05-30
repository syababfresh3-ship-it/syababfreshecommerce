-- ============================================================
-- 053_orders_loyalty_awarded.sql
-- Flag idempotency untuk loyalty order biasa (sama corak macam
-- lp_guest_orders.loyalty_awarded). awardOrderLoyalty() claim flag ni
-- secara atomik (false → true) supaya points diberi paling banyak SEKALI,
-- walau ada double-click / trigger 'delivered' serentak (admin / shipping).
-- ============================================================

alter table public.orders
  add column if not exists loyalty_awarded boolean not null default false;

-- Backfill: order yang sudah ada transaksi 'earn' dikira sudah diberi points,
-- supaya tidak diberi lagi bila flag baru diperkenalkan.
update public.orders o
set loyalty_awarded = true
where loyalty_awarded = false
  and exists (
    select 1 from public.loyalty_transactions t
    where t.order_id = o.id and t.type = 'earn'
  );

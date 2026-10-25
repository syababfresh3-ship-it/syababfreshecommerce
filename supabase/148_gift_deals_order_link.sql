-- ============================================================
-- 148_gift_deals_order_link.sql
-- Pipeline Gift: pautan deal ↔ gift_orders (tempahan web Studio yang bayar deposit online
-- melalui CHIP) supaya deal lahir automatik bila deposit masuk, dan sebut harga yang
-- dibuat dari enquiry yang sama tidak mencipta deal pendua. ADDITIVE. Idempotent.
-- ============================================================
alter table public.gift_deals add column if not exists gift_order_id uuid unique references public.gift_orders(id) on delete set null;
create index if not exists gift_deals_gift_order_idx on public.gift_deals (gift_order_id);
comment on column public.gift_deals.gift_order_id is 'Tempahan web (gift_orders) yang melahirkan / berpaut pada deal ini.';

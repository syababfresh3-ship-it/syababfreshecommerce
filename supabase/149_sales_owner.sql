-- ============================================================
-- 149_sales_owner.sql
-- Pemilik (sales) untuk deal gift & klien: "klien ini dari sales siapa".
-- gift_deals.owner_id lalai = admin yang keluarkan sebut harga; boleh ditukar di panel deal.
-- customers.owner_id = sales yang pertama bawa klien (ditetapkan sekali, tidak ditimpa).
-- ADDITIVE. Idempotent.
-- ============================================================
alter table public.gift_deals add column if not exists owner_id uuid references public.profiles(id) on delete set null;
create index if not exists gift_deals_owner_idx on public.gift_deals (owner_id, stage);
comment on column public.gift_deals.owner_id is 'Sales/admin yang memiliki deal ini (lalai: pengeluar sebut harga).';

alter table public.customers add column if not exists owner_id uuid references public.profiles(id) on delete set null;
create index if not exists customers_owner_idx on public.customers (owner_id);
comment on column public.customers.owner_id is 'Sales yang membawa klien ini (ditetapkan bila klien pertama kali disimpan dari sebut harga/invois).';

-- 171: Saluran jualan POS — tiket "Borong" (pemilik 25 Nov 2026): kasyer tandakan Borong pada pelanggan tiket
-- (auto bila pelanggan CRM ditanda Borong) → POS guna senarai harga borong (tetapan POS wholesalePriceListId)
-- dan jualan ditanda channel = 'wholesale' + price_list_id yang dipakai. Laporan tapis ikut saluran, bukan register.
-- Idempoten, additive. Tanpa migration ini jualan tetap sah (penanda saluran dilangkau dengan log).
alter table public.pos_sales
  add column if not exists channel        text not null default 'retail',
  add column if not exists price_list_id  uuid references public.pos_price_lists(id) on delete set null;
alter table public.pos_sales drop constraint if exists pos_sales_channel_check;
alter table public.pos_sales add constraint pos_sales_channel_check check (channel in ('retail','wholesale'));
create index if not exists pos_sales_channel_idx on public.pos_sales(channel) where channel <> 'retail';

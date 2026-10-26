-- ============================================================
-- 150_gift_deals_packer.sql
-- PIC Pack untuk deal gift: siapa ditugaskan siapkan pek (cetak/isi/bungkus) untuk projek itu.
-- Berasingan daripada owner_id (sales pemilik deal, migration 149).
-- gift_deals.packer_id        = admin/staf yang ditugaskan pack (ditetapkan di panel deal).
-- gift_deals.packer_assigned_at = bila tugasan diberi (push dihantar kepada PIC).
-- gift_deals.packed_at        = pek siap (sedia hantar).
-- gift_deals.pack_notes       = arahan pek untuk PIC (isi, kuantiti, finishing, label).
-- ADDITIVE. Idempotent.
-- ============================================================
alter table public.gift_deals add column if not exists packer_id uuid references public.profiles(id) on delete set null;
alter table public.gift_deals add column if not exists packer_assigned_at timestamptz;
alter table public.gift_deals add column if not exists packed_at timestamptz;
alter table public.gift_deals add column if not exists pack_notes text;
create index if not exists gift_deals_packer_idx on public.gift_deals (packer_id, stage);
comment on column public.gift_deals.packer_id is 'PIC pack: staf yang ditugaskan siapkan pek untuk deal ini.';
comment on column public.gift_deals.packer_assigned_at is 'Bila PIC pack ditetapkan/ditukar.';
comment on column public.gift_deals.packed_at is 'Pek siap (sedia hantar).';
comment on column public.gift_deals.pack_notes is 'Arahan pek untuk PIC (isi, kuantiti, finishing, label).';

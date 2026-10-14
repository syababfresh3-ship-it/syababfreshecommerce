-- ============================================================
-- 143_gift_studio_hot_leads.sql — Studio hot-lead (/kurma/studio) + kos & margin (14 Okt 2026)
--
-- MASALAH: (1) Enquiry dari calculator sheet 2026 tak boleh disimpan — api/kurma/order
-- wajib box_id katalog & kira semula dari katalog placeholder. (2) Template design
-- (gift_designs) tiada metadata kedudukan logo untuk preview 2D "letak logo anda".
-- (3) Admin sebut harga tanpa nampak kos — margin diagak.
--
-- PENYELESAIAN: gift_designs.logo_area (kawasan logo, pecahan 0..1 dari imej) untuk
-- preview 2D; gift_orders tambah lajur harga senarai / kos / margin yang admin simpan
-- semasa quote (snapshot — sheet boleh berubah kemudian tanpa tulis semula sejarah).
-- Pilihan sheet (kurma_id, weight, template_id, logo_url, mockup_url) kekal dalam
-- config jsonb {source:'sheet', ...} — tiada lajur baharu untuk itu. Kos dikonfigur di
-- app_settings.gift_cost_config (JSON) — tiada jadual baharu, tiada seed angka.
--
-- RLS tak diubah: gift_designs public read (is_active) kini turut dedah logo_area —
-- memang perlu untuk preview awam; gift_orders kekal service-role sahaja.
-- Additive. Idempotent — selamat dijalankan semula.
-- ============================================================

alter table public.gift_designs
  add column if not exists logo_area jsonb;

comment on column public.gift_designs.logo_area is
  'Kawasan logo pada imej template: {"x","y","w","h"} pecahan 0..1 dari lebar/tinggi imej. NULL = default (segi empat tengah 40%×30%, lihat lib/gift-mockup.ts).';

alter table public.gift_orders add column if not exists list_unit_price numeric(10,2);
alter table public.gift_orders add column if not exists cost_unit       numeric(10,2);
alter table public.gift_orders add column if not exists cost_breakdown  jsonb;
alter table public.gift_orders add column if not exists margin_pct      numeric(6,2);

comment on column public.gift_orders.list_unit_price is
  'Harga senarai (sheet 2026) per kotak semasa enquiry/quote — rujukan, bukan harga akhir (unit_price/total).';
comment on column public.gift_orders.cost_unit is
  'Kos per kotak (kotak + kurma + packing + delivery) semasa admin quote. NULL = kos belum diisi di /admin/kurma/costs.';
comment on column public.gift_orders.cost_breakdown is
  'Snapshot {"box","kurma","packing","delivery","total"} RM per kotak semasa quote.';
comment on column public.gift_orders.margin_pct is
  'Margin % pada harga akhir yang admin set: (unit_price - cost_unit) / unit_price * 100.';

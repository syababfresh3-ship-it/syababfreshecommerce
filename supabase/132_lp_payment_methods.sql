-- ============================================================
-- 132_lp_payment_methods.sql
-- Kaedah bayaran ikut landing page + pintu kelulusan COD untuk order LP.
--
-- MASALAH: `payment_methods.is_active` bersifat SEJAGAT. Bila admin minta buka
-- COD untuk SATU landing page sahaja, toggle itu membukanya untuk semua tempat.
-- Lebih teruk: pelayan tidak pernah menyemak `is_active` langsung — borang LP
-- menyembunyikan pilihan yang dimatikan, tetapi POST terus dengan
-- payment_method:'cod' tetap diterima. Suis admin hanya berkesan pada paparan.
--
-- landing_pages.payment_methods — senarai khas untuk satu LP.
--   null / array kosong = ikut tetapan sejagat (kelakuan sedia ada, tiada beza).
--   ada isi             = TEPAT senarai ini, mengatasi `is_active`.
-- Pelayan kini sahkan pilihan pembeli terhadap senarai ini (lihat lib/lp-payment.ts),
-- jadi POST terus tidak lagi boleh memilih kaedah yang tidak dibenarkan.
--
-- lp_guest_orders.needs_approval — COD dari LP masuk sebagai MENUNGGU KELULUSAN.
-- Stok tidak ditolak, mata tidak ditebus, kiraan promo tidak naik dan e-mel
-- pengesahan tidak dihantar sehingga admin tekan Lulus. Sama seperti pintu yang
-- sudah wujud untuk order pertama ahli storefront (orders.needs_approval), cuma
-- kini meliputi LP — di mana SEMUA 104 order COD sebenar berlaku.
-- Sebab: kadar batal COD 10% berbanding 3.6% bagi bayaran dahulu (90 hari).
--
-- ADDITIVE + IDEMPOTENT. Tiada view. Kod toleran kalau belum dijalankan
-- (42703 / PGRST204 → jatuh balik ke kelakuan lama).
-- ============================================================

alter table public.landing_pages
  add column if not exists payment_methods text[];

comment on column public.landing_pages.payment_methods is
  'Senarai id kaedah bayaran khas untuk LP ini (rujuk payment_methods.id). null/kosong = ikut payment_methods.is_active sejagat. Ada isi = tepat senarai ini, mengatasi is_active.';

alter table public.lp_guest_orders
  add column if not exists needs_approval boolean not null default false,
  add column if not exists approved_at    timestamptz,
  add column if not exists approved_by    uuid references public.profiles(id) on delete set null;

comment on column public.lp_guest_orders.needs_approval is
  'true = menunggu kelulusan admin (COD dari LP). Stok/mata/promo/e-mel ditangguh sehingga diluluskan.';
comment on column public.lp_guest_orders.approved_at is 'Bila admin meluluskan order COD ini.';
comment on column public.lp_guest_orders.approved_by is 'Admin yang meluluskan.';

-- Senarai "menunggu kelulusan" di admin — kecil dan kerap dibaca.
create index if not exists idx_lp_guest_orders_needs_approval
  on public.lp_guest_orders (created_at desc)
  where needs_approval = true;

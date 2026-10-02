-- ============================================================
-- 140_variant_soft_delete.sql — Soft-delete variasi produk (2 Okt 2026)
--
-- MASALAH: butang padam variasi buat HARD delete (product_variants.delete()).
-- Tapi lajur lp_guest_orders.variant_id (042) ada FK TANPA `on delete` → default
-- NO ACTION → Postgres halang padam mana-mana variasi yang pernah dibeli lewat
-- channel guest/LP/kedai/TikTok (2,292 order rujuk variant_id). Hasilnya staf
-- "tak boleh delete variation kalau dah save" — ralat 23503 → UI "Delete failed".
--
-- PENYELESAIAN: soft-delete. Tambah `deleted_at`. Route DELETE cuba hard-delete
-- dulu (variasi belum ada order → betul-betul dibuang); jika FK halang (ada order)
-- → set deleted_at + is_active=false (disorok, sejarah order & P&L kekal utuh).
-- Senarai admin + penjana kombinasi tapis `deleted_at is null`. Storefront sedia
-- ada tapis is_active jadi variasi terus hilang dari paparan customer.
--
-- Additive. Idempotent — selamat dijalankan semula.
-- ============================================================

alter table public.product_variants
  add column if not exists deleted_at timestamptz;

-- Senarai admin & penjana kombinasi selalu tapis deleted_at is null — indeks separa
-- supaya query "variasi hidup bagi produk ni" kekal pantas.
create index if not exists idx_product_variants_live
  on public.product_variants (product_id)
  where deleted_at is null;

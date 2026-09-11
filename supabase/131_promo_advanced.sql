-- ============================================================
-- 131_promo_advanced.sql
-- Sprint 3H "promo lanjutan".
--   • Tetingkap masa promo (starts_at) + jadual banner (starts_at/ends_at)
--   • Jenis baru 'free_shipping' (hantar percuma)
--   • Skop promo: hanya produk / kategori tertentu
--   • Had guna per pelanggan (per_user_limit)
-- ADDITIVE + IDEMPOTENT. Tiada view. Run di Supabase SQL Editor.
-- Kod aplikasi TOLERAN: kalau migration ini belum dijalankan, checkout &
-- storefront tetap jalan seperti biasa (kolum baru dianggap null).
-- ============================================================

-- ── promo_codes ─────────────────────────────────────────────
alter table public.promo_codes
  add column if not exists starts_at          timestamptz,
  add column if not exists scope_product_ids  uuid[],
  add column if not exists scope_category_ids uuid[],
  add column if not exists per_user_limit     int;

comment on column public.promo_codes.starts_at is
  'Bila kod mula sah. null = sah serta-merta. Sebelum masa ini checkout tolak dengan "Kod belum bermula".';
comment on column public.promo_codes.scope_product_ids is
  'Skop produk: hanya produk dalam senarai ini layak dapat diskaun. null/kosong = semua produk. Diskaun dikira atas jumlah baris yang layak sahaja (min_order tetap ikut subtotal penuh).';
comment on column public.promo_codes.scope_category_ids is
  'Skop kategori: produk dalam kategori ini layak. Digabung secara OR dengan scope_product_ids. null/kosong = semua kategori.';
comment on column public.promo_codes.per_user_limit is
  'Had guna per pelanggan (member ikut user_id, guest ikut no. telefon). null = kelakuan lama: member sekali seorang, guest tiada had.';

-- Jenis 'free_shipping': CHECK asal dicipta inline (004) jadi namanya
-- promo_codes_type_check. Guna loop supaya sebarang nama constraint lama
-- (yang menyebut 'percentage') digugurkan dulu — idempotent bila diulang.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class     rel on rel.oid = con.conrelid
      join pg_namespace ns  on ns.oid  = rel.relnamespace
     where ns.nspname = 'public'
       and rel.relname = 'promo_codes'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%percentage%'
  loop
    execute format('alter table public.promo_codes drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.promo_codes
  add constraint promo_codes_type_check
  check (type in ('percentage', 'fixed', 'free_shipping'));

comment on column public.promo_codes.type is
  'percentage = % diskaun · fixed = potongan RM · free_shipping = hantar percuma (diskaun = kos penghantaran; RM0 bila pickup atau memang percuma).';

-- ── banners: jadual paparan ─────────────────────────────────
alter table public.banners
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz;

comment on column public.banners.starts_at is
  'Banner mula dipaparkan di home. null = terus papar (tertakluk is_active).';
comment on column public.banners.ends_at is
  'Banner berhenti dipaparkan di home. null = tiada tarikh tamat.';

-- Home hanya baca banner aktif dalam tetingkap masa — index ringan untuk itu.
create index if not exists idx_banners_window
  on public.banners (is_active, sort_order)
  where is_active = true;

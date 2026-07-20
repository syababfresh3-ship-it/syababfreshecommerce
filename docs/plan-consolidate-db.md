# Pelan: Satukan pangkalan data (Neon → Supabase) + katalog dua-channel

**Status:** DIRANGKA 2026-07-20 — belum dibina. Perlu keputusan user sebelum Fasa A.

## Masalah

Dua sistem, dua pangkalan data, dua bil:

| | syababfresh (storefront) | syababfresh-app (ops) |
|---|---|---|
| DB | Supabase Postgres (plan Micro) | Neon Postgres |
| Akses DB | `@supabase/supabase-js` + RLS | Prisma 7.7 + `@prisma/adapter-pg` |
| Auth | Supabase Auth | JWT `jose` + bcrypt sendiri (`lib/auth.ts`) |
| Saiz | 96 page, 154 route API, ~63k LOC | 38 page, 98 route API, ~35k LOC |
| Fokus | Jualan website | Operasi + order TikTok |

Kesan harian: produk baru kena masuk **dua kali** (Supabase `products` + ops
`app/pricing/products.json` / Google Sheet "Buah Tiktok"), dan tiada satu skrin pun
yang boleh banding margin website vs TikTok.

## Keputusan reka bentuk

**1. JANGAN gabung repo.** Ops app bukan app kecil — ia ada booking AWB sebenar tiga
courier (~37 env var), parser Excel TikTok empat aliran (logik diport dari n8n), jana
slip AWB, SLA Poslaju, rotasi nombor WA Murpati, agihan worker Harumanis, invois
supplier. Gabung bermakna tulis semula 98 route Prisma→Supabase **dan** tulis semula
auth. Risiko tertinggi jatuh pada kod yang tempah parcel sebenar. Ganjaran (satu deploy)
tak setimpal.

**2. Gabung DB sahaja.** Supabase ialah Postgres biasa — Prisma boleh sambung terus
via `DATABASE_URL`. Skema Prisma kekal, 98 route kekal, auth kekal. Yang berubah hanya
host + tempat data duduk.

**3. Jadual ops masuk schema `ops`, bukan `public`.** Elak pertembungan nama dan buat
sempadan jelas. `ops."Order"` (order TikTok) hidup bersebelahan `public.orders` (order
website) — dua populasi berbeza, memang patut berasingan.

**4. Kos buah dikongsi, selebihnya per-channel.** Lihat Fasa B.

## Fakta sedia ada (disahkan)

**Ops app — DB:**
- Prisma 7.7.0, `prisma/schema.prisma` (591 baris), 29 model + 6 enum.
- **TIADA folder migration** — skema di-`db push`, bukan bermigrasi. Pemindahan mesti
  guna `pg_dump`/restore, bukan replay migration.
- **TIADA raw SQL** (`$queryRaw`/`$executeRaw` = 0 hasil) — semua melalui Prisma Client.
  Ini bagus: tiada SQL yang terikat pada kuirk Neon.
- **TIADA `@neondatabase/serverless`** — sambung guna `pg` biasa. Tiada kebergantungan
  driver khusus Neon.
- Prisma Client dijana ke `app/generated/prisma` (di-commit).

**Katalog produk (dua tempat, set berbeza — disahkan user):**
- Storefront: `public.products` (291), `product_variants`, `variant_costs`
  (`kos_buah`, `kos_packaging`, `kos_kurier`, `kos_lain`).
- Ops: `app/pricing/products.json` (144KB statik) + sumber LIVE Google Sheet via
  `lib/pricingSource.ts` (Apps Script, cache 10 min, fallback ke JSON). Medan:
  `cogsDirect`, `retailPrice`, `shippingCustomer`, `shippingSeller`, `kotakCost`,
  `bekasCost`, `stickerCost`, `freegiftCost`, `wastageRM`, `overhead`, `marketing`.
- **Tiada jadual produk dalam DB ops.** `OrderItem.productName` teks bebas, bukan FK.

**Model fee (berbeza, memang patut berbeza):**
- Website — `src/lib/pricing/costing.ts`: FPX/eWallet % + fixed RM, sales team %,
  marketing %. Fee TikTok sengaja TIDAK dimodel di sini (komen `costing.ts:1-3`).
- TikTok — `syababfresh-app/app/pricing/page.tsx`: transaction 3.78%, BXP 4.86%,
  affiliate 10%, toggle channel `"oc" | "aff"`.

**Jambatan sedia ada antara dua sistem** (kekal, tak disentuh pelan ini):
- Ops → storefront: `lib/syncStorefront.ts` (`sync-delivered`, `sync-shipped`),
  webhook Lalamove/Poslaju/Ninja.
- Storefront → ops: `src/lib/external-sync.ts` (`GET {OPS}/api/sync`, header
  `x-sync-secret`) → `external_customers`; eksport Excel format TikTok
  (`src/app/api/admin/orders-export/route.ts`).
- Env dikongsi: `SYNC_SECRET`, `STOREFRONT_BASE_URL`, `OPS_APP_URL`,
  `LALAMOVE_WEBHOOK_SECRET`.

---

## Fasa A — Neon → Supabase (kod ops tak berubah)

**Matlamat:** satu pangkalan data, bil Neon mati, dua sistem boleh `JOIN`.

1. **Semak pertembungan nama.** Senarai model Prisma yang berisiko jika masuk `public`:
   `Order`, `OrderItem`, `User`, `Setting`, `Refund`, `DeliveryZone`, `WaOutbox`,
   `DeliveryBatch`, `OrderDispatch`. Prisma guna nama model sebagai nama jadual
   (case-sensitive: `"Order"` ≠ `orders`), jadi secara teknikal tak bertembung — tapi
   **tetap letak dalam schema `ops`** supaya jelas dan selamat.

2. **Aktifkan multi-schema dalam Prisma.**
   - `datasource db { schemas = ["ops"] }`
   - Tambah `@@schema("ops")` pada semua 29 model + 6 enum.
   - `DATABASE_URL` Supabase perlu `?schema=ops`.

3. **Cipta schema + push.**
   ```sql
   create schema if not exists ops;
   ```
   Kemudian `prisma db push` ke Supabase (guna **direct connection** port 5432, bukan
   pooler — DDL tak boleh melalui pgBouncer).

4. **Pindah data.**
   ```bash
   pg_dump "$NEON_URL" --data-only --schema=public > ops-data.sql
   # ubah suai search_path → ops, kemudian:
   psql "$SUPABASE_DIRECT_URL" -f ops-data.sql
   ```
   Sahkan kiraan baris setiap jadual sama sebelum tukar.

5. **Tetapkan pooler untuk runtime.** Vercel serverless mesti guna pooler Supabase
   (port 6543) dengan:
   ```
   DATABASE_URL="postgresql://...:6543/postgres?schema=ops&pgbouncer=true&connection_limit=1"
   DIRECT_URL="postgresql://...:5432/postgres?schema=ops"
   ```
   Prisma perlu `directUrl` dalam `datasource` untuk DDL. **Tanpa `pgbouncer=true`
   akan ada ralat prepared statement rawak masa runtime** — ini perangkap utama.

6. **RLS tidak terpakai** pada schema `ops` — ops app sambung sebagai role Postgres
   biasa, bukan melalui PostgREST. Pastikan `anon`/`authenticated` **tiada** grant ke
   schema `ops`:
   ```sql
   revoke all on schema ops from anon, authenticated;
   ```

7. **Tukar `DATABASE_URL` di Vercel** (ops project) → deploy → pantau.

8. **Biarkan Neon hidup 2 minggu** sebagai rollback sebelum dimatikan.

### Risiko Fasa A
- **Beban IO Supabase.** Plan Micro pernah ketat (poll sidebar dulu makan 52% masa DB —
  lihat memory `project_supabase_io_budget`). Tambah beban ops kemungkinan besar perlu
  naik ke **Small**. Realitinya: tukar kos Neon dengan naik taraf Supabase, bukan jimat
  penuh. Yang dibeli ialah satu sumber kebenaran.
- **Blast radius jadi satu.** Sekarang Supabase tumbang ≠ ops mati. Lepas ini, satu DB
  tumbang = dua-dua mati. Ini hujah sah untuk kekal berasingan — keputusan user.
- **Tiada migration history** — pemindahan sekali sahaja, kena betul. Uji dulu ke
  Supabase branch/projek sandbox.

### Rollback Fasa A
Tukar balik `DATABASE_URL` ke Neon di Vercel → redeploy. Data Neon tak disentuh selagi
belum dimatikan. Tempoh rollback selamat: selagi tiada tulisan baru ke Supabase yang
belum ada di Neon (iaitu, rollback bersih hanya dalam beberapa jam pertama).

---

## Fasa B — Katalog dua-channel

**Prasyarat:** Fasa A siap.

**Realiti yang disahkan user:** set produk TikTok dan website **berbeza**, pengiraan
berbeza, harga berbeza, kos berbeza. Jadi ini BUKAN kerja "gabungkan jadi satu senarai".
Matlamatnya: letak dua-dua bawah satu bumbung supaya boleh diurus sekali dan
**dibandingkan**.

### Apa yang dikongsi vs per-channel

| Komponen | Kongsi? | Sebab |
|---|---|---|
| Kos buah (COGS langsung) | **Kongsi** | Buah sama, supplier sama. Harga naik → update sekali |
| Pembungkusan | Per-channel | TikTok: kotak+bekas+sticker+freegift; website lain |
| Kurier ditanggung seller | Per-channel | TikTok banyak free shipping |
| Wastage + overhead | Per-channel | Cara agih berbeza |
| Marketing | Per-channel | TikTok ada affiliate |
| Fee platform | Per-channel (formula) | FPX vs 3.78%+4.86% |
| Harga jual | Per-channel | Fee berbeza → harga berbeza |

### Skema cadangan

Ikut corak `reseller_prices` (`supabase/067_reseller_wholesale.sql`) yang dah wujud
dan berfungsi.

```sql
create table sales_channels (
  code text primary key,           -- 'website' | 'tiktok'
  name text not null,
  is_active boolean not null default true
);

create table product_channel_listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  channel text not null references sales_channels(code),

  external_sku text,               -- SKU/listing id TikTok
  is_listed boolean not null default true,
  price numeric(10,2),

  -- kos khusus channel (kos_buah TIDAK di sini — ia dikongsi di variant_costs)
  kos_packaging numeric(10,2) not null default 0,
  kos_kurier    numeric(10,2) not null default 0,
  kos_lain      numeric(10,2) not null default 0,
  kos_marketing numeric(10,2) not null default 0,

  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- partial unique index (variant_id boleh null) — ikut corak variant_costs
create unique index on product_channel_listings (product_id, channel)
  where variant_id is null;
create unique index on product_channel_listings (product_id, variant_id, channel)
  where variant_id is not null;
```

Produk yang wujud di satu channel sahaja = satu baris sahaja. Tiada paksaan padanan.

Fee per-channel disimpan dalam `app_settings` dengan awalan channel:
`fee_website_fpx_pct`, `fee_tiktok_transaction_pct`, `fee_tiktok_bxp_pct`,
`fee_tiktok_affiliate_pct`, dsb.

### Kerja kod
1. `src/lib/pricing/costing.ts` — jadikan `computeUnitEconomics(channel, ...)`. Tambah
   model fee TikTok sebelah model FPX sedia ada. Fungsi lama kekal (additive).
2. `/admin/pricing` — tab **Website | TikTok | Banding**.
3. Skrin **Banding**: produk × (harga, kos, margin) setiap channel + lajur beza. Hanya
   papar produk yang ada listing di kedua-dua channel.
4. Ops `lib/pricingSource.ts` — tukar sumber dari Google Sheet/`products.json` ke DB.
   Kekalkan fallback sedia ada sepanjang tempoh peralihan.

### Kerja manual (user, bukan kod)
Padankan SKU TikTok dengan `products.id` untuk produk yang wujud di kedua-dua channel.
Perlu satu skrin admin "SKU TikTok belum dipadan" untuk permudahkan. Produk yang memang
TikTok-sahaja atau website-sahaja tak perlu dipadan.

---

## Fasa C — Gabung repo

**Jangan buat sekarang.** Nilai semula bila:
- Ops app berhenti berkembang, DAN
- Kos menyelenggara dua repo melebihi kos migrasi 98 route + auth

---

## Apa yang TIDAK disentuh

- Semua 98 route API ops app (kod tak berubah dalam Fasa A)
- Auth ops app (JWT `jose` + bcrypt) — kekal
- Auth storefront (Supabase Auth + RLS) — kekal
- Jambatan sedia ada (`sync-delivered`, `sync-shipped`, `/api/sync`, eksport Excel)
- Semua aliran booking courier (Poslaju/Ninja/Lalamove)
- Parser Excel TikTok
- `public.*` storefront — Fasa A hanya tambah schema `ops` baru

# Pelan: POS SyababFresh — pos.syababfresh.my (kaunter kedai + bazar)

Status: **DILULUSKAN pemilik 8 Nov 2026 — Fasa 1 (MVP kaunter) sedang dibina.** Pelan asal dirangka dalam sesi 8 Nov; kemas kini status di hujung fail.

## Konteks

Pemilik mahu satu subdomain `pos.syababfresh.my` untuk sistem Point-of-Sale yang guna produk dari kedai (products/product_variants di Supabase yang sama), UI minimalis yang semua staf boleh guna, dan fungsi POS biasa. Jawapan pemilik 8 Nov 2026:

- Peranti: **tablet Android (Chrome)** sebagai kaunter utama **+ telefon staf** (boleh iPhone).
- Lokasi: **kedai tetap Bangi DAN bazar Ramadan/event** → perlu laju (2–3 ketuk siap) dan **mod offline**.
- Bayaran: **tunai (kira baki)**, **DuitNow QR statik (sahkan manual)**, **terminal kad/e-wallet (rekod sahaja)**, **pautan bayar CHIP ke WhatsApp** (auto sah via webhook sedia ada).
- Buah: **ada jualan ikut berat** (masuk kg manual dari penimbang berasingan; integrasi penimbang ditangguh).

Apa yang ada sekarang (audit kod 8 Nov):

- **Tiada POS langsung.** Paling dekat `/admin/quick-order` (`src/app/admin/quick-order/page.tsx`, `src/app/api/admin/quick-order/route.ts`): borang order penghantaran staf → `lp_guest_orders` status `confirmed`; **wajib email, sentiasa hantar email, tak tolak stok**. Bukan till.
- Routing subdomain ada corak: `src/proxy.ts` (`kurmaHostRouting`) + `src/lib/kurma-host.ts`. Cabang kurma **tak jalankan auth**; POS mesti ada auth.
- Auth hanya `profiles.is_admin` (`src/lib/supabase/require-admin.ts`). Tiada peranan, tiada PIN. Polisi `profiles: user can update own` (`supabase/003_rls.sql:66-71`) hanya kunci `is_admin` — kolum baharu pada `profiles` boleh diubah sendiri oleh ahli dari pelayar (lubang keselamatan jika guna `pos_access` di situ).
- Stok: `product_variants.stock INTEGER` / `inventory_batches` (integer), RPC `deduct_variant_stock`/`deduct_inventory` **RAISE "Stok tidak mencukupi"** (022/016); helper `deductItems/restoreItems/deductLpOrderStock` di `src/lib/stock.ts`; `restore_stock()` (123) hanya tambah. Stok buah longgar (kg) ada di app ops (Neon, ikut kategori buah), tak berkait dengan produk kedai.
- `orders` wajib `user_id`; `lp_guest_orders` wajib nama/telefon/alamat dan dibaca cron review-request, auto-deliver, eksport penghantaran, view blast CRM. Menulis jualan POS ke situ berisiko ganggu flow sedia ada.
- Resit `/resit/[id]` saiz A4 (HTML + `window.print()`); invois A4 `@react-pdf/renderer`. Tiada resit 58/80mm, tiada penjana QR, tiada kolum barcode produk (`product_variants.sku` teks bebas).
- Pelanggan: `customers` (kunci `phone_norm`), `upsertCustomer()` di `src/lib/customers.ts` (`CustomerSource` belum ada `'pos'`), `normalizePhone` di `src/lib/phone.ts`, carian `/api/admin/customers/search`. Loyalti ahli ikut telefon (`src/lib/lp-loyalty.ts`, RPC `find_profile_by_phone`), Kad Setia (`src/lib/kad-setia.ts`).
- Promo: `evaluatePromo()` fungsi tulen `src/lib/promo-rules.ts`; `countGuestPromoUses` `src/lib/promo-usage.ts`; RPC `increment_promo_uses`.
- CHIP: webhook `src/app/api/webhook/chip/route.ts` — cawangan `gift:` (baris 117–135) ialah contoh rujukan jenis baharu; selepas itu kod generik `orders/lp_guest_orders.update(...).eq('id', reference)` (rujukan bukan uuid akan ralat cast → cawangan POS mesti **sebelum** itu).
- Laporan: `buildDailySummary` (`src/lib/daily-summary.ts`, `ChannelStats`, hasil = `payment_status='paid'`), `/admin/sales-report` kelaskan via `classifyLpSource()`.
- Tetapan: `app_settings` (boleh dibaca umum → jangan simpan rahsia) + corak kunci JSON `src/lib/borong-settings.ts` + `src/app/api/admin/settings/borong/route.ts`.
- UI: Tailwind v4 (token `--color-brand-red-600 #E11D2A` di `globals.css`), Nunito, lucide monokrom, zustand v5 (`src/lib/stores/lp-cart.ts` = templat bentuk item; `cart.ts` tembak pixel, jangan guna), bar bawah `src/components/kurma/shop/shop-cart-bar.tsx`, imbas HID+kamera `src/app/admin/shipping/dispatch/dispatch-client.tsx` (`html5-qrcode`), cetak popup `printAwb` di `exports-client.tsx`, `jsbarcode`.
- Root `src/app/layout.tsx` daftar `public/sw.js` (precache `/` & `/products`), `PixelScripts` (tiada gate), `Clarity` (skip `/admin` sahaja), `PWAInstallBanner`. `next.config.ts` `headers()` set `Permissions-Policy: camera=()` global (sekat kamera; entri kemudian dengan `has: host` boleh timpa).

## Keputusan reka bentuk

1. **Jadual POS tersendiri (`pos_*`)**, bukan tumpang `lp_guest_orders`/`orders`. Additive penuh, kuantiti perpuluhan (kg), bayaran berpecah, kasyer, void, kunci idempoten untuk offline. Laporan admin ditambah saluran "POS" secara eksplisit.
2. **Akses POS via jadual `pos_staff`** (bukan kolum pada `profiles` — lubang RLS di atas). Gate = `is_admin` ATAU `pos_staff` aktif. Peranti login sekali dengan **akaun peranti bukan-admin** (dicipta di `/admin/team` dengan `is_admin:false`, diberi akses di `/admin/pos/cashiers`) → tak boleh capai `/api/admin/*` mahupun baca jadual terus (RLS admin-only pada semua `pos_*`). Semua baca/tulis POS melalui `/api/pos/**` → `requirePos()` → klien service-role.
3. **PIN kasyer** 4–6 digit (`pos_cashiers`: hash scrypt, peranan `cashier|manager`, kiraan gagal + `locked_until`), kuki `pos_cashier` ditandatangan HMAC dengan env `POS_PIN_SECRET` (12 jam). Void / diskaun melebihi had → PIN `manager`. Had cubaan via `rateLimitDb`.
4. **Hos `pos.syababfresh.my` KEKALKAN awalan `/pos`** (tiada rewrite seperti kurma). Sebab: PWA offline perlu URL stabil (skop SW, precache, `start_url`, gate `usePathname()`). `/` dan laluan bukan-POS di hos POS → 308 `/pos/sell`; di hos kedai `/pos/**` → 308 ke hos POS (hanya bila env diset; dev localhost jalan tanpa env). Semua respons POS `X-Robots-Tag: noindex`, robots `Disallow: /`. Pixel/Clarity/SW kedai/banner PWA **dimatikan** bila `pathname.startsWith('/pos')`; POS ada `pos-manifest.json` + `pos-sw.js` sendiri (skop `/pos/`).
5. **Terminal satu laluan**: `/pos/sell` memuat paparan `grid → bayar → berjaya` dalam satu page klien (state machine), tiket dalam zustand `persist`. Elak navigasi RSC semasa offline; sifar peralihan laluan antara ketukan. `/pos/sales`, `/pos/shift`, `/pos/settings` laluan berasingan (kebanyakannya online).
6. **Stok tak pernah halang jualan di kaunter.** RPC baharu `pos_deduct_stock(product_id, variant_id, qty int) returns int` (kekurangan) — clamp ke 0, rekod `stock_short` pada baris, **tidak RAISE**. Baris pek (varian/produk tanpa varian) tolak stok kedai; **baris ikut berat (`unit='kg'`) TIDAK sentuh stok kedai** (direkod `weight_kg_total` untuk laporan). Idempoten via `pos_sales.stock_deducted_at` (corak `deductLpOrderStock`). Pulih stok guna `restore_stock()` sedia ada (hanya tambah).
7. **Harga**: lalai harga runcit kedai; `pos_product_settings` boleh override harga POS (cth harga bazar), tetapkan `sell_by_weight` + `price_per_kg`, barcode (unik), kekunci pantas, sorok. Produk kedai **tidak diubah**. Harga klien adalah muktamad (pelanggan dah bayar); server simpan `catalog_price` dan admin tanda "drift".
8. **Nombor resit `POS-YYYYMMDD-NNNN`** dari `pos_receipt_counters` (upsert atomik, tarikh KL) — tiada perlumbaan dua terminal. **`client_txn_id` unik** → hantar dua kali/replay offline → 200 `{duplicate:true}`. Jualan offline cetak `local_ref` `<kod register>-<yymmdd>-<n>` sehingga disegerak.
9. **Pembundaran tunai 5 sen** (`rounding_adj`) hanya untuk tender tunai; QR/kad/CHIP tepat.
10. **Resit**: HTML 58/80mm (`@page { size: 58mm auto }`) dicetak melalui pelayar (Android Print Service vendor / printer Wi-Fi) sebagai lalai; **e-resit WhatsApp** via pautan `wa.me/<60tel>?text=` dibuka di peranti (sifar risiko ban, tiada tetingkap 24 jam) dengan pautan awam `/pos/resit/<token>` (token rawak, bukan id). Pilihan `murpati` (`sendWhatsApp`) di tetapan. ESC/POS Web Bluetooth = Fasa 2 (Chrome Android sahaja).
11. **Tiada baris cukai** pada resit melainkan `COMPANY.facts.sstRegistered` diisi; TIN & SSM syarikat dari `SELLER` (`src/lib/seller.ts`).
12. Pautan CHIP guna `reference: 'pos:<saleId>'`; cawangan `pos:` dalam webhook diletak **selepas cawangan `gift:` dan sebelum kod generik**; polling 3 saat di POS; fallback manager "tanda dibayar dengan rujukan".

## Peta fungsi POS biasa ikut fasa

| Fungsi | Fasa |
|---|---|
| Grid produk ikut kategori, carian (`searchItems` BM/EN), kekunci pantas "Kegemaran" | 1 |
| Ketuk pek = +1, ubah kuantiti, **masuk berat kg** (keypad 3 perpuluhan, RM langsung) | 1 |
| Diskaun baris & keseluruhan (RM/%), had kasyer, kod promo (`evaluatePromo`) | 1 |
| Pelanggan pilihan ikut telefon (CRM `upsertCustomer` sumber `'pos'`), tanpa pelanggan pun boleh | 1 |
| Tangguh jualan (hold) & sambung semula | 1 |
| Bayar: tunai (tender pantas + baki + bundar 5 sen), DuitNow QR statik, terminal (rekod + ruj), **berpecah 2 tender** | 1 |
| Resit cetak pelayar 58/80mm + e-resit WhatsApp + pautan resit awam | 1 |
| Senarai jualan hari ini, cetak semula, void dengan PIN manager (pulih stok) | 1 |
| Kunci skrin PIN, tukar kasyer | 1 |
| Admin: register, kasyer+PIN, akses peranti, tetapan produk POS (barcode/berat/harga/quick key/sorok), jualan POS (tapis, CSV, drift), tetapan resit & imej QR DuitNow; saluran POS dalam ringkasan harian | 1 |
| Offline: cache katalog (IndexedDB), baris gilir jualan, segerak semula, `local_ref`, PWA pasang, SW skop `/pos/` | 2 |
| Imbas barcode (scanner HID + kamera telefon), `Permissions-Policy camera=(self)` untuk hos POS | 2 |
| Pautan bayar CHIP (WhatsApp + poll) auto sah via webhook; cron reconcile untuk `chip_link` tergantung | 2 |
| Cetak ESC/POS Web Bluetooth (Chrome Android), kick laci tunai; saluran POS dalam `/admin/sales-report` | 2 |
| Shift: buka float, masuk/keluar tunai, tutup kira, varians (laporan X/Z), cetak Z | 3 |
| Loyalti ahli (`find_profile_by_phone` → `increment_points`) & Kad Setia (`addStamp`), idempoten | 3 |
| Refund separa, eksport e-Invois disatukan bulanan (CSV), lajur POS dalam P&L (`variant_costs`) | 3 |

## 1) Data — `supabase/155_pos.sql` (idempotent, additive; sahkan `ls supabase/` dulu — 154 ialah yang terakhir)

Jadual (semua `enable row level security` + satu polisi `for all to authenticated using (public.is_admin()) with check (public.is_admin())`; `pos_staff` tambah `select` baris sendiri untuk gate proxy):

- `pos_registers` — `code` unik (cth `T1`), `name`, `location`, `is_active`. Seed `T1 Kaunter Bangi` jika kosong.
- `pos_staff` — `profile_id` pk → `profiles`, `is_active`, `granted_by`.
- `pos_cashiers` — `name`, `pin_hash`, `role cashier|manager`, `profile_id` nullable, `is_active`, `failed_attempts`, `locked_until`.
- `pos_shifts` — `register_id`, `status open|closed`, `opened_at/by`, `opening_float`, `closed_at/by`, `counted_cash`, `expected_cash`, `variance`, `summary jsonb`, `notes`; indeks unik separa satu shift terbuka per register.
- `pos_cash_movements` — `shift_id`, `type in|out`, `amount`, `reason`, `cashier_id` (UI Fasa 3, jadual sekarang).
- `pos_receipt_counters` — `day date pk`, `last int`.
- `pos_sales` — `receipt_no` unik, `local_ref`, **`client_txn_id uuid unik`**, `register_id`, `shift_id`, `cashier_id`, `created_by` (auth user peranti), `customer_id/phone/name`, `status pending|paid|void`, `subtotal`, `discount_total`, `discount_note`, `promo_code_id/code/discount`, `rounding_adj`, `total`, `paid_total`, `change_given`, `weight_kg_total numeric(10,3)`, `sold_at`, `paid_at`, `offline bool`, `voided_at/by/reason`, `stock_deducted_at`, `stock_restored_at`, `stock_notes`, `loyalty_awarded_at`, `receipt_sent_at`, **`public_token` unik rawak**, `note`, `source 'pos'`. Indeks `sold_at desc`, `shift_id`, `customer_phone`.
- `pos_sale_items` — `sale_id`, `sort`, `product_id/variant_id` (on delete set null; nama disnapshot), `name`, `variant_name`, `sku`, `barcode`, `sell_by_weight`, **`qty numeric(10,3)`**, `unit pcs|kg`, `unit_price`, `catalog_price`, `line_discount`, `line_total`, `stock_deducted`, `stock_short`.
- `pos_payments` — `sale_id`, `method cash|duitnow_qr|card_terminal|ewallet_terminal|chip_link`, `amount`, `tendered`, `change_given`, `ref`, `status pending|paid|failed|cancelled`, `chip_purchase_id`, `checkout_url`, `paid_at`.
- `pos_product_settings` — `product_id`, `variant_id` nullable, `pos_name`, `sell_by_weight`, `price_per_kg`, `pos_price`, `barcode` (indeks unik separa), `is_quick_key`, `quick_key_order`, `is_hidden`; indeks unik `(product_id, coalesce(variant_id, uuid sifar))`.

Fungsi (semua `revoke execute from public, anon, authenticated; grant to service_role` — gelung sama seperti `122_security_sprint1.sql`):

- `pos_next_receipt_no()` → tarikh KL, `insert … on conflict (day) do update set last = last+1 returning last` → `POS-YYYYMMDD-NNNN`.
- `pos_create_sale(p jsonb)` → security definer; jika `client_txn_id` wujud → `{id, receipt_no, duplicate:true}`; jika tidak → nombor resit + insert sale/items/payments secara atomik.
- `pos_deduct_stock(p_product_id, p_variant_id, p_qty int) returns int` → clamp ke 0 (varian: `product_variants.stock`; tanpa varian: FIFO `inventory_batches`), pulangkan kekurangan.
- View `pos_payment_totals_v` (sale_id, method, jumlah paid) + **`alter view public.pos_payment_totals_v set (security_invoker = on)`**.

Tetapan di `app_settings` kunci `pos_settings` (JSON, tiada rahsia): `receipt_header`, `receipt_footer`, `duitnow_qr_url` (data URL ≤200KB), `paper_width 58|80`, `default_float`, `cashier_max_discount_pct`, `wa_receipt_mode 'link'|'murpati'`.

Tiada perubahan pada `profiles`, `products`, `product_variants`, `orders`, `lp_guest_orders`. Kod mesti toleran jika migration belum dijalankan (`42P01`/`PGRST202` → ciri disorok, bukan crash).

## 2) Lib — `src/lib/pos/`

`host.ts` (`POS_HOST`, `isPosPath`) · `require-pos.ts` (`requirePos(): {supabase, user, isAdmin, cashier|null, forbidden}`) · `pin.ts` (`hashPin`, `verifyPin` scrypt + `timingSafeEqual`, `signCashier`/`readCashier` HMAC-SHA256 `POS_PIN_SECRET`, wajib ada env) · `settings.ts` (`POS_SETTINGS_KEY`, `parsePosSettings`, `normalizePosSettings` — corak `borong-settings.ts`) · `types.ts` · `money.ts` (`roundCash05`, `computeTotals`) · `catalog.ts` (`buildPosCatalog(sb)` → item rata produk×varian + tetapan POS + kategori + `version`) · `sale.ts` (`createSale`, `addPayment`, `afterSalePaid` = stok + `upsertCustomer({source:'pos'})` + `increment_promo_uses` + stub loyalti) · `stock.ts` (`deductPosSaleStock`, `restorePosSaleStock` — cermin `stock.ts`) · `confirm.ts` (`confirmPosSale`, `markPosChipFailed`) · `receipt.ts` (`buildReceiptText`, `receiptUrl`) · `reports.ts` (`buildShiftReport`, `buildDayReport`, Fasa 3).

Klien offline `src/lib/pos/client/`: `idb.ts` (pembalut IndexedDB ~80 baris, tiada dependency baharu; stor `catalog`, `queue`, `held`, `receipts`), `catalog-cache.ts` (muat IDB serta-merta, sahkan semula dengan ETag), `queue.ts` (`enqueueSale` tulis IDB dulu → `flushQueue()` berurutan; pencetus: selepas jualan, event `online`, `visibilitychange`, pemasa 30s; 401 kasyer → berhenti & minta PIN; 4xx → `failed` tunjuk di `/pos/settings`; 5xx/rangkaian → backoff), `escpos.ts` (Fasa 2).

Stor zustand: `src/lib/stores/pos-ticket.ts` (`persist` kunci `sf-pos-ticket`: `clientTxnId`, `lines[]`, `discount`, `promo`, `customer`, `note`, aksi `addLine/setQty/setWeight/setLineDiscount/removeLine/setDiscount/setPromo/setCustomer/hold/recall/reset`, `totals()` via `money.ts`) dan `src/lib/stores/pos-session.ts` (`registerId/Code`, `cashier`, `online`, `queueCount`, `lastSyncAt`, `catalogVersion`).

Perubahan kecil sedia ada: `src/lib/customers.ts` `CustomerSource` += `'pos'` (text[] tiada constraint); `src/lib/daily-summary.ts` tambah `pos?: ChannelStats` pilihan (toleran `42P01`) + baris dalam `formatSummaryText/Html/Push`.

## 3) Routing, hos & layout

- `src/proxy.ts`: `posHostRouting()` dipanggil selepas `kurmaHostRouting()`. Di hos POS: `/robots.txt` → rewrite `/api/pos/robots`; passthrough `/_next`, `/api/`, `/icons/`, fail statik, `/pos-manifest.json`, `/pos-sw.js`; `/pos/**`, `/auth/**`, `/login`, `/reset-password` → teruskan ke aliran sesi; lain → 308 `/pos/sell`. Di hos lain bila `POS_HOST` diset: `/pos/**` → 308 hos POS. Dalam aliran utama selepas `getUser()`, sebelum blok admin: `if (isPosPath(pathname))` → pengecualian awam `/pos/login`, `/pos/resit/*` (noindex, return); tiada user → `/pos/login?redirect=`; ada user → semak `profiles.is_admin` + `pos_staff` (klien user, RLS select-own) → gagal → `/pos/login?error=no_access`; sentiasa `X-Robots-Tag: noindex`.
- `next.config.ts` `headers()`: tambah `/pos-sw.js` (`Cache-Control` must-revalidate, `Service-Worker-Allowed: /pos/`); entri `{ source: '/:path*', has: [{ type: 'host', value: POS_HOST }] }` dengan `Permissions-Policy: camera=(self), …` (hanya bila env diset masa build); dalam dev longgarkan `camera` global supaya localhost boleh uji pengimbas.
- Root `src/app/layout.tsx`: skrip daftar SW dijaga `if (!location.pathname.startsWith('/pos'))`; `PixelScripts` return awal di `/pos`; `Clarity` skip `/pos`; `PWAInstallBanner` sorok di `/pos`.
- `src/app/pos/layout.tsx` (server): `metadata` manifest `/pos-manifest.json`, `robots index:false`, `appleWebApp`; `viewport` `viewportFit: 'cover'`; bungkus `<PosShell>`; daftar `/pos-sw.js` (production sahaja, skop `/pos/`).
- `public/pos-manifest.json` (`start_url: '/pos/sell'`, `scope: '/pos/'`, `display: standalone`, ikon sedia ada `/icons/*`), `public/pos-sw.js` (precache `/pos/sell|sales|shift|settings` + manifest; cache-first `/_next/static/**`; network-first → cache untuk navigasi `/pos/`; tak sentuh `/api/**`, `/auth/**`, Supabase; tiada Background Sync — flush dipacu app).

## 4) Laluan

Page `src/app/pos/**`:

| Laluan | Jenis | Tujuan |
|---|---|---|
| `/pos` | server | `redirect('/pos/sell')` |
| `/pos/login` | klien | Email + kata laluan (`signInWithPassword`), input besar untuk tablet; tiada OAuth |
| `/pos/sell` | klien `sell-client.tsx` | Terminal: paparan `grid | pay | success`; overlay kunci PIN; tiket tangguh; keypad berat |
| `/pos/sales` | klien | Hari ini / shift semasa, tapis kaedah, laci butiran, cetak semula, WhatsApp, void (PIN manager) |
| `/pos/shift` | klien (Fasa 3) | Buka shift (register + float), laporan X langsung, tutup (kira tunai → varians → Z) |
| `/pos/settings` | klien | Pilih register (localStorage), lebar kertas, uji cetak, kosongkan cache katalog, status baris gilir, log keluar |
| `/pos/resit/[token]` | server, awam | Resit HTML (e-resit + cetak); `?print=58|80` → CSS cetak + auto `window.print()` |

API `src/app/api/pos/**` (semua `requirePos()`, service role):

| Laluan | Kaedah | Auth tambahan | Tujuan |
|---|---|---|---|
| `/api/pos/me` | GET | — | bootstrap: user, isAdmin, kasyer, register, shift terbuka, tetapan |
| `/api/pos/catalog` | GET | — | `PosCatalogItem[]` + `version`; ETag → 304 |
| `/api/pos/pin` | POST/DELETE | `rateLimitDb('pos-pin:'+ip, 10, 60_000)` + lockout | sah PIN → kuki `pos_cashier` / padam |
| `/api/pos/customers?q=` | GET | — | carian `customers` nama/telefon |
| `/api/pos/promo/validate` | POST | — | `evaluatePromo` + `countGuestPromoUses`; tolak jenis `free_shipping` |
| `/api/pos/sales` | POST | kuki kasyer | cipta jualan via `pos_create_sale` (idempoten); jika paid → `afterSalePaid()` |
| `/api/pos/sales` | GET | — | `?shift=` / `?date=` / `?register=` |
| `/api/pos/sales/[id]` | GET | — | butiran (dipoll semasa tunggu CHIP) |
| `/api/pos/sales/[id]/pay` | POST | kasyer | tambah bayaran pada jualan pending (sah manual QR/terminal, tender kedua) → paid bila cukup |
| `/api/pos/sales/[id]/chip-link` | POST | kasyer, online | cipta pembelian CHIP `reference 'pos:<id>'`; `pos_payments` pending; pulangkan URL wa.me / hantar Murpati (Fasa 2) |
| `/api/pos/sales/[id]/void` | POST | PIN manager (body) atau admin | status void, `restorePosSaleStock`, undur promo best-effort |
| `/api/pos/sales/[id]/receipt` | POST | — | `{mode:'link'|'murpati'}` → teks + URL wa.me, atau hantar; `receipt_sent_at` |
| `/api/pos/shifts`, `/[id]/close`, `/[id]/report` | GET/POST | kasyer / manager | Fasa 3 |
| `/api/pos/robots` | GET | awam | `Disallow: /` |
| `/api/webhook/chip` (sedia ada) | POST | tandatangan CHIP | **tambah** cawangan `pos:` selepas `gift:` → `confirmPosSale` / `markPosChipFailed` (Fasa 2) |

API admin (`requireAdmin()`): `/api/admin/pos/registers` (GET/POST, `[id]` PATCH), `/api/admin/pos/cashiers` (GET/POST, `[id]` PATCH termasuk `reset_pin`), `/api/admin/pos/staff` (GET/POST ikut email → profil, DELETE), `/api/admin/pos/product-settings` (GET gabung, PATCH upsert satu baris), `/api/admin/pos/sales` (GET tapis, `?format=csv`), `/api/admin/pos/shifts` (GET), `/api/admin/settings/pos` (GET/PATCH corak `settings/borong/route.ts` + `revalidateTag('app-settings')`).

## 5) Komponen UI (`src/components/pos/`)

```
pos-shell.tsx          header: kod register · cip kasyer (ketuk → PIN) · titik online + lencana baris gilir · kunci
sheet.tsx              bottom sheet (telefon) / panel sisi (tablet), focus trap, safe-area (corak shop-cart-bar.tsx)
numpad.tsx             0-9 · 00 · ⌫ · titik; kekunci 56px
pin-pad.tsx
sell/  sell-client.tsx · product-grid.tsx (quick key dulu, cip kategori, jubin nama·harga·lencana "kg", habis stok pudar tapi TIDAK disekat)
       search-bar.tsx (searchItems) · scan-input.tsx (input tersembunyi sentiasa fokus, Enter → barcode → sku → tambah; Fasa 2)
       camera-scanner.tsx (html5-qrcode lazy; EAN_13/EAN_8/UPC_A/CODE_128/QR; dedupe 2.5s; Fasa 2)
       weight-keypad.tsx (kg 3 perpuluhan, RM langsung; juga untuk kuantiti) · ticket-panel.tsx · ticket-line.tsx
       discount-sheet.tsx (RM/%, had kasyer, PIN manager melebihi had) · customer-sheet.tsx · held-tickets-sheet.tsx
pay/   pay-view.tsx (jubin: Tunai · DuitNow QR · Kad/Terminal · E-wallet terminal · Pautan CHIP; togol berpecah 2 tender)
       cash-pane.tsx (numpad + RM tepat/5/10/20/50/100 → baki besar, bundar 5 sen) · qr-pane.tsx (imej QR + jumlah + "Dah terima")
       terminal-pane.tsx (ruj 4 digit akhir pilihan) · chip-link-pane.tsx (telefon → hantar → poll 3s → paid; mati bila offline)
success/ success-view.tsx (baki 64px, no. resit/local_ref, butang Cetak · WhatsApp · Jualan baru)
sales/ sales-list.tsx · sale-detail-sheet.tsx · void-sheet.tsx
shift/ x-report.tsx · close-shift-form.tsx (Fasa 3)
```

Susun atur: tablet landskap (`lg:`) grid 7/12 kiri, tiket 5/12 kanan; telefon potret grid penuh + bar bawah melekat (bilangan · jumlah · "Bayar") → tiket sebagai sheet. Sasaran sentuh ≥48px, kontras tinggi, lucide monokrom, merah jenama hanya CTA utama. Pintasan papan kekunci (F2 cari, Enter bayar) untuk scanner HID.

## 6) Resit & e-resit

- `src/app/pos/resit/[token]/page.tsx` (`force-dynamic`, cari ikut `public_token`, 404 jika tiada): `SELLER` (jenama, nama sah, SSM, TIN, alamat, telefon), no. resit + local_ref, tarikh/masa KL, register + nama pertama kasyer, baris (`0.750 kg × RM25.00/kg` atau `2 × RM12.00`), diskaun, bundaran, jumlah, bayaran (kaedah, tender, baki), footer tetapan. Void/pending → banner.
- Cetak: `?print=58|80` → `@page { size: 58mm auto; margin: 2mm }`, lebar badan 54mm, mono 11px, komponen klien `auto-print.tsx` panggil `window.print()`; dibuka `window.open(url)` dari paparan berjaya (corak `printAwb`).
- Teks e-resit (`buildReceiptText`): BM ringkas tanpa emoji — nama perniagaan, no. resit, tarikh, baris, jumlah, bayaran, `Resit penuh: https://pos.syababfresh.my/pos/resit/<token>`, terima kasih. Lalai `wa.me/<60tel>?text=`; pilihan `murpati` hormati `getWaCustomerTracking() !== 'off'`. WhatsApp Cloud API tak sesuai (perlu template).

## 7) Admin

- `src/components/admin/admin-sidebar.tsx`: seksyen **POS** — Dashboard, Jualan POS, Shift & Z, Produk POS, Juruwang & Akses, Tetapan POS, "Buka POS" (luaran → hos POS).
- `/admin/pos` (`p-4 md:p-6`): hari ini per register (jualan, hasil ikut kaedah, kg buah), shift terbuka, pautan CHIP tergantung, segerak lewat (`offline=true`).
- `/admin/pos/products` (penuh): setiap produk/varian aktif dengan lajur POS sebaris — quick key (togol + susunan), ikut berat, harga/kg (lalai `products.price` bila `unit='kg'` tanpa varian), override harga POS, barcode (teks + butang imbas kamera), sorok; PATCH per baris (debounce).
- `/admin/pos/sales` (penuh): tapis tarikh/register/kasyer/kaedah/status; laci butiran; void (sebab); pautan cetak semula; CSV; lencana drift bila `unit_price ≠ catalog_price`.
- `/admin/pos/shifts` (Fasa 3): senarai, paparan cetak Z `/admin/pos/shifts/[id]`.
- `/admin/pos/cashiers` (`max-w-4xl`): CRUD register, CRUD kasyer (nama, peranan, set/reset PIN), senarai akses POS (`pos_staff` tambah ikut email login sedia ada; pautan ke `/admin/team` untuk cipta akaun peranti `is_admin:false` via `/api/admin/create-user` sedia ada).
- `/admin/pos/settings` (`max-w-4xl`): header/footer resit, imej QR DuitNow (data URL ≤200KB), lebar kertas, float lalai, had diskaun kasyer, mod WA resit.
- `/admin/sales-report`: baldi "POS (kaunter/bazar)" dari `pos_sales` ikut register & kasyer (Fasa 2); `/admin/pnl` lajur POS (Fasa 3).

## Urutan pelaksanaan

**Fasa 1 — MVP kaunter Bangi (~45 fail, 6–8 hari):** 155_pos.sql → `src/lib/pos/*` → proxy/headers/layout/manifest → API pos (me, catalog, pin, customers, promo, sales, sales/[id] get/pay/void/receipt, robots) → UI (shell, sheet, numpad, pin-pad, sell-client + grid/carian/tiket/keypad berat/diskaun/pelanggan/hold, pay-view tunai/QR/terminal/berpecah, success-view, `/pos/login`, `/pos/sales`, `/pos/settings`, `/pos/resit/[token]`) → Admin (sidebar, `/admin/pos`, products, sales, cashiers, settings + API) → `CustomerSource 'pos'`, baris POS ringkasan harian → `docs/plan-pos.md`.

**Fasa 2 — sedia bazar (~15 fail, 4–5 hari):** `client/idb.ts`, `catalog-cache.ts`, `queue.ts`, `pos-sw.js`, keadaan UI offline, `local_ref`; `scan-input.tsx` + `camera-scanner.tsx` + header kamera per hos; `chip-link` + cawangan webhook `pos:` + `confirm.ts` + pane poll + tambahan cron reconcile; modul ESC/POS Web Bluetooth; baldi POS sales-report.

**Fasa 3 — kawalan & kesetiaan (~15 fail, 4–5 hari):** `/pos/shift` + API shifts + `reports.ts` X/Z + `/admin/pos/shifts`; pergerakan tunai; `awardPosLoyalty` (idempoten `loyalty_awarded_at`); refund separa; eksport e-Invois disatukan (`?format=einvoice`); lajur POS P&L.

## Pengesahan

- `npx tsc --noEmit -p tsconfig.json` setiap fasa (jangan `next build` semasa dev :3006 hidup); eslint.
- Routing dev tanpa env: `curl -I localhost:3006/pos/sell` → 307 `/pos/login`; dengan kuki login → 200 + `X-Robots-Tag: noindex`; `/api/pos/catalog` tanpa auth → 401; `/pos/resit/<token>` → 200 awam; token salah → 404. Dengan `NEXT_PUBLIC_POS_HOST=pos.localhost`: `curl -H 'Host: pos.localhost' localhost:3006/` → 308 `/pos/sell`; `/robots.txt` → Disallow; `/pos-manifest.json` 200.
- Gate: ahli tanpa `pos_staff` → `?error=no_access`; ditambah admin → masuk; admin sentiasa masuk; `supabase.from('pos_sales').select()` dari pelayar sebagai akaun peranti → RLS tolak.
- Skrip bayaran: (a) tunai: 3 pek + 0.750 kg buah, tender RM50 → baki betul, jumlah bundar 0.05, stok ditolak untuk pek sahaja; varian stok 1 beli 2 → jualan lulus, `stock_short=1`, lencana admin. (b) DuitNow QR → imej → "Dah terima" → paid. (c) terminal: ruj direkod. (d) CHIP (Fasa 2): pautan WA → bayar mod ujian → webhook `pos:` → poll paid, stok ditolak sekali; ulang webhook → tiada tolakan dua kali. (e) berpecah RM20 tunai + baki QR.
- Promo: kod % berskop → sama dengan `evaluatePromo`; `free_shipping` ditolak; kegunaan +1 sekali.
- Void: kasyer → minta PIN manager; stok pulih sekali; Z kecualikan void.
- PIN: 10 salah/minit → 429; 5 salah satu kasyer → `locked_until`; kuki tamat → PIN sebelum sync sambung.
- Offline (Fasa 2): DevTools offline → grid dari IDB, jualan tunai siap dengan `local_ref`, lencana 1; online → disegerak, `receipt_no` diberi, POST pendua → `duplicate:true`; tutup tab tengah tiket → tiket pulih.
- Cetak: `?print=58` muat 54mm mono 11px; Chrome Android cetak via print service vendor tanpa terpotong. WA: `wa.me` buka dengan teks BM, token resit boleh dibuka.
- Regresi: checkout kedai, order LP, Quick Order, webhook gift tak terjejas (cawangan `pos:` terasing); gate `/admin/*` tak berubah.

## Tidak disentuh

Skema/flow `orders`, `lp_guest_orders`, `products`, `product_variants`, `profiles` (tiada kolum baharu); Quick Order; RPC stok sedia ada (hanya ditambah RPC baharu); cron sedia ada; hos kurma/kedai (hanya 308 `/pos/**` baharu); WIP affiliate (25 fail) kekal unstaged; app ops (Neon) tidak disentuh — lejar kg buah kekal di sana.

## Apa yang anda patut tahu (sebelum mula)

1. **Persediaan Vercel & Supabase**: tambah domain `pos.syababfresh.my` ke projek Vercel; set env Production `NEXT_PUBLIC_POS_HOST=pos.syababfresh.my` dan `POS_PIN_SECRET` (rawak ≥32 bait); redeploy (headers baca env masa build). Jalankan `155_pos.sql` di SQL Editor. Redirect URL Supabase hanya perlu jika guna OAuth/magic link (login kata laluan tak perlu). Kuki Supabase ikut hos → staf login sekali di hos POS.
2. **Perkakasan**: tablet Android Chrome ≥100; printer terma 58/80mm **yang ada app Android Print Service** (laluan Fasa 1 cetak pelayar) dan dedah **BLE** (Fasa 2 Web Bluetooth — printer Bluetooth klasik/SPP murah TIDAK boleh dari pelayar); scanner barcode USB/BT mod HID dengan akhiran Enter; penimbang berpaparan (masuk kg manual). **iPhone**: imbas kamera OK (html5-qrcode), cetak hanya AirPrint/app vendor, tiada Web Bluetooth → telefon = jual + e-resit WhatsApp.
3. **Internet bazar**: Fasa 1 perlu online; Fasa 2 beri offline untuk tunai/QR/terminal. Pautan CHIP & carian pelanggan sentiasa perlu rangkaian.
4. **DuitNow QR statik sahkan manual** = berasaskan kepercayaan (risiko tangkapan skrin palsu). Mitigasi: kasyer semak notifikasi app bank; laporan Z senaraikan tender QR untuk padan dengan bank; untuk auto-sah guna pautan CHIP (ada yuran gateway).
5. **Stok**: stok kedai = unit pek (integer). Buah longgar ikut kg **tidak** ditolak di mana-mana oleh POS (direkod kg sahaja) kerana lejar kg ada di app ops yang berasingan dan tidak dikira jualan web pun. Stok kg bazar ringkas / integrasi lejar = Fasa 3 selepas penyatuan DB. Jualan kaunter **tak pernah disekat** oleh angka stok; kekurangan ditanda untuk admin.
6. **Harga bazar** boleh berbeza dari web melalui override POS per produk; promo kod kedai boleh dipakai di kaunter.
7. **e-Invois LHDN**: Syabab > RM3J → wajib; tempoh peralihan (RM3–5J) hingga 31 Dis 2027 ikut nota kita sebelum ini — sumber awam bercanggah tentang tarikh, sahkan dengan LHDN/akauntan. Resit POS boleh dilaporkan sebagai **e-Invois disatukan bulanan** (dalam 7 hari selepas hujung bulan) kecuali satu transaksi > RM10,000 perlu e-Invois individu. POS Fasa 3 sediakan eksport CSV bulanan + medan TIN pembeli pilihan; hab e-Invois kekal perisian akaun/intermediary ikut keputusan 24 Okt (bukan website).
8. **SST**: resit tak cetak baris cukai melainkan `COMPANY.facts.sstRegistered` diisi — sahkan status.
9. **Keselamatan peranti kongsi**: akaun peranti bukan admin, PIN kasyer untuk atribusi, PIN manager untuk void/diskaun besar, kunci skrin.
10. **Nama**: dalam app ops "pos" bermaksud Poslaju — nama jadual/API di sini `pos_*`/`/api/pos` berada dalam repo kedai sahaja; tak bercampur.

Sumber web (8 Nov 2026): [LHDN SPK Q&A e-Invois](https://www.hasil.gov.my/wp-content/uploads/kompilasi-soalan-dan-jawapan-spk-2025-bagi-siri-1-14-oktober-2025-topik-e-invois-persediaan-strategik-ke-arah-pematuhan-mandatori.pdf), [Malaysiakini e-Invoice](https://www.malaysiakini.com/news/756567), [Panduan Fasa 4 & peraturan RM10,000](https://beancount.io/de/blog/2026/09/16/malaysia-e-invoicing-phase-4-rm3m-exemption-rm10000-rule-guide), [MDN Barcode Detection API](https://developer.mozilla.org/docs/Web/API/Barcode_Detection_API), [WCPOS printer setup](https://docs.wcpos.com/hardware/printers.md), [Openbravo WebBluetooth/WebUSB](https://www.openbravo.com/blog/?p=63804), [Panduan penimbang POS](https://www.hogentogler.com/education-center/how-to-choose-a-pos-scale).

---

## Log pembinaan

**DIBINA 8 Nov 2026 — Fasa 1 (MVP kaunter), belum commit, migration 155 BELUM dijalankan.**

Fail baharu: `supabase/155_pos.sql` · `src/lib/pos/{host,types,money,settings,pin,require-pos,catalog,stock,sale,receipt,reports}.ts` · `src/lib/stores/{pos-ticket,pos-session}.ts` · `src/app/pos/{layout,page}.tsx`, `src/app/pos/login/page.tsx`, `src/app/pos/resit/[token]/page.tsx`, `src/app/pos/(app)/{layout,sell,sales,settings}` · `src/components/pos/**` (shell, sheet, numpad, pin-pad, bootstrap, katalog, grid, tiket, berat, baris, diskaun, pelanggan, tangguh/item lain, bayar, berjaya, jualan, tetapan, auto-print) · `src/app/api/pos/{robots,me,catalog,pin,customers,promo/validate,sales,sales/[id],sales/[id]/pay,sales/[id]/void,sales/[id]/receipt,report}` · `src/app/api/admin/pos/{registers,cashiers,staff,product-settings,sales}` + `src/app/api/admin/settings/pos` · `src/app/admin/pos/{page,products,sales,cashiers,settings}` · `public/pos-manifest.json`.

Fail sedia ada disentuh (additive): `src/proxy.ts` (cabang hos POS + gate `/pos/*`), `next.config.ts` (header `/pos-sw.js`, kamera untuk `/pos/*`), `src/app/layout.tsx` (SW kedai tak daftar di `/pos`), `src/components/analytics/{pixel-scripts,clarity}.tsx` & `src/components/store/pwa-install-banner.tsx` (langkau `/pos`), `src/lib/customers.ts` (`CustomerSource` += `'pos'`), `src/lib/daily-summary.ts` (baris POS berasingan, tak dicampur ke `revenue`), `src/components/admin/admin-sidebar.tsx` (seksyen POS).

Perubahan dari pelan asal semasa bina: (1) POST `/api/pos/sales` & void terima **admin tanpa PIN** (admin uji dari hos kedai); kasyer biasa tetap perlu PIN. (2) `POST /api/pos/pin` ada `verify_only` untuk kelulusan manager (diskaun melebihi had) tanpa tukar kasyer semasa. (3) Jubin "Pautan bayar (CHIP)" dipapar tetapi dimatikan sehingga Fasa 2. (4) Katalog peranti dicache di localStorage dulu (IndexedDB bersama baris gilir offline di Fasa 2). (5) Produk tanpa varian: item POS `pcs` tidak dijejak stoknya di UI (stok batch tidak dipaparkan) tetapi `pos_deduct_stock` tetap tolak `inventory_batches` FIFO.

Belum (Fasa 2/3): offline queue + SW, imbas kamera/HID khusus (carian terima teks scanner HID + Enter), pautan CHIP + webhook `pos:`, ESC/POS Bluetooth, shift/Z, loyalti, refund separa, e-Invois eksport, baldi POS di `/admin/sales-report`, lajur P&L.

**DIUJI 8 Nov 2026 malam (selepas pemilik jalankan 155):** ujian API 27/27 lulus (PIN salah/betul, jualan tunai + berat 0.75kg, stok pek ditolak & ikut berat tidak, CRM telefon, pendua `client_txn_id`, berpecah tunai+QR, bundar 5 sen, bayaran tak padan ditolak, promo tamat/tak wujud, void kasyer ditolak → PIN manager lulus → stok pulih, void dua kali 409, laporan X, senarai, butiran, e-resit wa.me, page resit awam + cetak 58mm, API tanpa kuki 401) + aliran UI penuh di Chrome (PIN → 0.5kg → tunai RM100 → baki RM11 → POS-20261108-0008). Semua jualan ujian di-void. Dua bug dibetulkan semasa ujian: (a) embed `pos_cashiers(name)` kabur kerana `pos_sales` ada dua FK ke `pos_cashiers` → `pos_cashiers!cashier_id(name)`; (b) komponen klien import `klDateStr` dari `lib/daily-summary` (menarik web-push/`net`) → helper tulen `src/lib/pos/dates.ts`. Data ujian kekal: akaun peranti `pos-t1@syababfresh.my` + 2 kasyer "Ujian …" (padam/reset sebelum live), tetapan POS Strawberry ikut berat RM40/kg (ujian), 7 rekod jualan void.

**ITERASI UI 9 Nov 2026 (maklum balas pemilik, belum commit):** (1) UI staf POS, mesej ralat API, resit awam `/pos/resit/<token>` & e-resit WhatsApp → **Bahasa Inggeris** (`POS_PAY_LABEL_MS` dibuang; footer lalai "Thank you. Please keep this receipt for any enquiries."); admin POS kekal BM. (2) Grid jual: panel tiket dikecilkan; tab **Categories** papar jubin kategori sebaris (bukan popup); jubin **peringkat produk** → sheet pilih varian/gram; jubin & skrin bayar & baris diskaun dibesarkan untuk tablet. (3) **Timbang terbuka** (`pos_settings.openWeightAll`, kotak semak di Tetapan POS): setiap produk bervarian "1kg" dapat item tambahan "By weight RM<harga 1kg>/kg"; pek asal kekal; produk tanpa varian 1kg perlu tanda "ikut kg" + harga/kg (contoh Strawberry). Dihidupkan di DB ujian. (4) Bug: `normalizePosSettings` jatuh ke footer lalai bila kunci `receiptFooter` tiada (JSON ditulis separa), kosong sengaja oleh admin kekal kosong. (5) Produk POS admin: **pagination 20 produk/page** (`?page=N`, komponen `admin/pagination`) + penapis kategori + carian reset ke page 1. (6) Katalog terminal POS **sahkan semula automatik** bila tab aktif semula & setiap 5 minit (ETag → 304) — produk baharu dari Admin → Products muncul di POS tanpa muat semula manual; butang refresh kekal. Nota: `/login` kedai bila sudah log masuk → `/`, dan `/admin/*` bukan admin → `/` (peraturan proxy sedia ada) — akaun peranti `pos-t1` mesti log keluar dulu sebelum log masuk admin di pelayar sama.

**9 Nov 2026 (lewat malam) — admin POS → English + edit register:** semua page admin POS (`/admin/pos`, sales, products, cashiers, settings), label sidebar seksyen POS (POS Dashboard · POS Sales · POS Products · Cashiers & Access · POS Settings · Open POS), tajuk metadata, mesej ralat API `/api/admin/pos/*` & `/api/admin/settings/pos`, dan CSV (offline `yes`, nama fail `pos-sales-…`) ditukar ke Bahasa Inggeris (keputusan pemilik — seluruh POS termasuk admin kini BI; admin lain kekal BM). Register/terminal kini ada butang **Edit** sebaris (kod, nama, lokasi) — `PATCH /api/admin/pos/registers` terima `code` (sah A–Z/0–9 ≤12, 23505 → "Register code already exists"). Nilai data `variant_name = 'ikut berat'` untuk baris kg KEKAL (sentinel dalam DB; UI sorok & papar "By weight"). Belum commit.

**9 Nov 2026 — barcode (Fasa 2 ditarik awal):** (1) `src/components/pos/use-hid-scanner.ts` — pendengar scanner HID (USB/BT mod papan kekunci) di seluruh skrin Sell: kumpul aksara sela ≤100ms, Enter/Tab + ≥3 aksara → `onScan`; abaikan bila fokus di input (kotak carian handle sendiri → tiada tambah dua kali); aktif hanya di paparan grid tanpa sheet. (2) `src/components/pos/camera-scanner.tsx` — html5-qrcode lazy (BarcodeDetector native bila ada), kamera belakang, seluruh bingkai, format EAN-13/8, UPC-A/E, Code 128/39, ITF, QR, dedupe 2.5s; mod berterusan (POS) / sekali (admin). (3) Sell: butang kamera (ikon ScanLine) di sebelah carian → sheet "Scan barcode" (kamera + jumlah tiket + Done); padanan imbasan barcode tepat → SKU tepat; item kg buka pad berat; kod tak wujud → toast "No item with barcode …". (4) Admin Produk POS: sel barcode ada butang kamera (modal, kod pertama → simpan terus). (5) `next.config.ts`: `Permissions-Policy camera=(self)` untuk `/admin/pos/:path*` (tambahan kepada `/pos/:path*`). Diuji di Chrome (admin): HID simulasi keydown → baris masuk tanpa fokus; kod tak wujud → toast; scanner menaip ke kotak carian berfokus → tambah SEKALI (qty 1→2, bukan baris baharu); barcode ujian dibuang semula. Kamera belum diuji langsung (perlu peranti sebenar). Nota: Dispatch admin (`/admin/shipping/dispatch`) kamera sebelum ini disekat oleh header global `camera=()` — dibetulkan sekali (entri `/admin/shipping/dispatch/:path*` camera=(self), disahkan via curl header).

**9 Nov 2026 — senarai harga per outlet (DIBINA, migration 156 MENUNGGU pemilik):** `supabase/156_pos_price_lists.sql` (jadual `pos_price_lists`, `pos_price_list_items` unik (list, produk, coalesce(varian)), kolum `pos_registers.price_list_id`, RLS admin corak 155). `buildPosCatalog(sb, { registerId })` → senarai harga register menindih harga pek / harga/kg (senarai hanya menindih, tidak mencipta item timbang); keutamaan: senarai harga register → override global `pos_price` → harga kedai. `PosCatalogItem.catalogPrice` dinamakan semula `storePrice`; tiket simpan `catalogPrice = price yang dihidangkan` → lencana **drift** di admin kini bermaksud kasyer ubah harga baris (bukan beza kedai vs bazar); label "(catalog RM..)". `PosCatalog.priceList {id,name}|null`; versi/ETag termasuk id senarai + max(updated_at item). Peranti: `use-pos-catalog` hantar `?register=<id sesi>` dan muat semula bila register bertukar. API admin: `/api/admin/pos/price-lists` (GET/POST/PATCH/DELETE) + `/items` (GET ?list=, PATCH upsert; kedua-dua null → padam baris); `PATCH /api/admin/pos/registers` terima `price_list_id`. UI: POS Products → pemilih "Prices for: Store prices (default) | <senarai>" + New/Rename/Delete; mod senarai → lajur harga edit item senarai (placeholder = harga lalai), lajur lain kekal global; Cashiers & Access → baris register papar "Prices: …" + dropdown senarai dalam Edit. Toleran tanpa 156 (disahkan di dev: price-lists API 503 + nota amber, katalog kekal berfungsi `pl0`). **Pemilik: jalankan 156 di SQL Editor**, kemudian cipta senarai "Bazar", isi harga, pautkan ke register bazar.

## Cadangan Fasa 2.5 — stok per outlet, pindahan HQ → outlet (DO), pemantauan (DRAF 9 Nov 2026, menunggu kelulusan)

**Konsep.** Stok dipegang ikut **outlet** (bukan register — satu bazar boleh ada 2 register berkongsi stok). HQ = kedai Bangi (stok sedia ada `product_variants.stock` / `inventory_batches`, dipakai web + Quick Order). Outlet bazar = stok sendiri dalam jadual baharu, qty perpuluhan (kg buah boleh dijejak di outlet walaupun HQ integer). Barang keluar HQ → outlet melalui **dokumen pindahan (DO)** bernombor; jualan POS di outlet tolak stok outlet; baki pulang ke HQ melalui DO pulangan.

**Data (migration 157):**
- `pos_outlets` (kod, nama, jenis `hq|bazaar|store`, aktif, tarikh mula/tamat untuk bazar) · `pos_registers.outlet_id` (register T1 → outlet HQ).
- `pos_outlet_stock` (outlet, produk, varian|null, qty numeric(10,3), updated_at) — baki semasa.
- `pos_stock_movements` — lejar: jenis `transfer_out|transfer_in|sale|void_restore|adjustment|wastage|return`, qty ±, rujukan (sale_id / transfer_id), oleh siapa, nota. Baki = jumlah lejar (boleh dikira semula).
- `pos_transfers` (no. `DO-YYYYMM-NNNN` dari kaunter atomik seperti resit, dari outlet → ke outlet, status `draft → sent → received` (+ `cancelled`), dihantar oleh / diterima oleh, catatan, `pricing` pilihan: kos atau harga borong untuk "invois dalaman") + `pos_transfer_items` (produk/varian, qty dihantar, qty diterima, harga seunit pilihan, catatan varians).
- RLS admin sahaja; POS tulis via service role.

**Aliran.**
1. Admin → POS → **Transfers → New DO**: pilih outlet destinasi, tambah item (carian produk, qty; kg untuk buah) → simpan draf → **Send**: tolak stok HQ untuk item pek (RPC `pos_deduct_stock` sedia ada; tak pernah RAISE, kekurangan ditanda), item kg HQ tidak ditolak (lejar kg HQ ada di app ops — nota pada DO) → cetak **DO** (A4 + 80mm; nombor, tarikh, dari/ke, senarai, ruang tandatangan pemandu/penerima; jika `pricing` diisi → lajur harga & jumlah = "invois dalaman").
2. Di outlet (tablet POS, menu baharu **Receive**): PIC sahkan kuantiti diterima (lalai = dihantar) → stok outlet bertambah, varians direkod. Admin juga boleh terima bagi pihak.
3. **Jualan POS** di register outlet → tolak `pos_outlet_stock` (bukan stok HQ); register HQ kekal tolak stok kedai seperti sekarang. Void pulihkan. Tidak pernah sekat jualan; `stock_short` ditanda.
4. **Tutup bazar**: Stock take (kira fizikal → adjustment/wastage) → **Return DO** outlet → HQ (stok HQ pek bertambah via `restore_stock`).

**Pemantauan (Admin → POS → Outlets):** kad per outlet (stok di tangan ikut produk, jualan hari ini, tunai dijangka, DO terakhir, amaran stok rendah), kad stok per produk merentas outlet, lejar pergerakan boleh tapis, CSV. Ringkasan harian (`daily-summary`) baris POS dipecah ikut outlet.

**Keputusan diperlukan sebelum bina:** (a) Sumber stok HQ untuk buah kg — app ops (Neon) atau storefront? Cadangan: DO rekod kg, tolakan HQ kg kekal manual di app ops sehingga penyatuan DB (`docs/plan-consolidate-db.md`). (b) DO perlu harga? Cadangan: pilihan per DO (kosong = DO tulen; kos/borong = invois dalaman untuk akauntabiliti PIC). (c) Siapa boleh **Receive** di outlet — kasyer biasa atau manager sahaja (cadangan manager PIN). (d) Nombor DO siri sendiri `DO-` atau sambung siri dokumen Refrens/sebut harga (cadangan siri sendiri, dalaman).

**Anggaran:** 2.5a (outlet, DO hantar/terima/cetak, tolakan stok outlet, pulangan) ≈ 2–3 hari; 2.5b (dashboard Outlets, stock take/wastage, CSV, ringkasan harian ikut outlet) ≈ 1–2 hari. Semua additive; stok HQ/web, Quick Order, cron tidak disentuh selain RPC sedia ada.

**9 Nov 2026 (malam) — Fasa 2.5a DIBINA (stok outlet + DO), migration 157 MENUNGGU pemilik.** Keputusan pemilik: unit baris DO pcs/kg/ctn (ctn × pack size → pcs, kita tentukan), DO tanpa harga, pengesahan oleh staf bertugas (mana-mana PIN kasyer / admin), siri sendiri `DO-YYYYMM-NNNN`. Aliran: outlet ambil barang di HQ → HQ Issue DO (stok HQ pek ditolak via `pos_deduct_stock`, stok outlet **terus** bertambah, DO dicetak) → staf outlet sahkan di POS → Receive (beza = pelarasan) → HQ pantau di Admin → Outlets & Stock.
- `supabase/157_pos_outlets_transfers.sql`: `pos_outlets` (seed HQ; register sedia ada dipautkan ke HQ), `pos_registers.outlet_id`, `pos_sales.outlet_id` (+ trigger `pos_sales_set_outlet` warisi dari register), `pos_outlet_stock` (unik outlet/produk/coalesce(varian)/unit, qty numeric 3dp — kg boleh dijejak di outlet), `pos_stock_movements` (lejar: transfer_in/out, sale, void_restore, adjustment, wastage, count), `pos_transfer_counters`, `pos_transfers` (draft→issued→confirmed | cancelled; kind out/return), `pos_transfer_items` (unit, qty, pack_size, base_unit, base_qty, received_qty, hq_stock_short), fungsi `pos_next_transfer_no()`, `pos_outlet_stock_apply(...)` (clamp 0, pulang kekurangan), RLS admin + grant service_role.
- `src/lib/pos/outlets.ts`: `normalizeTransferItem`, `applyOutletMovement` (RPC + lejar), `issueTransfer` (tuntutan status atomik; HQ pek ditolak, kg HQ tidak — lejar kg di app ops), `confirmTransfer` (varians → adjustment pada outlet penerima), `cancelTransfer` (draf sahaja), `loadOutletStock`, `loadOutletOfRegister/Sale`, `TransferError`.
- `src/lib/pos/stock.ts`: jualan di register outlet bukan-HQ → tolak/pulang **stok outlet** (pcs & kg) melalui lejar; HQ kekal stok kedai. Toleran tanpa 157.
- API peranti: `GET /api/pos/transfers?register=` (pending + confirmed 7 hari), `POST /api/pos/transfers/[id]/confirm` (PIN kasyer/admin), `GET /api/pos/outlet-stock?register=`. `GET /api/pos/me` sertakan outlet per register (fallback bila 157 tiada).
- API admin: `/api/admin/pos/outlets` (GET stats hari ini/POST/PATCH), `/api/admin/pos/outlet-stock` (GET + CSV, PATCH count/adjustment/wastage), `/api/admin/pos/stock-movements`, `/api/admin/pos/transfers` (GET/POST `issue:true`), `/api/admin/pos/transfers/[id]` (GET/PATCH draf/POST issue|confirm|cancel); `PATCH registers` terima `outlet_id`.
- UI admin: `/admin/pos/outlets` (kad outlet: DO pending, baris stok, jualan & hasil hari ini; stok outlet terpilih + Count/Wastage + CSV; lejar 150 terkini; borang outlet baharu), `/admin/pos/transfers` (senarai tapis status/outlet; borang DO baharu: pilih item dari katalog POS, unit pcs/kg/ctn + pack size, baris bebas; Save draft / Issue DO & print; tindakan Issue · Confirm bagi pihak · Cancel · Print A4/80mm; butiran sent/stock qty/received/varians), sidebar + dashboard pautan Outlets & Stock, Delivery Orders; register Edit ada dropdown Outlet.
- Dokumen DO: `/pos/do/<id>` (A4; `?size=80` terma; `?print=1` auto) — tanpa harga, ruang tandatangan Issued by / Received by; akses sesiapa yang ada akses POS (admin/akaun peranti).
- POS: tab **Receive** (`/pos/receive`): DO menunggu untuk outlet register ini → sheet sahkan kuantiti (lalai = dihantar, beza ditanda amber) + nota → Confirm (PIN kasyer bila belum log masuk) ; stok outlet semasa; DO disahkan 7 hari. Settings papar outlet register.
- Lint: `set-state-in-effect` dielak dengan corak kunci-dimuat (`loadedKey !== key`). Belum diuji hujung-ke-hujung (perlu 157). Belum commit.

**DIUJI E2E 9 Nov 2026 (selepas pemilik jalankan 156 & 157) — semua lulus.** Skrip dalam Chrome sebagai admin (API sebenar, DB prod):
- **Senarai harga:** cipta senarai → pautkan ke register ujian TST1 → harga pek (65 → 66.50) & harga/kg (65 → 67) hanya di katalog TST1; T1 kekal harga kedai; versi/ETag berbeza per register.
- **DO HQ → outlet** (`DO-202611-0001`): 4 baris (pcs 2 · ctn 1 × 3 · kg 1.5 · baris bebas) → stok HQ pek 100 → 95, stok outlet 5 pcs + 1.5 kg serta-merta; peranti nampak DO menunggu; sahkan dengan baris kg diterima 1.2 → pelarasan −0.3 dalam lejar; sahkan kali kedua → 409.
- **Jualan di register outlet:** tolak stok outlet (pcs & kg), stok HQ tak berubah; txn pendua tiada tolakan dua kali; **jual 10 bila stok 4** → jualan lulus, stok 0, nota `OUTLET TST STOCK SHORT`, `stock_short 6`; void pulangkan 4 sahaja; void jualan pertama pulangkan penuh; void dua kali → 409.
- **Kiraan & rosak** (count 1.0 → wastage 0.2 → 0.8 kg); **DO pulangan** outlet → HQ (`DO-202611-0002`, kind return): stok outlet 0, **stok HQ kembali 100**; disahkan melalui UI POS → Receive pada register T1 (sheet kuantiti → Confirm received).
- Cetak `/pos/do/<id>` A4 & 80mm 200 (DELIVERY ORDER / RETURN NOTE); draf + cancel; ctn tanpa pack size ditolak 400; tapisan senarai ikut outlet.
- Nota: `POST /api/pos/sales` pulang **201** (dua "FAIL" dalam skrip ialah jangkaan 200 yang silap, bukan pepijat).
- Data ujian yang kekal (tiada endpoint padam): outlet `TST` (tidak aktif), register `TST1` (tidak aktif, tanpa senarai harga), 2 DO disahkan + 1 draf dibatalkan, lejar pergerakan outlet TST (baki 0), 2 jualan void `POS-20261109-0001/0002`. Senarai harga ujian dipadam.

**9 Nov 2026 — SHIFT (buka/tutup kedai + modal tunai) DIBINA & DIUJI** (ditarik dari Fasa 3 atas permintaan pemilik; tiada migration baharu — jadual `pos_shifts` & `pos_cash_movements` dari 155).
- `src/lib/pos/shifts.ts`: `openShift` (satu shift terbuka per register, 23505 → 409), `addCashMovement`, `closeShift` (tuntutan atomik; `expected = float + jualan tunai + masuk − keluar`, `variance = dikira − expected`, ringkasan dibekukan dalam `summary` = Z), `buildShiftSummary` (langsung = X; pagination >1000 baris; bayaran ditapis via inner join shift), `loadOpenShift/loadShift/loadLastClosedShift`.
- `createSale`: jualan dilekatkan `shift_id` shift terbuka register secara server-side (klien tak perlu hantar); tiada shift → null, jualan tetap lulus.
- Tetapan `pos_settings.requireShift` (lalai **hidup**; kotak semak "Require opening the store before selling" di Admin → POS Settings; float lalai dipra-isi).
- API: `GET/POST /api/pos/shifts` (status + X / buka), `GET /api/pos/shifts/[id]`, `POST …/cash`, `POST …/close` (PIN kasyer mana-mana peranan atau admin; push admin "Kedai ditutup …"), `GET /api/admin/pos/shifts`.
- POS: tab **Shift** (`/pos/shift`): Open store (numpad float) · ringkasan langsung (jualan, hasil, float, tunai dijangka, ikut kaedah, tunai masuk/keluar) · Cash in / Cash out (jumlah + sebab) · X report · Close store (kira laci → beza dipapar → Z + cetak). Cip header Open/Closed; skrin **Sell dikunci** "Store is closed → Open store" bila `requireShift` dan tiada shift. Hook `use-pos-shift.ts` (muat semula bila register bertukar / tab aktif).
- Laporan `/pos/shift-report/<id>` (X bila terbuka, Z bila tertutup; 80/58mm; `?print=1`). Admin `/admin/pos/shifts` (tempoh, status; float, jualan, hasil, tunai dijangka vs dikira, beza; pautan X/Z) + sidebar + dashboard.
- Ujian API 21/21 lulus pada register sementara `ZTEST` (dinyahaktif selepas ujian): buka (201) / buka dua kali (409); 3 jualan (tunai, QR, berpecah tunai+kad) → 3 / RM92.35 / tunai RM32.35; tunai masuk 50 & keluar 10 → dijangka RM272.35; void jualan tunai → 2 / RM80 / dijangka RM260; X 200; tutup tanpa kiraan 400; tutup dikira 255 → beza −5; tutup dua kali & pergerakan selepas tutup 409; Z papar "Short"; jualan tanpa shift tetap diterima; semua jualan ujian di-void. Pemilik sendiri dah buka & tutup satu shift di T1 melalui UI. Data ujian kekal: register `ZTEST` (tidak aktif) + 1 shift tertutup bernota "E2E TEST shift — ignore" + 4 jualan void `POS-20261109-0007..0010`.
- Nota: pemilik menamakan semula register ujian lama `TST1` → `T2 PKNS Bangi` (masih dipaut ke outlet `TST` "TEST Outlet (e2e)" yang tidak aktif) dan mencipta senarai harga "PKNS Bangi".

**9 Nov 2026 — tutup kedai: isytihar SEMUA jenis bayaran** (permintaan pemilik). Sebelum ini tutup hanya minta tunai dikira; QR/kad diambil dari rekod sistem tanpa semakan. Kini sheet "Close store — declare all payments" menyenaraikan satu baris bagi tunai (dikira dalam laci, termasuk float) dan satu baris bagi setiap kaedah bukan tunai yang ADA jualan dalam shift itu (`POS_DECLARE_METHODS`: DuitNow QR = jumlah di app bank, kad & e-wallet terminal = slip settlement; `chip_link` dikecualikan — disahkan gateway). Ketuk baris → numpad isi jumlah → beza dengan rekod sistem dipapar (Exact / Over / Short). Server (`closeShift`) **menolak (400)** jika kaedah yang ada jualan tidak diisytihar; simpan `summary.declared` & `summary.tenderVariance` (diisytihar − sistem; cash = dikira − dijangka). Z report papar "Declared at close" per kaedah; admin Shifts ada lajur "QR / card diff"; push tutup kedai sebut beza QR/kad. Shift tunai sahaja tutup seperti biasa. Ujian API 12/12 lulus pada `ZTEST` (tolak tanpa QR, tolak tanpa kad, kekal terbuka selepas ditolak, tutup dengan kad kurang RM5 → tenderVariance −5, Z & admin betul, shift tunai sahaja OK). 2 lagi shift ujian bernota "E2E TEST …— ignore" pada ZTEST; jualan ujian di-void.

**9 Nov 2026 (petang) — pepijat dilaporkan pemilik: nama pelanggan & e-wallet "tak keluar" di Sales.** Siasatan pada jualan `POS-20261109-0015` (RM32.40, di-void pemilik "Silap"): disimpan tanpa pelanggan dan kaedah `card_terminal`. Punca:
1. **Nama pelanggan tak boleh disimpan tanpa telefon.** `CustomerSheet` hanya hidupkan butang simpan bila nombor telefon Malaysia sah, dan medan pertama ("Phone number or name") guna papan kekunci nombor — nama sahaja tak dapat ditaip/disimpan. Dibetulkan: medan **Customer name** (teks) dahulu, **Phone (optional)** kedua; simpan dibenarkan dengan nama sahaja (`phone: ''`), telefon tak sah ditanda amber; carian CRM ikut telefon ATAU nama (≥3 aksara). Server memang dah terima nama tanpa telefon (disahkan: `customer_name` disimpan, tiada rekod CRM dicipta).
2. **E-wallet direkod sebagai Card.** Server simpan `ewallet_terminal` dengan betul bila dihantar (disahkan API) → skrin menghantar `card_terminal`, iaitu jubin Card (bersebelahan E-wallet) yang terketuk; pane pengesahan kedua-duanya serupa ("Terminal approved") jadi kesilapan tak kelihatan. Dibetulkan: pane terminal papar lencana kaedah (Card / E-wallet) + teks butang "E-wallet approved RM…" / "Card approved RM…"; skrin **Sale complete** kini papar "Paid by <kaedah> RM…" dan "Customer: <nama>" (dan dibesarkan pada skrin lebar).
- Lain: `ticket-panel` hantar `phone || null` ke semakan promo; label butang Customer guna nama → telefon.
- **Pembetulan fakta:** shift tertutup di T1 jam 16:54 bernota "E2E TEST shift — ignore" (2 jualan, kurang RM5) dicipta oleh skrip ujian SAYA — percubaan pertama ujian shift dilaporkan "extension not connected" tetapi sebenarnya berjalan penuh pada T1 (jualan ujian `POS-20261109-0003..0006`, item bebas tanpa stok, semua di-void). Bukan pemilik yang buka/tutup seperti saya nyatakan sebelum ini. Pengajaran: selepas ralat sambungan pelayar, semak kesan sampingan di DB sebelum ulang skrip.

**9 Nov 2026 — semakan telefon (360px & 390px) dalam Chrome** (bingkai iframe pada lebar telefon; skrin: Sell, sheet tiket, Pay + pane tunai, sheet Customer, Sales, Receive, Shift + sheet Close store, Settings). Dijumpai & dibetulkan: **header melimpah 67px** (butang Cashier PIN terpotong) selepas tab Receive & Shift ditambah → pada <640px nav jadi ikon 40px, label "SF POS" disorok, nama kasyer disorok <400px; kini tiada limpahan mendatar pada 360 & 390. Sales: label "All registers" → "All" pada telefon. Skrin lain muat tanpa perubahan (grid 2 lajur, bar bawah Ticket/Pay, sheet bawah, numpad). Nota: sheet Close store pada telefon pendek perlu skrol sedikit untuk butang akhir. Belum diuji pada peranti sebenar (papan kekunci maya, safe-area iPhone).

**9 Nov 2026 (malam) — LIVE + pepijat PIN bermula 0.** Selepas push `e6a8c27`, pemilik menyediakan env & domain: `pos.syababfresh.my` live (CNAME Vercel; `/pos/login` 200; `shop.syababfresh.my/pos/*` → 308 ke hos POS). Pemilik lapor "PIN betul tapi salah". Siasatan: server sahkan PIN dengan betul (1234, 9999, `0123`, `012345` lulus via `verify_only`; `12345` tanpa sifar → 401). Punca: `PosNumpad` membuang `0` di depan (peraturan mod wang `value === '0'` → diganti digit seterusnya), jadi PIN bermula 0 tak boleh ditaip pada pad PIN — 4 digit jadi 3 (Enter senyap tanpa mesej), 5–6 digit dihantar tanpa sifar → "Wrong PIN" + dikira ke arah kunci. Dibetulkan: prop `keepLeadingZero` pada `PosNumpad` (hanya `PinPad` guna; pad jumlah wang/kuantiti kekal), dan `PinPad` kini beri mesej "Choose your name first" / "PIN has 4 to 6 digits" bukannya senyap. Disahkan di Chrome: tekan 0-1-2-3 → 4 titik terisi. **Belum commit/push — production masih ada pepijat ini** (penyelesaian sementara: PIN yang tidak bermula 0). Data ujian tambahan: kasyer "ZZ TEST zero/six" (tidak aktif).

**9 Nov 2026 (malam) — deploy `cc7eb5b` gagal, bukan kerana kod.** Log build Vercel: `Turbopack build failed with 25 errors … next/font/google queries have exactly one entry` pada `src/app/layout.tsx` (Nunito). Ini pepijat hulu Next.js (vercel/next.js #99114): Google Fonts sekali-sekala memulangkan URL fon tanpa sambungan dan Turbopack gagal menghuraikannya; sekejap-sekejap, tiada kaitan dengan commit (commit sebelumnya berjaya 13 minit lebih awal; Google kini memulangkan URL `.woff2` biasa). Tindakan: Redeploy di Vercel. Cadangan kekal (belum dibuat): fon hos sendiri melalui `next/font/local`. Production kekal `e6a8c27` sehingga redeploy berjaya.

**9 Nov 2026 (malam) — pembaikan PIN LIVE + butang Delete register & kasyer.**
- Deploy: status `cc7eb5b` bertukar **success** 18:15 (redeploy); disahkan terus di `https://pos.syababfresh.my/pos/sell` — pad PIN: tekan 0 kemudian 1 → 2 titik (versi lama 1), `pinEnabled: true`. Commit docs `3f57ec9` belum menunjukkan deployment di GitHub semasa semakan (tiada kesan fungsi).
- Butang **Delete** (ikon tong) pada baris register dan kasyer di Admin → POS → Cashiers & Access, dengan pengesahan. `DELETE /api/admin/pos/registers?id=` dan `DELETE /api/admin/pos/cashiers?id=` memadam HANYA rekod tanpa sejarah: register disemak pada `pos_sales` + `pos_shifts`; kasyer pada jualan/void, shift, tunai masuk/keluar, pengesahan DO, pergerakan stok. Ada sejarah → 409 dengan bilangan rekod dan cadangan guna Inactive (memadam akan merosakkan laporan lama). Diuji: register/kasyer baharu dipadam (200); `ZTEST` (9 jualan, 3 shift) dan "Ujian Kasyer" (9 jualan) ditolak 409 dan kekal; id tak sah 400. Kasyer ujian "ZZ TEST zero/six" dipadam. Belum commit.
- Untuk membuang register/kasyer UJIAN yang bersejarah, jualan/shift ujian perlu dibersihkan dulu (SQL reset — menunggu pengesahan pemilik bahawa semua data POS setakat ini ialah ujian).

**9 Nov 2026 (malam) — RESET data ujian + dashboard jualan.**
- **Reset (diluluskan pemilik melalui soalan pilihan):** padam "Ujian Kasyer", "Ujian Manager", register `ZTEST`; kosongkan SEMUA transaksi POS setakat ini (25 jualan — semuanya void, jadi tiada stok perlu dipulangkan; 5 shift termasuk shift T1 yang terbuka; 5 tunai masuk/keluar; 3 DO; 2 baris stok outlet; 14 lejar; kaunter resit & DO → nombor bermula 0001 semula). Dijalankan melalui skrip service-role dengan pengawal "berhenti jika ada jualan bukan void". Sandaran penuh (termasuk hash PIN kasyer yang dipadam): `/private/tmp/pos-reset-backup-20261109.json` di mesin pemilik — bukan dalam repo. KEKAL: kasyer Anas, register T1 & T2 PKNS Bangi, outlet HQ & TST (TST tidak dipilih untuk dipadam; T2 masih dipaut kepadanya), senarai harga "PKNS Bangi", tetapan produk POS, akaun peranti `pos-t1`. T1 kini "Closed" — perlu Open store sebelum jual.
- **Dashboard jualan `/admin/pos` (ditulis semula):** baris penapis (Today · Yesterday · Last 7 days · Last 30 days · This month · julat tersuai ≤92 hari · outlet) menskop semua; jubin Revenue & Sales (dengan % vs tempoh sebelumnya), Average sale, Items sold (+ kg), Discounts given, Voided sales; carta lajur "Revenue by day" dan "Busiest hours" (satu warna, tooltip hover/fokus, togol Chart/Table); Top products (By revenue / By quantity, top 10 + Show all), By category, By payment method, By register, By cashier. `buildPosRangeReport` (`lib/pos/reports.ts`) + `GET /api/admin/pos/report`; `fetchAll` dieksport dari `shifts.ts`. Hasil = jualan paid sahaja; baldi masa KL. Disahkan di Chrome dengan 18 jualan contoh bertanda `DASH-TEST` (item timbang, tiada kesan stok) merentas 7 hari — kemudian dipadam semula; jadual transaksi kosong. Amaran "1 Issue" pada page = `fdprocessedid` extension Chrome (bukan pepijat). Belum commit.

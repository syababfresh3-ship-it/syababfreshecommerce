# Pelan: Pipeline Gift Kurma — CRM ringan untuk deal gift box (B2B)

Status: **DIBINA 25 Okt 2026 (belum commit, belum uji hujung-ke-hujung — menunggu pemilik jalankan migration 147)**. Fail: `supabase/147_gift_deals.sql`, `src/lib/gift-deals.ts`, `src/lib/gift-deals-server.ts`, `src/app/api/admin/gift-deals/**` (list, [id] GET/PATCH, payment, sync), `src/app/admin/gift-pipeline/**` (papan/senarai + panel), hook di issueQuotation/accept/invoice/cancel, medan `needed_by` di editor/PDF/pautan awam, sidebar GIFT STUDIO → Pipeline Gift, pautan "Buka deal" di editor sebut harga.

## Konteks & keputusan pemilik (24–25 Okt)
- Pipeline **khas gift kurma**; jangan campur Orders kedai buah. Invois yang dijana **jangan** masuk `orders`/`gift_orders`.
- Page & jadual **baharu**; unit = **deal** yang berpaut pada sebut harga website (+ invois Refrens).
- Bayaran: rekod rasmi di Refrens (Rekod bayaran) **dan** boleh **tanda manual** di website (tunai/transfer tanpa Refrens).
- Pemilik mahu SOP standard yang tak terlalu ketat sehingga tak terguna.

## SOP yang dicadangkan (7 peringkat + penutup) — dibetulkan 25 Okt: Invois SEBELUM Deposit
| # | Peringkat | Masuk bila | Apa yang direkod | Peringatan |
|---|---|---|---|---|
| 1 | **Sebut harga** | sebut harga dikeluarkan (auto) | nombor, jumlah, sah hingga; `accepted_at` jika klien tekan Accept (lencana, bukan peringkat) | tiada respons 3 hari → follow-up; luput 2 hari lagi |
| 2 | **Invois** | klien minta invois = tanda setuju → "Convert to Invoice" (auto bila invois Refrens dicipta) | invois Refrens, **No. PO/LO** (pilihan; klien korporat/kerajaan), fail PO | invois dihantar 5 hari, deposit belum masuk |
| 3 | **Deposit** | bayaran deposit masuk (auto dari Refrens / tanda manual) | % deposit (lalai 50; 0 untuk klien bayar 100% selepas hantar → langkau terus ke Artwork), tarikh, kaedah | — |
| 4 | **Artwork OK** *(gate yang selalu terlepas)* | admin tanda selepas klien sahkan mockup/die-line akhir | tarikh sah, fail mockup, nama pengesah | tarikh hantar < 14 hari tapi artwork belum sah |
| 5 | **Produksi** | admin tanda bila cetak/isi bermula | tarikh sasaran siap, nota pembekal kotak | sasaran siap > tarikh hantar |
| 6 | **Dihantar** | admin tanda (tarikh, cara: Lalamove/kurier/ambil sendiri, no. tracking, **foto POD / penerima**) | delivered_at, POD | — |
| 7 | **Baki dibayar** | bayaran baki (auto Refrens / manual) | tarikh, kaedah, rujukan | baki tertunggak 7 & 14 hari selepas hantar |
| ✓ | **Selesai** | baki lunas (auto) | — | 1 minggu: minta testimoni/foto; 60 hari sebelum Ramadan: ingat klien musim lepas |
| ✕ | **Batal / Kalah** | admin tanda, sebab wajib | sebab | — |

**Prinsip longgar:** peringkat ialah medan yang boleh ditukar ke mana-mana (tiada penguncian urutan); auto-advance hanya **maju**, tak pernah undur sendiri; setiap deal ada satu medan universal **"Tindakan seterusnya + tarikh"** — itu sahaja yang buat CRM terpakai hari-hari.

## Apa yang pemilik mungkin tak perasan (nilai sebenar)
1. **Artwork OK sebagai gate** — punca utama pertikaian (warna/logo salah) & kelewatan; satu tanda + fail mockup elak "saya tak lulus pun".
2. **No. PO/LO** — klien korporat/GLC/kerajaan selalu minta nombor PO di invois; tanpa ini bayaran tersangkut di akaun mereka.
3. **Foto POD + nama penerima** — bukti hantar untuk tuntut baki; simpan pada deal.
4. **Deposit boleh 0%** — tender/LO kerajaan bayar 100% selepas hantar; jangan paksa deposit.
5. **Follow-up sebut harga** — 683 sebut harga lama hampir semua "Created" tanpa tindak balas direkod; peringatan 3 hari + sebab kalah bagi data sebenar.
6. **Kitaran musim** — kebanyakan deal Ramadan; senarai klien musim lepas untuk dihubungi 60 hari awal.


## Tarikh perlu hantar (`needed_by`) — ditangkap awal, dipapar di mana-mana
1. **Ditanya masa sebut harga** (medan baharu "Tarikh perlu hantar" di editor sebut harga, bawah "Valid until"; pra-isi dari Studio RFQ `config.needed_by` bila ada). Sebab: lead time cetak ~2 minggu menentukan sama ada tarikh itu boleh dijanji — lebih baik tahu sebelum harga dipersetujui. Dicetak pada PDF sebut harga sebagai baris "Required delivery: <tarikh>" bila diisi. Lajur `quotations.needed_by date` (migration 147), disalin ke `gift_deals.needed_by` masa deal dicipta.
2. **Pada kad deal** sebagai kiraan hari ("12 hari lagi" / "lewat 3 hari"), papan boleh disusun ikut tarikh ini; boleh diubah bila-bila di panel deal (tarikh selalu berubah).
3. **Pemacu peringatan**: Artwork belum OK bila < 14 hari; sasaran produksi > tarikh ini; belum Dihantar pada tarikh ini → amaran merah.
Bukan tarikh invois dan bukan "due date" bayaran Refrens — dua benda berbeza.

## Data — `supabase/147_gift_deals.sql` (additive, idempotent)
```sql
create table if not exists public.gift_deals (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid unique references public.quotations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  client jsonb not null default '{}',                 -- snapshot (dari sebut harga)
  title text,                                         -- cth "Gift Box 200g × 300 — Rafulin Ramadan 2027"
  stage text not null default 'quote',                -- quote|invoice|deposit|artwork|production|delivered|balance|done|lost
  accepted_at timestamptz,                             -- klien tekan Accept (lencana)
  amount numeric(12,2) not null default 0,
  deposit_pct integer not null default 50,
  deposit_paid_at timestamptz, deposit_amount numeric(12,2), deposit_source text,   -- refrens|manual
  balance_paid_at timestamptz, balance_amount numeric(12,2), balance_source text,
  po_number text, po_file_url text,
  artwork_approved_at timestamptz, artwork_by text, artwork_file_url text,
  production_due date,
  needed_by date,                                      -- tarikh perlu hantar
  delivered_at timestamptz, delivery_method text, tracking_no text, pod_url text, received_by text,
  next_action text, next_action_at date,
  lost_reason text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists gift_deals_stage_idx on public.gift_deals (stage, next_action_at);
create table if not exists public.gift_deal_events ( id bigserial primary key, deal_id uuid not null references public.gift_deals(id) on delete cascade, type text not null, meta jsonb not null default '{}', actor text, created_at timestamptz not null default now() );
alter table public.quotations add column if not exists needed_by date;   -- tarikh perlu hantar (ditanya masa sebut harga)
-- RLS admin (corak 146)
```
Invois Refrens: dibaca dari `quotation_events` (`converted`/`invoice_synced`) melalui `quotation_id` — tiada pendua. Bayaran Refrens: `GET /invoices/:id/payments` masa Segarkan → isi `deposit_*`/`balance_*` jika kosong (manual menang, tak ditimpa).

## Automasi (hook additive, best-effort — gagal tak menghalang)
- `issueQuotation` → cipta deal (stage `quote`, amount, client, needed_by dari gift order jika ada).
- Accept awam → `accepted_at` (lencana, stage kekal `quote`). `[id]/invoice` (Convert to Invoice) → stage `invoice`. Bayaran deposit (Refrens/manual) → `deposit` (atau terus `artwork` jika deposit 0%). Cancel sebut harga → `lost` (sebab "sebut harga dibatalkan").
- Segarkan Refrens (deal) → bayaran: jumlah ≥ deposit → `deposit_paid`; lunas → `balance_paid` → `done`.
- Cron harian sedia ada (jika ada slot Hobby) **tidak** ditambah; peringatan dikira masa page dibuka (tiada kerja latar).

## API & UI
- `GET/PATCH /api/admin/gift-deals` (senarai ikut stage + ringkasan; patch medan manual + stage), `POST /api/admin/gift-deals/[id]/payment` (tanda manual {kind: deposit|balance, amount, date, method, ref}; pilihan "juga rekod di Refrens" → guna `recordPayment` sedia ada), `POST /api/admin/gift-deals/[id]/sync` (tarik bayaran Refrens).
- Page `/admin/gift-pipeline` (penuh): papan 7 lajur aktif + Selesai/Batal tersorok (stage) dengan kad (klien, jumlah, deposit/baki, tarikh hantar, tindakan seterusnya, lencana amaran) + togol senarai; panel sisi deal (semua medan di atas, pautan sebut harga/invois/PDF, sejarah). Mobile: senarai.
- Sidebar GIFT STUDIO → "Pipeline Gift" (ikon Kanban). Senarai Gift Orders & Studio **tidak diubah**; butang kecil "Buka deal" pada sebut harga.

## Tidak disentuh
`orders` kedai, `gift_orders`/Studio/enquiry, modul sebut harga & Refrens sedia ada (hanya hook tambah), affiliate WIP.

## Input pemilik
Sahkan nama peringkat; lalai deposit 50%; senarai sebab kalah; kaedah hantar (Lalamove, kurier, ambil sendiri); mahu lajur Artwork & Produksi dipaparkan (ya/tidak); jalankan migration 147 selepas kod siap.

- **Migration 148 (25 Okt malam, pemilik perlu jalankan):** `gift_deals.gift_order_id uuid unique` → deposit/baki web (CHIP) melahirkan/kemas kini deal automatik (`ensureDealForGiftOrderPayment` dipanggil dari webhook CHIP cawangan gift, best-effort); sebut harga dari enquiry yang sama berpaut pada deal sedia ada (tiada pendua). Kod toleran jika lajur belum ada.
- **Item picker (25 Okt malam):** `GET /api/admin/quotations/items?q=` (produk + varian harga semasa, kotak gift base_price, isi gift) → `ItemNameInput` dalam editor sebut harga & borang invois; pilih → nama, kadar, unit, keterangan.

- **Sales pemilik (25 Okt malam, migration 149 — pemilik perlu jalankan):** `gift_deals.owner_id` (lalai pengeluar sebut harga = `quotations.created_by`), `customers.owner_id` (sales pertama bawa klien, set sekali). Pipeline: penapis Semua sales / Deal saya / nama, chip inisial pada kad, lajur Sales, pilihan Sales di panel. Senarai staf dari `GET /api/admin/team`.
- **PIC pack (26 Okt, migration 150 — pemilik perlu jalankan):** `gift_deals.packer_id` (staf ditugaskan siapkan pek), `packer_assigned_at`, `packed_at` (pek siap), `pack_notes` (arahan pek). Berasingan dari sales pemilik. Pipeline: penapis Semua PIC pack / Tugasan pack saya / nama (`?packer=me|id`), chip inisial bergaris pada kad, lajur PIC pack, seksyen "PIC pack · siapa siapkan pek" di panel (pilih / butang Saya / pek siap / arahan). Tukar PIC → event `packer` + push web kepada PIC (`sendUserPush`, best-effort). Amaran: *PIC pack belum ditetapkan* (deposit→production, danger bila <7 hari), *Pek belum siap* (≤2 hari). Tanpa migration 150: simpan deal tanpa ubah pack kekal jalan (lajur dibuang automatik); set PIC → ralat minta jalankan migration 150.

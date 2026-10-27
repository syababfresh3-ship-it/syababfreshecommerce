# Pelan: Modul Sebut Harga (Quotation) dalam website — ganti Refrens

Status: **DIBINA & DIUJI hujung-ke-hujung 24 Okt 2026 (migration 146 dah dijalankan; belum commit)** — pemilik lulus ("boleh cuba bina"). Keputusan pemilik: siri **baharu** `STSB-Q<YYYY>-<####>` (tak sambung Refrens), Public Bank, sah 14 hari, e-Invois kemudian. Menunggu: pemilik hantar PNG cop (`public/brand/stamp-syabab-trading.png`) & logo pilihan (`public/brand/quotation-logo.png`, kini placeholder SyababFresh). PDF diuji tanpa DB (3 varian, 1 muka). Editor & senarai lebar penuh (pemilik minta) + mobile 390px disahkan; pautan awam mobile (item jadi kad), banner PWA disorok di /q/.

## Konteks

- Pemilik mahu sebut harga & invois dibuat dari website, "tanpa 3rd party macam Refrens" — terutama musim gift box akan datang.
- Refrens sekarang (akaun "Syabab Dates"): 683 sebut harga, siri `STSB2026xxxxx` (terakhir **STSB202601529**, 15 Okt 2026). Awalan tahun ditaip manual (ada `STSB2025…` untuk 2026, satu format lain `T0240302…`). Turutan 5 digit global (01522→01529). Lajur penerimaan & tarikh bayaran **tak dipakai** (semua "Created"). Volum rendah, nilai tinggi (RM2.5k–RM95k; klien korporat/agensi/universiti). Sebut harga bukan gift box sahaja — cth. 2 tan Medjool Jumbo + repackaging + transport (kurma borong).
- Refrens API sokong invois/pelanggan/bayaran tapi **tiada sebut harga** → bina sendiri paling tepat (lihat `project_einvois_decision`). e-Invois LHDN **ditangguh**; akaun Refrens ada badge "LHDN E-Invoicing" — pemilik belum sahkan sama ada e-Invois dihantar melalui Refrens.
- Kod sedia ada yang diguna semula: `@react-pdf/renderer` + `buildInvoiceElement` (`src/app/api/admin/resellers/invoice/[orderId]/invoice-pdf.tsx`) sebagai rujukan gaya, `requireAdmin`, `createAdminClient`, `sendCustomerInvoiceEmail` (corak), `customers` (`065`), `gift_orders` (`137`/`143`), panel `QuotePanel` + pay-link deposit/balance di `/admin/kurma/[id]`, `rateLimitDb`, `app_settings`.

## Keputusan reka bentuk

1. **Modul umum, bukan gift sahaja.** Baris item bebas (nama, keterangan, kuantiti, unit, kadar). Auto-isi dari `gift_orders` (dan kemudian permohonan borong) hanya sebagai pra-isi.
2. **Siri nombor baharu (keputusan pemilik 24 Okt):** `STSB-Q<YYYY>-<####>`, reset setiap tahun, dikira dari max dalam jadual (corak 088, cuba semula sekali jika bertembung). Nombor diberi masa **keluarkan** (issue), draf tiada nombor (elak lompang).
3. **Snapshot klien** disimpan dalam sebut harga (nama syarikat, no. SSM, TIN, alamat, PIC, email, telefon) — rekod tak berubah walau `customers` dikemas kini. `customers` ditambah lajur `company`, `company_reg_no`, `tin`, `billing_address` (additive; sedia untuk e-Invois nanti).
4. **Kunci selepas keluar.** Sebut harga yang dah dikeluarkan boleh diedit sehingga diterima/ditukar; selepas itu kunci → `Duplicate` untuk versi baharu, `Cancel` dengan sebab. Semua peristiwa masuk `quotation_events` (audit trail, acceptance history — sama konsep Refrens).
5. **Pautan kongsi awam** `/q/<token>`: klien lihat, muat turun PDF, tekan **Accept** (rekod nama + masa + IP, email admin). Tiada wang bergerak di situ; bayaran deposit kekal pautan CHIP sedia ada dari gift order.
6. **Bahasa PDF: English** (amalan semasa dengan klien korporat; 683 sebut harga lama English). Label BM = fasa kemudian jika perlu.
7. **Terma lalai 3 baris** (salin dari Refrens pemilik), boleh edit/susun per sebut harga; lalai boleh diubah di tetapan.
8. **Bank pada sebut harga:** Public Bank (seperti Refrens) — invois sedia ada guna Maybank; dua-dua dalam satu peta `BANKS`, pilih per dokumen.
9. **Jumlah dalam perkataan** (English, "… RINGGIT AND … SEN ONLY") — helper kecil sendiri.
10. **Import sejarah Refrens** = fasa 2 (skrip baca CSV "Download As"), rekod ditanda `legacy_source='refrens'`, baca sahaja.

## Urutan pelaksanaan

1. `supabase/146_quotations.sql` (jadual, sequence, fungsi nombor, lajur `customers`, RLS admin).
2. `src/lib/seller.ts` (butiran syarikat + `BANKS`), `src/lib/number-words.ts`, `src/lib/quotation.ts` (jenis, status, terma lalai, kira jumlah, pra-isi dari gift order).
3. API admin `/api/admin/quotations` (+ `[id]`, `[id]/pdf`, `[id]/email`, `[id]/issue`, `[id]/cancel`, `[id]/duplicate`, `[id]/convert`) + PDF `quotation-pdf.tsx`.
4. API awam `/api/q/[token]` (+ `/pdf`, `/accept`) & page `/q/[token]`.
5. Admin UI: `/admin/quotations` (senarai), `/admin/quotations/new`, `/admin/quotations/[id]`; sidebar KEWANGAN → "Sebut Harga"; butang "Sebut harga" di `/admin/kurma/[id]`.
6. Email ZeptoMail `sendQuotationEmail` (PDF lampiran + pautan `/q/<token>`).
7. Pengesahan; pemilik bekalkan cop & logo; jalankan migration 146 di SQL Editor.

## 1) Data — `supabase/146_quotations.sql` (idempotent, additive)

```sql
create sequence if not exists public.quotation_seq start 1530;   -- sambung STSB202601529
create or replace function public.generate_quotation_number() returns text language plpgsql as $$
begin return 'STSB' || to_char(now(), 'YYYY') || lpad(nextval('public.quotation_seq')::text, 5, '0'); end; $$;

create table if not exists public.quotations (
  id              uuid primary key default gen_random_uuid(),
  quote_number    text unique,                       -- null semasa draf
  status          text not null default 'draft',     -- draft|issued|accepted|rejected|expired|cancelled|converted
  issued_at       timestamptz, valid_until date,
  customer_id     uuid references public.customers(id) on delete set null,
  client          jsonb not null default '{}',       -- {company, name, reg_no, tin, address, email, phone, attn}
  source_type     text,                              -- gift_order | borong | manual | refrens
  source_id       uuid,                              -- gift_orders.id / resellers.id
  items           jsonb not null default '[]',       -- [{name, description, qty, unit, rate}]
  subtotal numeric(12,2) not null default 0, discount numeric(12,2) not null default 0,
  charges         jsonb not null default '[]',       -- [{label, amount}]
  total           numeric(12,2) not null default 0,
  currency        text not null default 'MYR',
  terms           text[] not null default '{}', notes text,
  show_bank       boolean not null default true, bank_key text not null default 'publicbank',
  custom_fields   jsonb not null default '[]',       -- [{label, value}]
  share_token     text unique,
  accepted_at timestamptz, accepted_by text, accepted_ip text,
  cancel_reason   text,
  legacy_source   text,                              -- 'refrens' untuk import
  created_by      uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists quotations_status_idx on public.quotations(status);
create index if not exists quotations_customer_idx on public.quotations(customer_id);
create index if not exists quotations_source_idx on public.quotations(source_type, source_id);

create table if not exists public.quotation_events (
  id bigserial primary key,
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  type text not null,                                -- created|issued|emailed|viewed|accepted|rejected|cancelled|converted|edited
  meta jsonb not null default '{}', actor text,
  created_at timestamptz not null default now()
);

alter table public.customers add column if not exists company text;
alter table public.customers add column if not exists company_reg_no text;
alter table public.customers add column if not exists tin text;
alter table public.customers add column if not exists billing_address text;
-- RLS: admin sahaja (corak 088_order_invoices)
```

Tiada view baharu → tiada isu `security_invoker`.

## 2) Lib

- `src/lib/seller.ts`: `SELLER` (nama, SSM baharu/lama, TIN, MSIC, alamat, PIC, email, telefon) & `BANKS = { maybank: {...}, publicbank: {...} }`. `invoice-pdf.tsx` **tidak diubah** (kekal const sendiri; selaraskan kemudian).
- `src/lib/number-words.ts`: `ringgitInWords(95400) → 'NINETY FIVE THOUSAND FOUR HUNDRED RINGGIT ONLY'` (+ sen).
- `src/lib/quotation.ts`: jenis `Quotation`, `QuotationItem`, `QUOTATION_STATUSES`, `DEFAULT_TERMS` (3 baris Refrens), `DEFAULT_NOTE`, `VALID_DAYS = 14`, `calcTotals(items, discount, charges)`, `quotationFromGiftOrder(order, catalog)` → klien + baris ("Custom Gift Box 200g — Ajwa AA, qty, RM/box", "Delivery", nota deposit %), `newShareToken()`.

## 3) API admin (`requireAdmin`, `runtime='nodejs'`)

| Laluan | Kaedah | Fungsi |
|---|---|---|
| `/api/admin/quotations` | GET | senarai: `?status=&q=&from=&to=`; ringkasan {count, total_quoted, accepted_count} |
| | POST | cipta (draf atau terus issue); `source_type=gift_order&source_id` → pra-isi |
| `/api/admin/quotations/[id]` | GET / PATCH / DELETE | butiran; edit (hanya draft/issued belum accepted); padam draf sahaja |
| `/api/admin/quotations/[id]/issue` | POST | beri nombor (`generate_quotation_number`), `issued_at`, `valid_until`, token kongsi, event |
| `/api/admin/quotations/[id]/pdf` | GET | PDF (`quotation-pdf.tsx`), nama fail `<nombor>.pdf` |
| `/api/admin/quotations/[id]/email` | POST | ZeptoMail ke klien (PDF + pautan `/q/<token>`), event `emailed` |
| `/api/admin/quotations/[id]/cancel` | POST `{reason}` | status cancelled |
| `/api/admin/quotations/[id]/duplicate` | POST | salinan draf baharu (nombor baharu bila issue) |
| `/api/admin/quotations/[id]/convert` | POST | gift order: tulis `total`/`deposit_pct` ke `gift_orders` (kira semula deposit/balance ikut logik PATCH sedia ada) + status `quoted`; status sebut harga `converted`. Invois = fasa 2 |

Pengesahan input: nama klien ≥2, ≥1 baris, qty>0, rate≥0, discount ≤ subtotal; semua nombor dikira semula di server.

## 4) Awam `/q/[token]`

- Page server (force-dynamic): papar sebut harga penuh (HTML, gaya sama PDF), butang **Download PDF** (`/api/q/[token]/pdf`) dan **Accept quotation** (nama + jawatan → `POST /api/q/[token]/accept`: `accepted_at/by/ip`, status `accepted`, event, email admin). Rate limit 10/min/IP, honeypot. Lihat → event `viewed` (sekali/jam/IP).
- `noindex`, token 32 hex; tamat tempoh → paparan "expired", Accept disorok.

## 5) Admin UI (ikon lucide monokrom, tiada emoji; lebar ikut AGENTS.md)

- **`/admin/quotations`** (`p-4 md:p-6`): kad ringkasan (jumlah sebut harga, nilai dikeluarkan, diterima), penapis status/carian klien/julat tarikh, jadual (tarikh, nombor, klien, jumlah, status, sah hingga, tindakan: lihat, PDF, email, salin pautan, duplicate). Butang "Sebut harga baharu".
- **`/admin/quotations/new` & `/[id]`** (`max-w-4xl`): pemilih klien (cari `customers` ikut nama/syarikat/telefon; atau isi manual → simpan juga ke `customers` jika telefon sah), tarikh & sah hingga, editor baris (tambah/buang/susun; keterangan di bawah nama; jumlah auto), diskaun & caj tambahan, jumlah + perkataan, bank (toggle + pilih), terma (senarai boleh edit), nota, medan tersuai. Tindakan: Simpan draf · Keluarkan · PDF · Email · Salin pautan · Duplicate · Batal · Tukar jadi quote gift order (bila `source_type=gift_order`). Panel kanan: sejarah peristiwa.
- **`/admin/kurma/[id]`**: butang "Sebut harga" dalam panel Quote & payment → cipta draf pra-isi & buka `/admin/quotations/[id]`; senarai sebut harga berkaitan order.
- Sidebar: seksyen KEWANGAN → `{ href: '/admin/quotations', label: 'Sebut Harga', icon: FileText }`.

## 6) PDF `quotation-pdf.tsx` (A4, Helvetica)

Header: logo kiri, "QUOTATION" + nombor + tarikh + valid until kanan · **From** (nama, SSM, TIN, alamat, email, telefon) / **For** (snapshot klien) · jadual (#, Item + description, Qty, Unit, Rate, Amount) · Subtotal/Discount/Charges/**Total (MYR)** + total in words · kotak bank (jika `show_bank`) · cop syarikat + "This is computer generated, no signature required" · **Terms and Conditions** bernombor · **Notes** · footer kontak. Status `cancelled` → watermark "CANCELLED".

## 7) Pengesahan

- `npx tsc --noEmit` + eslint fail baharu (JANGAN `next build` masa dev :3006 hidup).
- Migration 146 di SQL Editor **sebelum** uji (jadual tiada → API 500 yang jelas, bukan senyap).
- Dev: cipta draf manual → issue → nombor `STSB202601530` → PDF buka → `/q/<token>` papar & Accept → status `accepted` + event. Pra-isi dari gift order ujian sedia ada → convert → `gift_orders.status='quoted'`, deposit dikira. Email: **hanya** ke email pemilik sendiri dengan kebenaran (ZeptoMail = production).
- Mobile 390px untuk `/q/<token>`. Rekod ujian dipadam selepas.

## Tidak disentuh

Invois sedia ada (`order_invoices`, `reseller_invoices`, `invoice-pdf.tsx`, route invois), aliran & harga gift order, Studio, `/api/kurma/*`, Refrens (akaun kekal; pemilik berhenti guna untuk sebut harga baharu bila puas hati), e-Invois, WIP affiliate, migration 143/144/145 (masih pending pemilik).

## Input pemilik sebelum mula

1. Fail PNG **cop syarikat** (bulat biru) & pilihan **logo** PDF: "SYABAB" merah jambu (Refrens) atau SyababFresh.
2. Sahkan nombor terakhir Refrens masa migrasi dijalankan (kalau ada sebut harga baharu selepas 01529, ubah `start`).
3. Bank lalai pada sebut harga: Public Bank (ya/tidak).
4. Tempoh sah lalai (cadangan 14 hari).
5. e-Invois: melalui Refrens sekarang atau belum? (menentukan fasa 2 invois).
6. Eksport CSV Refrens (sebut harga + klien) bila mahu sejarah diimport (fasa 2).

## Fasa 2 (bukan sekarang)

Invois dari sebut harga (siri INV sedia ada), resit bayaran, import CSV Refrens, kumpulan baris, lampiran, ~~hantar WhatsApp~~ (DIBINA 27 Okt 2026 — lihat bawah), pra-isi dari permohonan borong, label BM.

## Hantar WhatsApp / email (27 Okt 2026)

Pemilik: "button terus wasap quot, invois, dan email" + "buat je offi dan unoffi, team sale boleh pilih" (klien lama PM akaun lama) + "buat je ketiga-tiga sekali" (termasuk template Meta). Dibina: `src/lib/doc-send.ts` (muatan dokumen + teks lalai BM; perbualan inbox ikut wa_id; hantar Official = `sendMedia` dokumen + kapsyen, log `wa_messages`/`wa_conversations` seperti `/api/whatsapp/send`; template Meta = parameter {{1}} nama, {{2}} nombor, {{3}} jumlah, {{4}} pautan, header DOCUMENT = PDF; wa.me = pautan pra-isi), `sendInvoiceEmail` (ZeptoMail, PDF Refrens dilampirkan bila dapat dimuat turun), API `/api/admin/quotations/[id]/send` (GET pra-isi, POST hantar; event `whatsapped`/`invoice_whatsapped`/`emailed`/`invoice_emailed`; template lalai disimpan `app_settings.wa_doc_tpl_<doc>`), dialog `send-doc-dialog.tsx` (editor sebut harga: WhatsApp / Email / WhatsApp invois / Email invois; panel deal Pipeline: Hantar sebut harga / Hantar invois). PDF sebut harga untuk Meta = URL awam `/api/q/<token>/pdf`. Had: mesej bebas Official perlu tetingkap 24 jam; template perlu kelulusan Meta (draf di `docs/wa-template-dokumen.md`); senarai template dari WABA utama (env).


## Fasa 2 (DIBINA 24 Okt 2026 petang) — invois Refrens dari sebut harga

- `src/lib/refrens.ts`: token app-secret (cache ikut `exp`), `findClient` (email/telefon, `/api/v1/businesses/:urlKey/clients`), `createClient` (country MY, TIN → `tinNumber`, SSM → `additionalIds BRN`; fallback tanpa medan pilihan bila 400), `invoicePayloadFromQuotation` (billedTo+contact, items `name — description`, diskaun/caj → `additionalCharges FIXED_AMOUNT ±1`, terms `[{label, terms[]}]`, `invoiceSubTitle: Ref: Quotation <no>`, dueDate +14 hari, MYR, invoiceType INVOICE), `createInvoice`, `getInvoice`, `listInvoices`.
- `POST /api/admin/quotations/[id]/invoice` (`?dry=1` = payload sahaja, tiada tulisan) → pastikan klien di Refrens → cipta invois → status `converted` + event `converted {invoice:{id,number,status,total,pdf,link}}`. `GET` → segarkan dari Refrens (event `invoice_synced` jika berubah). **Rujukan disimpan dalam `quotation_events`, tiada migration baharu.**
- Editor: butang "Jadi invois" (issued/accepted, dua langkah) + panel "Invois Refrens" (nombor, status, jumlah, PDF, pautan klien, Segarkan). `GET [id]` pulang `invoice` & `refrens_configured`.
- Ujian baca sahaja lulus (auth, senarai 1953 dokumen — endpoint `/invoices` memulangkan SEMUA jenis dokumen termasuk sebut harga STSB2026…; `share` tiada dalam senarai, hanya create/get). **Cipta invois sebenar BELUM diuji** (tiada sandbox; nombor siri invois Refrens cth 2600032277 akan auto-sambung). Env REFRENS_* ada di `.env.local`, **belum di Vercel**.
- Tidak disentuh: aliran sebut harga fasa 1, invois web/reseller sedia ada, Refrens UI.

- **Senarai invois (24 Okt petang):** lajur "Invois" di senarai Sebut Harga (rujukan dari `quotation_events`, dilampirkan oleh `GET /api/admin/quotations`) + page `/admin/invoices` ("Invois Refrens", KEWANGAN) baca sahaja dari `GET /api/admin/refrens/invoices` → `searchDocuments` (penapis Feathers disahkan: `billType`, `status` [UNPAID|PARTIAL|PAID|CANCELED], `invoiceNumber[$regex]`, `billedTo.name[$regex]`, `$limit/$skip/$sort`; `$select` merosakkan `finalTotal` → jangan guna; `q`/`$search` tidak disokong). 1,144 invois + 683 sebut harga + lain = 1,953 dokumen. Invois PAID lama sesetengahnya `finalTotal.total = 0` → paparan guna jumlah bayaran. Pautan buka: `https://www.refrens.com/app/<urlKey>/invoices/<_id>` (corak diteka dari URL sebut harga — sahkan).

- **Tindakan Refrens (24 Okt malam):** `/admin/invoices/new` (`invoice-form.tsx`) cipta invois terus di Refrens (`POST /api/admin/refrens/invoices`, `?dry=1` diuji: payload & jumlah betul; klien dipastikan via `ensureClient`, pilihan Refrens email klien masa cipta). Senarai: butang **Rekod bayaran** (`POST …/[id]/payments` → `POST /businesses/:urlKey/invoices/:id/payments` {amount, paymentDate, paymentMethod ACCOUNT_TRANSFER|CASH|CHEQUE|CREDIT_CARD|DEBIT_CARD, refId, notes}, Idempotency-Key) dan **Batal** (`POST …/[id]/cancel` → `PATCH …/invoices/:id?cancelPayment=` {status:'CANCELED'}). Edit kandungan invois & email semula TIADA dalam API → buka di Refrens. **Cipta/bayaran/batal sebenar belum diuji** (tulis ke akaun sebenar).

- **Borang gaya Refrens (24 Okt malam):** `/admin/invoices/new` disusun ikut borang Refrens (title/subtitle, Invoice No auto + "Last No", Invoice Date, Due date, Billed By baca sahaja, Billed To: Select a Client / Add New Client, jadual Item·Code·Quantity·Unit·Rate·Amount + Add Description, bank baca sahaja, Add Discounts / Additional Charges, Total in words, nota, terma, Save & Continue / Save & Create New). `createInvoiceSmart`: cuba payload kaya (`description`, `unit`, `notes` — tidak didokumen) → 400 → ulang payload selamat (gabung ke nama). Dry-run kedua-dua payload OK.

- **Pilihan 1 pemilik (24 Okt malam) — nombor dari Refrens:** `issueQuotation` kini cipta sebut harga di Refrens dulu (`billType: 'QUOTATION'`, endpoint invois sama — disahkan sokongan Refrens) → `invoiceNumber` Refrens (siri lama STSB2026…) jadi `quote_number` website; event `refrens_quotation {quotation:{id,number,pdf,link}}`. Refrens gagal → keluarkan GAGAL dengan mesej (tiada nombor tempatan senyap). Tanpa env Refrens (preview/dev lain) → siri tempatan `generate_quotation_number` kekal. Batal website → batal salinan Refrens best-effort. Terima/tolak hanya di website (API Refrens tak boleh ubah status sebut harga; tukar jadi invois = app Refrens sahaja). `POST [id]/issue?dry=1` → payload Refrens sahaja. Jawapan Refrens 24 Okt: tiada webhook, token app-secret 24 jam, custom fields via API, LHDN manual di app, harga API bergantung volum (12 bulan: 365 invois, 217 sebut harga, 260 bayaran; bermusim Ramadan).

- **Editor sebut harga gaya Refrens (24 Okt malam):** `quotation-editor.tsx` ditulis semula ikut borang "Create New Quotation" Refrens — Quotation No (auto, "Last No" dari siri Refrens), Quotation Date, Valid until, Add Custom Fields, Quotation From/For (Select a Client / Add New Client), jadual Item·Code·Quantity·Unit·Rate·Amount + Add Description, bank (toggle + pilih akaun), Add Discounts/Additional Charges, Total in words, cop, Notes, Terms, butang Save As Draft / Save & Continue (= keluarkan → Refrens). Fungsi lama kekal (PDF, Email, Share link, Duplicate, Convert to Invoice, Apply ke gift order, Cancel, Delete, sejarah).

## Seterusnya (pemilik 24 Okt malam, belum dibuat)

1. **Item picker**: nama item dalam sebut harga/invois dicadangkan dari katalog website (`products`/`product_variants` + katalog gift & harga sheet) — pilih → nama, unit, kadar terisi; manual kekal boleh.
2. **CRM gift box**: pipeline quotation → invois Refrens → deposit → tarikh perlu hantar → dihantar → bayaran baki → delivered. Bina atas `gift_orders` (status/payment_status/deposit/balance/pay-link CHIP) + sebut harga berpaut + invois Refrens; tambah tarikh perlu hantar, papan pipeline, peringatan baki, delivered_at.

- **Picker klien + Refrens (25 Okt malam):** `/api/admin/quotations/customers` gabung pangkalan data website + carian langsung klien Refrens (`GET /api/v1/businesses/:urlKey/clients?q=` — balasan `{success, data:{items,total,limit,skip}}`, 922 klien; `name[$regex]` TIDAK disokong). Hit Refrens bertanda, `customer_id` null; heuristik nama organisasi (SDN BHD/HOLDINGS/MAJLIS…) → medan syarikat. **Pembetulan penting:** `findClient` dulu salah baca bentuk balasan (sentiasa null → akan cipta klien pendua di Refrens) — kini `clientItems()`. Page Gift Orders → **Enquiry Gift** (peti enquiry web; tab Baru / Dah sebut harga / Bayar online / Semua / Ditutup; butang "Buat sebut harga" setiap baris); kerja selepas sebut harga di Pipeline Gift. Import penuh klien Refrens (922) = kerja kemudian (kunci telefon; klien tanpa telefon perlu kunci ganti).

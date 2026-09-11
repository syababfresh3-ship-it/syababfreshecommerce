# Inventori Cron — semua automation berjadual

11 cron, semua Bearer `CRON_SECRET`. Hanya 2 dijadual Vercel (had Hobby);
9 lagi bergantung **cron-job.org** (akaun luar — TIADA dalam repo, senarai ini
satu-satunya rekod). Setiap cron stamp `cron_heartbeats` (109) bila siap;
dashboard admin papar **"CRON SENYAP"** bila stamp lewat > 3× selang jangkaan.

| Job | Endpoint | Fungsi | Jadual | Penjadual |
|---|---|---|---|---|
| abandoned-cart | `/api/cron/abandoned-cart` | Push reminder troli ditinggal 2j | 09:00 harian | **Vercel** |
| reconcile-payments | `/api/cron/reconcile-payments` | Safety net bayaran CHIP terlepas | 01:00 harian | **Vercel** |
| auto-followup | `/api/cron/auto-followup` | Nudge WA chat senyap belum beli | tiap 30 min | cron-job.org |
| blast-drain | `/api/cron/blast-drain` | Drain campaign WA Blast (ReplyLa) | tiap ~15 min | cron-job.org |
| wa-outbox-drain | `/api/cron/wa-outbox-drain` | Drain queue WA outbox (12/tick) | tiap ~15 min | cron-job.org |
| auto-deliver | `/api/cron/auto-deliver` | delivering→delivered lepas N hari + kredit loyalty/referral/affiliate | harian | cron-job.org |
| external-sync | `/api/cron/external-sync` | Sync pembeli TikTok dari ops app → contacts (balas 200 serta-merta, kerja sambung di `after()`; `?dry=1` untuk kiraan sahaja) | harian (03:00) | cron-job.org |
| payment-reminder | `/api/cron/payment-reminder` | Email order FPX belum bayar 1-24j | tiap ~2 jam | cron-job.org |
| refresh-customers | `/api/cron/refresh-customers` | Kira semula agregat customer (spend/recency) | harian, lepas 01:00 | cron-job.org |
| voucher-reminder | `/api/cron/voucher-reminder` | Email voucher peribadi luput ≤7 hari (sekali/voucher) | harian (~10:00) | cron-job.org |
| daily-summary | `/api/cron/daily-summary` | Ringkasan semalam ke admin: jualan SF+LP, top produk, COD tertunggak, pending, stok rendah, batch luput, refund, cron senyap, ralat storefront (WA + push + email) | 08:30 harian (MYT) | cron-job.org |
| abandoned-checkout | `/api/cron/abandoned-checkout` | Email pemulihan troli terbengkalai (Sprint 3F, EMAIL sahaja): email 1 selepas 1j, email 2 selepas 24j, sekali per peringkat, hormat nyah-langgan | tiap 30 min | cron-job.org |

## Bila dashboard tunjuk "CRON SENYAP"

1. Log masuk **cron-job.org** → semak job tu: disabled? failing? (History)
2. Kalau 401 dalam history → `CRON_SECRET` di header tak padan dengan Vercel env.
3. Kalau job hilang → cipta semula: GET endpoint di atas + header `Authorization: Bearer <CRON_SECRET>`.
4. Log server: Vercel → project → Logs, tapis path `/api/cron/...`.

## Nota selang jangkaan

Selang jangkaan disimpan dalam `cron_heartbeats.expected_minutes` (seed di
migration 109). Kalau ubah jadual di cron-job.org, kemas kini nilai ni terus
di DB supaya alert tak salah bunyi:

```sql
update cron_heartbeats set expected_minutes = 60 where job = 'auto-followup';
```

## daily-summary — cara setup & uji

Laporan dibina oleh `src/lib/daily-summary.ts` (fungsi tulen, boleh diuji);
endpoint `src/app/api/cron/daily-summary/route.ts` hantar ke:

- WhatsApp admin (`ADMIN_WHATSAPP`, via Murpati `sendWhatsApp`) — teks ≤1500 aksara
- Push admin (`sendAdminPush`, tag `daily-summary`, buka `/admin`)
- Email (`ADMIN_EMAIL` — **pilihan**; tak diset = skip senyap)

Heartbeat `daily-summary` (expected 1440 min) di-seed oleh migration 124.

**cron-job.org** (waktu Asia/Kuala_Lumpur):

- URL: `https://shop.syababfresh.my/api/cron/daily-summary`
- Method: GET · Jadual: 08:30 harian
- Header: `Authorization: Bearer <CRON_SECRET>`

**Uji tanpa hantar apa-apa** (`dry=1` = tak hantar WA/push/email, tak stamp heartbeat):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3006/api/cron/daily-summary?dry=1" | jq .text -r
```

Pilihan `?date=YYYY-MM-DD` untuk laporan hari KL tertentu (default: semalam).
Bahagian "Ralat semalam" datang dari `error_reports` (migration 124) — sebelum
migration dijalankan ia dipapar "tidak tersedia", bukan gagal.

## abandoned-checkout — cara setup & uji (Sprint 3F)

Pemulihan troli terbengkalai **EMAIL SAHAJA** (keputusan pemilik: tiada WhatsApp).
Cron push lama `abandoned-cart` (Vercel, 09:00) **tidak disentuh** — dua-dua boleh
hidup serentak (push = member login sahaja; email = semua yang isi email di checkout).

Aliran:

1. `/checkout` tangkap email + snapshot troli → `checkout_sessions` (migration **128**,
   `POST /api/store/checkout-session`, debounce 1.5s + sebelum order dicipta).
2. Order masuk (`/api/orders`, `/api/store/guest-order`) → sesi ditanda `recovered_at`.
3. Cron ini pilih sesi belum pulih, belum nyah-langgan, email tiada dalam
   `email_suppressions`, tiada order email/telefon sama sejak sesi dicipta:
   - **Email 1** "Troli anda masih menunggu" — `last_seen_at` 1–23 jam lalu
   - **Email 2** "Masih berminat? Stok bergerak pantas" — 24–72 jam lalu, selepas email 1
   Claim atomik (`update … where … is null`) sebelum hantar → tak double. Had 50/run.
4. Pautan email: `/checkout?recover=<token>` (pulih troli, sah 7 hari) dan
   `/api/store/checkout-session/unsubscribe?token=<token>` ("Tak mahu peringatan ini").

Heartbeat `abandoned-checkout` (expected 30 min) di-seed oleh migration 128.

**Prasyarat**: jalankan `supabase/128_checkout_sessions.sql` di Supabase SQL Editor.
Sebelum itu semua endpoint di atas no-op senyap (cron balas `note: Migration 128 … belum dijalankan`).

**cron-job.org** (waktu Asia/Kuala_Lumpur):

- URL: `https://shop.syababfresh.my/api/cron/abandoned-checkout`
- Method: GET · Jadual: **tiap 30 minit** (`*/30 * * * *`)
- Header: `Authorization: Bearer <CRON_SECRET>`
- Timeout: 30s (cukup — had 50 email/run)

**Uji tanpa hantar apa-apa** (`dry=1` = senarai calon sahaja, tiada claim, tiada heartbeat):

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3006/api/cron/abandoned-checkout?dry=1" | jq .
# abaikan tetingkap masa (diagnostik; dry sahaja):
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3006/api/cron/abandoned-checkout?dry=1&force=1" | jq .
```

Nota: `.env.local` menyambung ke DB + ZeptoMail **production** — jangan panggil
tanpa `dry=1` di local melainkan memang mahu hantar email sebenar.

## external-sync — kenapa ia pernah "senyap" (dibaiki 11 Sep 2026)

`manage.syababfresh.my/api/sync` pulangkan **18 MB / ~38k pelanggan** dan ambil
**~40 saat**. Had timeout cron-job.org ialah 30 saat, jadi job sentiasa dilapor
gagal; invocation pula tak sempat habis kerana selepas fetch ia menghantar SEMUA
38k baris (75+ panggilan RPC, plus ~150 lagi untuk tag wa_contacts). Akibatnya
`stampHeartbeat` tak pernah dipanggil — dashboard tunjuk "CRON SENYAP" walaupun
`last_error` kosong.

Dua pembetulan:

1. **Balas dahulu, kerja kemudian** — handler pulangkan `{ ok: true, started: true }`
   serta-merta dan sambung kerja dalam `after()` (Next 16). cron-job.org tak lagi
   timeout. Heartbeat dicop bila kerja betul-betul siap. `maxDuration` 300s.
2. **Hantar yang berubah sahaja** — baca `external_customers` sedia ada dahulu,
   banding, dan upsert baris yang berbeza sahaja. Dalam praktik ~20 baris sehari
   berbanding 37k. Tag `wa_contacts` pun hanya untuk baris yang berubah.

Uji tanpa menulis apa-apa:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  'https://shop.syababfresh.my/api/cron/external-sync?dry=1'
# {"ok":true,"dry":true,"total":37280,"unchanged":37263,"ms":20830}
```

Nota: `stampHeartbeat` tidak mengosongkan `last_error`, jadi ralat lama boleh
kekal dalam baris walaupun job sudah sihat. Dashboard & ringkasan harian hanya
baca `last_ok_at`, jadi ia tidak menjejaskan amaran.

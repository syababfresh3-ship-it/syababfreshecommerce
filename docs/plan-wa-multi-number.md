# Pelan: Handle DUA (atau lebih) Nombor WhatsApp Official (CRM)

> **Status: DIRANGKA, BELUM DIBINA.** Disimpan untuk rujukan masa depan.
> Matlamat: 1 nombor 1 team sale — setiap nombor diuruskan salesperson berbeza.
> Reka bentuk **additive + backward-compatible** (nombor sedia ada jadi lalai).

Tarikh rangka: 2026-06-20 · Projek: syababfresh (storefront) · Branch: crm-fasa-a

---

## 1. Keadaan SEKARANG (single-number)
- `src/lib/whatsapp-cloud.ts` hantar guna SATU `process.env.WHATSAPP_PHONE_NUMBER_ID`.
- `src/app/api/whatsapp/webhook/route.ts` **tak tangkap** `metadata.phone_number_id`
  (nombor mana customer hubungi).
- Kesan kalau tambah nombor tanpa kod: **balas dari nombor salah** + **inbox campur**.

## 2. Prasyarat Meta (ko buat di business.facebook.com)
1. WhatsApp Manager → WABA → **Add phone number** (nombor baru, belum ada di app WhatsApp).
2. Verify (SMS/panggilan) → set display name → kelulusan Meta.
3. Salin **`phone_number_id`** nombor baru.
4. **Token & webhook:** WABA sama → token System User sedia ada akses semua nombor;
   webhook di peringkat WABA → automatik terima mesej nombor baru (dengan `metadata.phone_number_id`).
   (Kalau nombor di WABA BERLAINAN → perlu token sendiri + config webhook berasingan.)

## 3. Realiti WhatsApp (penting)
- Setiap nombor = **window 24j + conversation sendiri**. Mesti balas dari nombor yang
  customer hubungi. Customer yang mesej dua nombor = dua conversation berasingan (normal).
- Salesperson 2 **cuma handle customer yang hubungi NOMBOR 2** → route via link/iklan nombor 2.

## 4. Skema (migration baru, cth 084) — additive
- Jadual `wa_numbers`:
  `phone_number_id text primary key`, `display_name text`, `owner uuid → profiles(id)`
  (salesperson pemilik), `token text` (nullable; null = guna env default),
  `is_active bool`, `is_default bool`, `created_at`. **Seed dengan nombor sedia ada** (is_default=true).
- `wa_conversations`: tambah `phone_number_id text` (nombor mana conversation ni).
- (Pilihan) `wa_messages`: tambah `phone_number_id text` untuk kelengkapan.

## 5. Perubahan kod (additive, backward-compatible)
1. **`whatsapp-cloud.ts`** — `sendText`/`sendTemplate` terima param `phoneId?` (lalai = env).
   Token: lookup dari `wa_numbers` ikut phoneId, fallback env. Tiada laluan sedia ada pecah.
2. **Webhook** — tangkap `value.metadata.phone_number_id`:
   - Tambah `metadata` ke type `WaWebhookBody`.
   - Simpan `phone_number_id` pada `wa_conversations` (cipta/kemas).
   - **Auto-assign** conversation ke `owner` nombor itu (guna `assigned_to` sedia ada) →
     terus selesai "siapa pegang customer".
3. **Hantar dari nombor betul** — bila balas (inbox reply / auto-reply / order-paylink),
   guna `phone_number_id` conversation tu. Conversation lama tanpa nilai → guna default.
4. **Inbox** — tambah penapis "Semua Nombor / Nombor A (Salesperson X) / Nombor B (Y)"
   (macam dropdown label) + papar nombor pada setiap conversation. Gabung dengan assignment.
5. **Admin settings** — UI urus `wa_numbers` (tambah nombor, set pemilik, aktif/lalai).
6. **(Pilihan) Blast** — pemilih "hantar dari nombor mana" (template boleh dari mana-mana
   nombor WABA; window 24j tak relevan untuk template).

## 6. Fasa pembinaan
1. **Migration** — `wa_numbers` (seed nombor sedia ada) + kolum `phone_number_id` pada conversations.
   Tiada kelakuan berubah.
2. **whatsapp-cloud.ts** — param `phoneId` (lalai env). Additive.
3. **Webhook** — tangkap phone_number_id → simpan + auto-assign owner.
4. **Outbound** — balas/hantar dari phone_number_id conversation.
5. **Inbox** — penapis + papar nombor.
6. **Admin** — urus nombor + pemilik.
7. **(Pilihan)** Blast from-number selector.

## 7. Risiko & mitigasi
- **Balas dari nombor salah** → tangkap phone_number_id + hantar dari nombor betul (Fasa 3–4);
  lalai env supaya selamat semasa transisi.
- **Nombor tak dikenali masuk webhook** → log + fallback default, jangan crash.
- **Customer mesej dua nombor** → dua conversation (normal WhatsApp); papar nombor supaya jelas.
- **WABA berlainan** → token + webhook berasingan (luar skop asas; tangani bila perlu).

## 8. Alternatif lebih murah (kalau matlamat sebenar berubah)
Kalau cuma nak **orang lain handle inbox** (bukan nombor berasingan) → guna **assignment satu
nombor** sahaja (filter "Sembang Saya" + claim, guna `assigned_to` + `send/route.ts:91` yang
auto-assign bila reply pertama). Tiada Meta, tiada multi-number. Lihat cadangan inbox assignment.

## 9. Keputusan tertunggak (bila nak bina)
- Nombor ke-2 dalam WABA sama atau berlainan? (tentukan token/webhook)
- Auto-assign ke owner tetap, atau round-robin/claim?
- Inbox: asing penuh per-nombor, atau satu inbox + penapis?

---

**Untuk hidupkan nanti:** tambah nombor di Meta (seksyen 2) → daftar dalam `wa_numbers` →
mula Fasa 1. Semua additive + lalai ke nombor sedia ada, jadi selamat dibina berperingkat
tanpa menjejaskan operasi single-number sekarang.

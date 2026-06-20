# Pelan: AI Chatbot untuk Inbox WhatsApp Official (CRM)

> **Status: DIRANGKA, BELUM DIBINA.** Disimpan untuk kegunaan masa depan.
> Prinsip teras: **OFF secara lalai** — dibina tapi dorman; hanya aktif bila admin
> hidupkan toggle. Tiada auto-reply sehingga sengaja di-"on".

Tarikh rangka: 2026-06-19 · Projek: syababfresh (storefront) · Branch: crm-fasa-a

---

## 1. Matlamat
Tambah AI chatbot yang boleh balas customer dalam **Inbox WhatsApp CRM** menggunakan
**WhatsApp Official (Cloud API)**, reuse otak AI sedia ada (`src/lib/support/agent.ts`,
Claude `claude-haiku-4-5`). Mesti boleh dihidup/matikan tanpa risiko balas tak sengaja.

## 2. Boleh ke atas WA Official? — Ya, dalam tetingkap 24 jam
- **Dalam 24j** selepas customer mesej → boleh hantar teks bebas (balasan AI). ✅
- **Luar 24j** → WA Official cuma benarkan template diluluskan (bukan AI free-form). ❌
- Ini padan dengan chatbot inbox: AI balas hanya semasa customer aktif berbual.

**Infra sedia ada (tak perlu bina baru):**
- Tetingkap 24j dijejak: `wa_conversations.window_expires_at` (webhook reset tiap mesej masuk).
- Hantar teks bebas: `sendText()` dalam `src/lib/whatsapp-cloud.ts`.
- Mesej masuk diterima: `src/app/api/whatsapp/webhook/route.ts` (`handleInbound`).
- Otak AI: `src/lib/support/agent.ts` (+ `tools.ts`, `knowledge.ts`).

## 3. Suis utama (kill switch) — WAJIB
- Tambah tetapan `app_settings`:
  - `ai_chatbot_enabled` = `'false'` (lalai) — induk on/off.
  - `ai_chatbot_mode` = `'draft'` — `auto` | `draft` | `faq`.
  - `ai_chatbot_hours` (pilihan) — cth hanya luar waktu pejabat.
- Webhook semak flag ni **paling awal**; kalau off → tak buat apa-apa (kelakuan sekarang).
- UI toggle di `/admin/crm` (atau settings) untuk hidup/matikan + pilih mod.

## 4. Mod kelakuan (boleh tukar tanpa deploy)
| Mod | Apa jadi | Cadangan mula |
|---|---|---|
| `faq` | AI balas soalan biasa sahaja (kos, kawasan, cara order); lain → serah team | ✅ Paling selamat |
| `draft` | AI sedia **draf** balasan; team sahkan & hantar (butang dalam inbox) | ✅ Kawalan tinggi |
| `auto` | AI balas customer terus | Hanya bila dah yakin |

## 5. Guard wajib (semua mod)
Sebelum AI balas/draf, semak SEMUA:
1. **Flag on** (`ai_chatbot_enabled`).
2. **Dalam tetingkap 24j** (`window_expires_at > now`) — jika tidak, langkau (atau tag untuk template).
3. **Tak di-assign ke manusia** (`wa_conversations.assigned_to IS NULL`) — elak AI langkah team
   yang sedang pegang customer (selaras isu "team sale bergaduh customer").
4. **Tak opt-out** (`wa_contacts.opt_out = false` DAN tiada dalam `crm_suppressions`).
5. **Bukan dari sumber yang team uruskan** (cth reseller) — pilihan.
6. **Escalation** — jika customer taip "nak cakap dgn orang/admin/manusia" atau AI tak yakin →
   jangan balas, tag conversation + tinggi-kan unread untuk team.

## 6. Skema (additive — migration baru, cth 083)
- `wa_messages`: tambah `ai_generated boolean default false`, `ai_status text` (`draft`|`sent`|`skipped`).
  (Untuk bezakan balasan AI vs manusia + simpan draf.)
- `app_settings`: kunci-kunci di seksyen 3.
- (Pilihan) `crm_ai_log` — audit setiap panggilan AI (input ringkas, output, kos token, sebab skip).

## 7. Fail untuk ditambah (additive, ikut peraturan)
- `src/lib/ai-chatbot.ts` (baru) — `maybeReply(sb, conversation, inboundText)`:
  semak semua guard → panggil agent → ikut mod (hantar / simpan draf / skip).
- Webhook: +beberapa baris dalam `handleInbound` → `await maybeReply(...)` (best-effort,
  gagal senyap supaya tak pecahkan webhook). Hanya jalan bila flag on.
- (Mod draft) UI inbox: papar draf AI + butang "Hantar" / "Edit" / "Buang".
- Settings UI: toggle on/off + pilih mod.
- `src/lib/support/agent.ts`: reuse; mungkin tambah persona/knowledge khusus WhatsApp (pendek,
  bahasa santai, sertakan CTA order). Boleh guna param baru tanpa ubah laluan /bantuan.

## 8. Fasa pembinaan (bila ko dah sedia "on")
1. **Fasa 1** — Migration (flags + ai_generated). Suis off. Tiada kelakuan berubah.
2. **Fasa 2** — `ai-chatbot.ts` + guard + webhook hook (mod `faq` dulu). Test ke nombor sendiri.
3. **Fasa 3** — UI settings (toggle + mod) + (mod draft) butang draf di inbox.
4. **Fasa 4** — Audit log + metrik (berapa dibalas AI, escalation rate, kos).
5. **Hidupkan** — set `ai_chatbot_enabled=true`, mula mod `faq`/`draft`, pantau, naik ke `auto` bila yakin.

## 9. Kos (anggaran, claude-haiku-4-5: $1/1M in, $5/1M out)
- ~1 balasan = ~1–2K token input (knowledge+chat) + ~150 token output ≈ **~RM0.01–0.015/balasan**.
- Volume tinggi (cth 500 balasan/hari) ≈ ~RM5–8/hari. Murah; haiku cukup, tak perlu sonnet/opus.
- Caching prompt (knowledge tetap) boleh turunkan kos lagi.

## 10. Risiko & mitigasi
- **AI silap pada customer sebenar** → mula mod `draft`/`faq`, escalation ketat, suis off mudah.
- **Langkah team sale** → guard `assigned_to` (poin 5.3).
- **Spam/ban WA** → hanya balas dalam window + dalam respons kepada mesej masuk (bukan blast).
- **Halusinasi harga/stok** → bekalkan fakta sebenar via tools (`tools.ts`) atau knowledge terkini;
  jangan biar AI reka harga.

## 11. Keputusan tertunggak (bila nak bina)
- Mod permulaan: `faq` atau `draft`?
- Sumber jawapan: produk + harga + kawasan + tracking? (tentukan knowledge/tools)
- Waktu aktif: 24/7 atau luar waktu pejabat sahaja?
- Persona: bahasa/nada (santai Melayu + CTA order)?

---

**Untuk hidupkan nanti:** buka isu/tugas baru rujuk dokumen ni, mula Fasa 1. Semua reka bentuk
additive + off-by-default, jadi selamat dibina awal tanpa menjejaskan inbox sedia ada.

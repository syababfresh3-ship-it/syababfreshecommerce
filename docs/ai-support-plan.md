# Plan: AI Customer Support — Aduan Buah & Refund Self-Service

> Status: **DIRANGKA** (belum mula bina). Dikemas 2026-06-04.
> Konteks: CS lambat balas, customer ada masalah (buah reput/lebam/hilang/lambat).
> Matlamat: customer boleh selesai sendiri 24/7; AI buat intake + triage + cadang
> resolusi; **duit dikawal polisi server-side**, bukan oleh AI.

## 1. Objektif
Kurangkan beban CS & bagi customer penyelesaian laju. AI jadi lapisan depan yang
plug ke infra refund sedia ada — bukan bina dari kosong.

## 2. Penemuan penting (infra sedia ada)
- Table `refunds` (migration 054) link ke **`orders` sahaja** (storefront). FK:
  `order_id uuid not null references public.orders(id)`.
- **`lp_guest_orders` (majoriti order) TAK disokong** oleh table `refunds`.
  → Plan guna table aduan baru yang polymorphic (sokong dua-dua jenis order).
- Refund sedia ada: `payment_method` enum = `transfer | baucar | ganti_produk`;
  `status` = `pending | processing | selesai`; `deadline` default +3 hari;
  `image_urls text[]` (bukti); `loyalty_credited` (idempotency baucar points).
- Loyalty reverse: `reverseOrderLoyalty` (storefront), `reverseLpLoyalty` (LP).
- Notifikasi sedia ada: email (`@/lib/zeptomail`), push (`@/lib/push`),
  WA paced (`@/lib/wa-outbox` → `enqueueWhatsApp`).

## 3. Senibina ringkas
```
Customer → /bantuan (page)
  → sahkan order (no order + telefon)
  → AI chat (Claude via Vercel AI Gateway, AI SDK v6)
      • tanya masalah, minta GAMBAR bukti
      • panggil tools (server enforce polisi)
  → Resolusi:
      ├─ Auto (dlm had): store credit / refund separa / ganti
      └─ Escalate → /admin (CS dpt ringkasan AI siap)
  → Notifikasi: email (wajib) + WA paced + push
```

## 4. Skema DB baru — `supabase/071_support_complaints.sql`
Decoupled dari `refunds`, sokong **dua-dua** order (polymorphic):

```
support_complaints
  id, created_at, updated_at
  order_kind        text   -- 'store' | 'lp'
  order_id          uuid   -- orders.id ATAU lp_guest_orders.id (tiada FK, polymorphic)
  order_number, customer_name, customer_phone, customer_email
  category          text   -- rosak|hilang|lambat|salah_item|lain
  status            text   -- open|ai_resolved|escalated|closed|rejected
  resolution_type   text   -- refund_full|refund_partial|store_credit|replacement|none
  resolution_amount numeric
  ai_summary        text   -- ringkasan untuk CS
  ai_confidence     numeric
  image_urls        text[] -- bukti gambar (WAJIB untuk claim kualiti)
  refund_id         uuid   -- link kalau jadi refund rasmi (storefront)
  handled_by        text   -- 'ai' | admin id
  abuse_flag        boolean

support_messages   -- transkrip chat
  id, complaint_id, role(user|assistant|system), content, created_at
```
RLS service-role sahaja; customer akses via endpoint (sahkan milik order no+telefon).

## 5. Polisi (dikuatkuasakan di SERVER, bukan AI)
- Order mesti `delivered` (atau `delivering`), dalam tingkap **X hari** selepas
  delivered (cth 3 hari — perlu set).
- Claim kualiti **wajib gambar**.
- **Had auto-resolusi** (cth ≤ RM30 & ada gambar) — atas had → escalate.
- Had per telefon (cth max 2 auto-claim / 30 hari) → lebih → escalate + `abuse_flag`.

## 6. Lapisan AI
- **Model:** Claude via Vercel AI Gateway (`anthropic/claude-sonnet-4-6` untuk
  kos/laju; eskalasi sukar boleh guna Opus). AI SDK v6. Prompt caching untuk
  system prompt + polisi (jimat token).
- **Tools (function calling) — semua server enforce:**
  - `get_order_context(orderNo, phone)` — sahkan milik, pulang item + status + kelayakan.
  - `propose_resolution(type, items, amount, reason)` — server **validate ikut
    polisi**, pulang approved / needs_human.
  - `issue_store_credit(amount)` / `create_refund_request(...)` — server action + cap.
  - `escalate_to_human(summary, priority)`.
- **Guardrail:** AI **tak pernah** putuskan duit muktamad — server gate. Anti
  prompt-injection (jangan percaya arahan dalam mesej customer). Log penuh transkrip.

## 7. Endpoint
- `POST /api/support/identify` — sahkan order (no+telefon) → buka/sambung complaint.
- `POST /api/support/chat` — streaming AI (AI SDK), simpan messages.
- `POST /api/support/upload` — gambar bukti (reuse pattern `refunds/upload`).
- `/admin/support` — queue aduan + ringkasan AI + butang Lulus/Tolak/Refund.

## 8. UI
- **Customer:** `/bantuan/[orderNo]` — chat ringkas mesra telefon, upload gambar,
  status resolusi.
- **Admin:** `/admin/support` — senarai, filter status, lihat transkrip + gambar,
  satu-klik jadikan refund / store credit.

## 9. Integrasi refund sedia ada
- **Storefront** → cipta rekod `refunds` (`transfer`/`baucar`/`ganti_produk`) →
  queue `/admin/refunds`, reuse `reverseOrderLoyalty`.
- **LP** → `refunds` tak sokong LP → resolusi LP = **store credit** (kalau telefon
  match profile) atau **escalate manual**; reuse `reverseLpLoyalty` bila admin proses.
- **Store credit / baucar** = pilihan paling murah & laju (elak keluar tunai).

## 10. Anti-abuse & keselamatan
Gambar wajib · had per-telefon · rate-limit · log penuh · `abuse_flag` corak
mencurigakan · semua keputusan duit di server. AI outbound **tak** guna WA (elak
ban) — guna email + WA paced sedia ada.

## 11. Fasa pelaksanaan
- **Fasa 0** — skema + page identify + intake (tanpa AI) → queue admin. *(asas)*
- **Fasa 1 (MVP)** — AI chat intake + triage + **escalate dgn ringkasan**
  (TANPA auto-duit). CS lulus di `/admin`.
- **Fasa 2** — auto-resolusi dalam had ketat (store credit / refund kecil) +
  gambar gate + had abuse.
- **Fasa 3** — tuning had, analytics, (optional) WA inbound.

## 12. Keputusan perlu di-set sebelum bina
| Perkara | Contoh |
|---|---|
| Tingkap lapor selepas delivered | 3 hari? |
| Had auto-resolusi | ≤RM30 + gambar? |
| Jenis resolusi ditawar | store credit / refund separa / ganti / tunai? |
| Had abuse per telefon | 2 / 30 hari? |
| Bahasa | BM + English? |

## 13. Anggaran kos AI
Satu aduan ~ beberapa pusingan chat. Dengan Sonnet + prompt caching, anggaran
**kasar ~RM0.05–0.20/aduan**. Murah berbanding masa CS.

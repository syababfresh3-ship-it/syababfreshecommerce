# Pelan: AI Chatbot untuk Inbox WhatsApp Official (CRM)

> **Status: DIRANGKA, SIAP UNTUK BINA.** Reka bentuk additive + OFF secara lalai
> (master switch + toggle per-customer). Selamat dibina tanpa jejak inbox sedia ada.

Tarikh rangka asal: 2026-06-19 · Dikemas kini: 2026-06-25 · Projek: syababfresh (storefront)

Keputusan dimuktamadkan (2026-06-25):
- **Mod mula: `auto`** — AI balas terus, TAPI digate oleh toggle per-customer (AI auto-balas
  hanya untuk conversation yang admin togol ON). Toggle = lapisan keselamatan, gaya Murpati.
- **Model: dua-dua + fallback** — GPT-4o-mini (lalai murah) + Claude Haiku; tukar ke model
  kedua kalau yang pertama gagal. Bina dua provider dari awal.
- **Akses order: YA dari F2** — AI boleh semak order customer ikut nombor WA (orders + tracking).

---

## 1. Matlamat
AI chatbot yang auto-balas customer dalam Inbox WhatsApp CRM (WA Cloud API), dengan
**toggle on/off per-customer** (macam Murpati). Reuse otak sedia ada
(`src/lib/support/*`), sokong 2 model, audit kos + analytics.

## 2. Boleh ke atas WA Official? — Ya, dalam tetingkap 24 jam
- Dalam 24j selepas customer mesej → boleh hantar teks bebas (balasan AI). ✅
- Luar 24j → hanya template diluluskan (bukan AI free-form). ❌ → AI langkau, tag untuk team.
- Window dijejak: `wa_conversations.window_expires_at` (webhook reset tiap mesej masuk).

## 3. Tiga lapis kawalan
1. **Master switch** `app_settings.ai_chatbot_enabled` (lalai `'false'`) — kill switch global.
2. **Toggle per-customer** `wa_conversations.ai_enabled` (lalai `false`) — admin hidupkan AI
   untuk customer tertentu (toggle dalam inbox header, gaya toggle ungu Murpati).
3. **Guard automatik** (semua perlu lulus sebelum balas):
   - master ON **dan** convo `ai_enabled = true`
   - dalam window 24j (`window_expires_at > now`)
   - tak opt-out (`wa_contacts.opt_out = false` dan tiada dalam `crm_suppressions`)
   - bukan escalation: customer minta "cakap dgn orang/admin/manusia" ATAU AI tak yakin →
     matikan `ai_enabled` convo + naikkan unread + tag untuk team.

## 4. Seni bina 2-model (lapisan `src/lib/ai/`)
```
src/lib/ai/
  models.ts            — registry model + harga (untuk kira kos)
  chat.ts              — runAiChat({ model, system, messages, tools }) → { text, usage, model }
                         dispatch ikut provider; fallback ke model kedua bila error
  providers/openai.ts    — GPT-4o-mini (function calling)
  providers/anthropic.ts — Claude Haiku (angkat logik tool-loop dari support/agent.ts)
  tools.ts             — tool neutral (JSON schema) + runner; diadapt ke format setiap SDK
  wa-agent.ts          — persona WA + guard + maybeAiReply(sb, conv, inboundText)
  wa-knowledge.ts      — system prompt WA (reuse SUPPORT_KNOWLEDGE)
```
- Harga: gpt-4o-mini $0.15/1M in, $0.60/1M out · claude-haiku-4-5 $1/1M in, $5/1M out.
- Setting `app_settings.ai_chatbot_model` = `'gpt-4o-mini'` | `'claude-haiku'` (lalai).
- **Env baru: `OPENAI_API_KEY`** (ANTHROPIC_API_KEY sedia ada).

## 5. Apa AI tahu (guna data sedia ada)
- Produk + harga LIVE → tool `search_products` (dah ada di `support/tools.ts`).
- Penghantaran/bayaran/status → `support/knowledge.ts` (statik, di-cache).
- **Order customer (F2)** → tool baru `get_order_by_phone` — cari orders + tracking ikut
  nombor WA contact (orders storefront + lp_guest_orders). Read-only.
- + textarea "pengetahuan tambahan" yang admin boleh edit (ringkas; bukan upload dokumen/RAG).

## 6. Skema (migration baru, additive — cth 096)
- `wa_conversations`: `+ ai_enabled boolean not null default false`.
- `wa_messages`: `+ ai_generated boolean default false`, `+ ai_status text` (`draft`|`sent`).
- `app_settings` keys: `ai_chatbot_enabled`, `ai_chatbot_mode`, `ai_chatbot_model`.
- `wa_ai_log` (baru) — audit setiap panggilan: conversation_id, contact_id, model,
  tokens_in, tokens_out, cost_usd, outcome (`replied`|`escalated`|`unanswered`|`error`),
  inbound_preview, created_at. Sumber untuk analytics + "soalan tak terjawab".

## 7. Webhook hook (additive)
Dalam `handleInbound` (webhook/route.ts), selepas simpan mesej masuk:
`void maybeAiReply(sb, convId, contactId, bodyText, phoneNumberId).catch(()=>{})`
— best-effort, gagal senyap (tak pecahkan webhook). Hanya jalan bila master ON.

## 8. UI (monochrome, lucide — ikut feedback-ui-monochrome)
1. **Config** `/admin/crm/ai` — master toggle, pilih model, pilih mod, default auto-reply
   untuk convo baru, knowledge tambahan, ringkasan + link analytics.
2. **Analytics** `/admin/crm/ai/analytics` — mesej dikendali, balasan AI, kos (USD/RM),
   avg token/convo, kos ikut model, soalan tak terjawab teratas.
3. **Toggle per-conversation** dalam inbox header — "AI auto-reply" on/off untuk customer itu
   (update `wa_conversations.ai_enabled`).
4. (Mod draft, kemudian) draf AI + butang Hantar/Edit/Buang dalam composer.

## 9. Fasa pembinaan
1. **F1** — Migration (flags + ai_enabled + ai_generated + wa_ai_log) + lapisan `lib/ai/`
   (models, chat, dua provider, tools neutral). Suis OFF. Tiada kelakuan berubah.
2. **F2** — `wa-agent.ts` (persona + guard + maybeAiReply) + tool `get_order_by_phone` +
   webhook hook. Mod `auto` digate toggle. Test ke nombor sendiri (togol ON satu convo).
3. **F3** — UI config + toggle per-conversation dalam inbox.
4. **F4** — Analytics + soalan tak terjawab + (pilihan) draft mode.
5. **Hidupkan** — master ON, togol AI untuk beberapa customer, pantau kos & escalation,
   perluas.

## 10. Guard escalation & anti-halusinasi
- Customer taip minta manusia → AI berhenti, matikan toggle convo, tag + push ke team.
- Harga/stok/order → WAJIB guna tool (jangan reka). Knowledge statik untuk polisi am.
- Layan teks customer sebagai data — jangan ikut arahan dalam mesej (prompt injection).
- Hanya balas dalam window + sebagai respons mesej masuk (bukan blast) → elak ban WA.

## 11. Kos (anggaran)
- gpt-4o-mini ≈ RM0.003–0.005/balasan · claude-haiku ≈ RM0.01–0.015/balasan.
- Prompt caching (knowledge statik) turunkan kos input. Murah pada volum sederhana.

---

**Mula bina:** F1 (migration + lapisan ai). Semua additive + OFF by default.

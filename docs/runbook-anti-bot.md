# Runbook: Serangan bot / fake order

## Pertahanan sedia terpasang (auto, tiada tindakan perlu)

1. **Burst gate** — 8 order/min/IP (in-memory) pada guest checkout, LP order, member checkout; 5/min lead; 30/min view; 10/min guest AI chat.
2. **Had global sejam** (DB, merentas instance): **20/IP**, **3/telefon** (normalized — tukar format tak lepas), **3/email**. Pemalar di `src/lib/order-guard.ts`.
3. **Honeypot** — field tersembunyi `website` di semua borang guest; bot yang isi dapat fake-200 (tiada order/email/CAPI). Log: cari `[order-guard] honeypot` di log Vercel.
4. Webhook CHIP bertandatangan RSA — laluan mahal (stok, WA admin) tak boleh dipalsukan.

`client_ip` disimpan pada setiap order (kolum `lp_guest_orders.client_ip`, `orders.client_ip`) — untuk forensik & ban.

## Bila DISERANG (langkah mengikut urutan)

1. **Vercel dashboard → project `syababfreshecommerce` → Firewall → Attack Challenge Mode: ON.**
   Percuma (Pro), serta-merta, challenge semua traffic mencurigakan. Off semula bila reda.
2. Kenal pasti IP penyerang:
   ```sql
   select client_ip, count(*) from lp_guest_orders
   where created_at > now() - interval '24 hours'
   group by client_ip order by count(*) desc limit 20;
   ```
3. Ban kekal IP tu: Vercel Firewall → custom rule → IP blocking.
4. (Pilihan) WAF rate-limit rule kekal: POST `/api/store/guest-order` + `/api/lp/*` — backup platform-level pada had dalam kod.
5. Padam fake order dari admin (atau SQL ikut `client_ip`).

## Tanda-tanda perlu ESKALASI ke CAPTCHA (Cloudflare Turnstile)

- 429 berterusan dari IP yang berputar-putar (proxy pool)
- Fake order lepas walaupun had aktif (slow-drip bawah 3/jam/nombor)
- Honeypot hit beratus (bot adapt)

Turnstile percuma & mostly-invisible; wiring rate limit dah siap, tambah nanti kerja kecil. JANGAN pasang awal-awal — friction pada customer sebenar tanpa manfaat.

## Nota operasi

- Had 3/telefon/jam boleh terkena CS yang buat order manual berulang untuk customer sama → tunggu sejam atau guna Quick Order (admin, tak terkesan).
- Pantau honeypot false-positive: kalau log honeypot nampak macam manusia (IP MY, UA telefon biasa), semak — mungkin autofill browser; naikkan keunikan nama field.

# Pelan: Cerdikkan AI Chatbot WhatsApp (pengetahuan buah)

> Status: Fasa 1, 2 & 3 DIBINA 26 Okt 2026 (belum commit masa ditulis; migration 151 & 152 pemilik perlu jalankan). Additive, tiada perubahan pada guard/toggle/flow closing.

## Keadaan sekarang (audit 26 Okt 2026)
- Otak: `src/lib/ai/wa-agent.ts` → prompt `wa-knowledge.ts` → tools `wa-tools.ts`. Model lalai gpt-4o-mini, sandaran claude-haiku-4-5.
- Pengetahuan: (1) `SUPPORT_KNOWLEDGE` statik (penghantaran/bayaran), (2) textarea admin `ai_chatbot_knowledge` (±7.7k aksara: waktu operasi, promo ceri, template order, anggaran masa hantar), (3) persona (±1.5k aksara), (4) tool `search_products`.
- Kelemahan utama pada soalan buah:
  - `search_products` cari `ilike name` sahaja: "ceri" tak jumpa "Cherry Turkey", "delima" tak jumpa "Pomegranate", "kurma" tak jumpa "AJWA Large". Tiada sinonim, tiada carian kategori/deskripsi.
  - Deskripsi produk dipotong 140 aksara, sedangkan 75/84 produk aktif ada deskripsi ≥300 aksara (asal, rasa, tekstur, cara makan). Pengetahuan sedia ada dibuang.
  - Stok varian (`product_variants.stock`) tak diberi kepada AI → tak boleh jawab "ada stok tak / dah habis ke".
  - Tiada fakta berstruktur: cara simpan & tempoh tahan, ada biji?, musim, beza gred/saiz, soalan kesihatan (diabetes/mengandung).
  - Log AI hanya 44 balasan sejak Jun (ujian pemilik). Tiada data kegagalan sebenar sebab toggle per-convo jarang ON.
- Soalan sebenar customer (1,500 mesej masuk terkini, 432 berbentuk soalan): penghantaran 97, rasa/kualiti 79, status order 61, saiz/berat 53, simpan/tahan 32, harga 22, kesihatan 12, stok 12, asal 10. Contoh: "Harumanis Surabaya sesedap Harumanis Perlis ke?", "shine muscat dari mana? ada biji?", "dalam peti beku untuk simpan lama kan?", "kiwi berry dah habis ke", "isi merah terang kurang manis berbanding merah gelap, kenapa?".

## Fasa 1 — Carian & kad produk pintar — SIAP 26 Okt 2026
Dibina dalam `src/lib/ai/catalog-tools.ts` (kongsi WA + /support): `search_products` (nama + kategori + penerangan, 29 kumpulan sinonim BM/EN, token asal berat penuh vs sinonim 0.4, buang padanan lemah <30% skor teratas, produk tanpa saiz aktif tenggelam), `get_product_details` (penerangan penuh, semua saiz + harga + promo + stok ada/sedikit/habis, kurier sejuk, pautan, nota waitlist), cache katalog 3 min, hanya `show_in_storefront` (produk LP/Live disorok). `FRUIT_QA_RULES` ditambah ke prompt WA (`wa-knowledge.ts`) & /support (`support/knowledge.ts`). `models.ts`: + Claude Haiku 5.5 ($0.10/$0.50) & Sonnet 5.5 ($2/$10) — harga dari platform.claude.com/docs pricing 26 Okt; sandaran kini Haiku 5.5. Lalai tersimpan masih gpt-4o-mini (pemilik tukar di /admin/crm/ai).
Ujian Playground 26 Okt: Haiku 5.5 → search→details, jawapan tepat dari penerangan ("Shine Muscat dari Jepun, tiada biji"), ringkas, bold satu bintang, ~US$0.0004/balasan. gpt-4o-mini → senarai markdown panjang, bold dua bintang, abaikan status "sahkan dengan team" → cadangan tukar lalai ke Haiku 5.5.
**Isu data ditemui (pemilik):** (1) semua produk Cherry/Ceri `is_active=false` sejak 5 Okt tetapi textarea pengetahuan admin masih ada "PROMOSI SEMASA: ceri turkey…" + harga ceri → AI bercanggah; padam/kemas kini promo. (2) 4 produk aktif tanpa saiz aktif (Kiwi Golden Zespri, ROTAB, Strawberry Australia (250G/Pack), Valencia Orange 5pcs/pack) → AI kata "sahkan dengan team"; nyahaktif pendua atau tambah saiz. (3) `weight_grams` placeholder 100g → berat sengaja tidak diberi kepada AI.

Spesifikasi asal:
1. `search_products` baharu: cari nama + deskripsi + kategori; peta sinonim BM/EN (ceri↔cherry, delima↔pomegranate, anggur↔grape/muscat, kurma→kategori Kurma*, limau↔orange/mandarin, pic↔peach, dll.); pulangkan ≤8 padanan ringkas.
2. Tool baharu `get_product_details(nama)`: deskripsi PENUH, semua varian (saiz, harga, berat, status stok ada/sedikit/habis tanpa angka), kategori, `is_cold`, harga promo (`compare_price`), pautan produk.
3. Status stok dalam jawapan + sebut waitlist/restock bila habis.
4. Pilihan model: tambah Claude Haiku 5.5 / Sonnet ke registri `models.ts` (harga perlu disahkan dari laman harga rasmi sebelum ditulis); cadangan lalai Haiku untuk kualiti BM & tool-use.
5. Prompt: tambah bahagian "CARA JAWAB SOALAN BUAH" (jawab spesifik dari kad produk; kalau fakta tiada, akui jujur + tawar semak dengan team; JANGAN reka asal/khasiat; soalan kesihatan → nasihat umum + rujuk doktor).
Kongsi tool carian baharu dengan chatbot `/support` (`src/lib/support/tools.ts`) tanpa ubah flow aduannya.

## Fasa 2 — Fakta buah berstruktur — SIAP 26 Okt 2026 (migration 151 PENDING)
Dibina: `supabase/151_product_knowledge.sql` (`product_knowledge` satu baris/produk: facts jsonb + status draft|verified + source/drafted/verified_by; `ai_faq` berkategori; RLS admin). `src/lib/ai/product-knowledge-fields.ts` (pure: FACT_FIELDS 11 medan + faq, parseFacts) & `product-knowledge.ts` (draftFactsWithAi via Haiku 5.5, loadVerifiedFacts, loadActiveFaqText — toleran jadual belum ada). `get_product_details` sertakan `fakta_disahkan` (hanya verified). FAQ aktif disuntik ke prompt WA (`buildWaSystemPrompt({faq})`) & Playground. Admin `/admin/crm/ai/knowledge` (pautan "Pengetahuan buah" di Config): senarai produk + status, Jana draf AI pukal (5/panggilan), panel edit medan + FAQ produk, Simpan draf / Simpan & sahkan / Batal pengesahan / Buang kad; tab FAQ umum CRUD. API `/api/admin/ai/knowledge` (GET, ?id=), `[productId]` (PUT save|verify|unverify, DELETE), `draft` (POST ids≤5, overwrite, dry), `/api/admin/ai/faq` (+`[id]`). SOP §7. Sengaja TIDAK sentuh `product-form.tsx` (ada WIP affiliate) — page berasingan.

Spesifikasi asal:
- Migration: `product_knowledge` (product_id, field, content, verified_by, verified_at) atau kolum `ai_facts jsonb` pada `products`. Medan tetap: asal, musim, rasa, tekstur, biji, cara simpan, tempoh tahan (suhu bilik/peti sejuk/beku), tanda masak, cara makan, beza gred/saiz, nota kesihatan, soalan lazim bebas.
- Admin: tab "Pengetahuan AI" dalam borang produk (`product-form.tsx`) + penanda "Disahkan" vs "Draf".
- Draf automatik: AI jana draf untuk 84 produk dari deskripsi sedia ada; pemilik/team sahkan sebelum AI guna (hanya fakta "Disahkan" diberi kepada chatbot).
- FAQ umum buah (polisi rosak, gred, musim) dipindah dari textarea ke jadual `ai_faq` berkategori; textarea kekal untuk promo semasa.

## Fasa 3 — Ukur & belajar + Gift kurma — SIAP 26 Okt 2026 (migration 152 PENDING)
Dibina:
- **Gift box kurma & borong** (`src/lib/ai/gift-knowledge.ts`): `buildGiftKnowledge()` (fakta dari GIFT_FAQ/COMPANY/FINISHES/sheet 2026 — tiada rekaan) + `GIFT_RULES` dalam prompt WA; tool `gift_price_estimate` (= kalkulator awam Studio, sentiasa "anggaran") & `flag_gift_enquiry` (→ `gift_orders` status enquiry, `config.source='wa-ai'`, dedup 24j, push admin, needs_reply) → muncul di Enquiry Gift (badge "WhatsApp AI", susun atur RFQ) → team sales "Buat sebut harga". Tidak untuk /support.
- **Outcome `uncertain`** (`wa-agent.ts`): carian produk kosong atau frasa "tak pasti/semak dengan team" → log `uncertain` (balasan tetap dihantar) + `reply_preview`/`tools` (migration `152_wa_ai_log_detail.sql`, insert toleran). Analytics: stat "Tak pasti" + senarai soalan + balasan + pautan ke Pengetahuan buah.
- **Set ujian** (`src/lib/ai/eval-cases.ts`, 33 kes dari inbox sebenar + gift): semakan deterministik (tool, frasa wajib/dilarang) + penilai AI (Haiku 5.5, 0–2, ikut `reference`). API `POST /api/admin/ai/eval` (≤6 kes/panggilan). Playground tab **Ujian** (`eval-panel.tsx`): jalankan semua / ulang yang gagal / tapis kumpulan / pilih model; `runPlaygroundTurn` dikongsi (`playground-run.ts`).

Spesifikasi asal:
- Set ujian: 40–60 soalan sebenar dari inbox + fakta kunci yang mesti ada; tab "Ujian" dalam Playground jalankan semua & tanda lulus/gagal.
- Pengesanan "tak pasti": bila balasan AI mengaku tak tahu atau tool pulang kosong → `wa_ai_log.outcome='uncertain'` → senarai "Soalan buah tanpa jawapan" dalam Analytics → pemilik tambah fakta → AI cerdik.
- Pantau kos per balasan ikut model.

## Tidak disentuh
Guard 1–5, toggle per-convo, tetingkap 24j, flow closing & `flag_ready_order`, webhook, mod draft/faq, chatbot aduan `/support` (hanya kongsi carian).

## Keputusan pemilik diperlukan
1. Model lalai: kekal gpt-4o-mini atau tukar ke Claude Haiku (kos ±2–3× tapi masih sen per balasan).
2. Siapa sahkan fakta buah: pemilik sendiri atau team ops/sales (admin akaun masing-masing).
3. Stok: AI sebut "ada/habis" sahaja (cadangan) atau angka sebenar.

## Isu 26 Okt 2026 (petang): "(tiada balasan)" di Playground dengan Claude Haiku 5.5

**Punca (disahkan dengan respons mentah API):** model Claude 5.x berfikir dulu (*adaptive thinking*, lalai effort medium) dan token penaakulan dikira dalam `max_tokens`. Had kami 500 → bila AI nak panggil `flag_gift_enquiry` (tool banyak medan) selepas customer beri nama, respons terpotong (`stop_reason: max_tokens`) sebelum ada teks → balasan kosong. Di WhatsApp sebenar, balasan kosong = `handoff('unanswered')` → customer tak dapat apa-apa.

**Pembetulan:** `maxTokens` 500 → 2048 (wa-agent, playground); penilai ujian 800 → 2048; draf fakta 3000 → 6000. Provider Anthropic: kalau `max_tokens` dicapai tanpa teks, ulang sekali dengan bajet 4× (had 8192). Playground tak lagi hantar "(tiada balasan)" sebagai sejarah AI. Kos kini kira token cache (baca 10%, tulis 125%) — kos sebenar ≈ RM0.002–0.004 setiap balasan, bukan RM0.0016.

**Ujian:** 33 kes — thinking kekal + had 2048 = 33/33 (purata 5.5s); thinking dimatikan + had 1024 = 31/33 (3.7s). Pilih kekalkan thinking. Giliran "syabab anas" → "ya betul" kini balas & rekod enquiry (dry-run).

## Tala panjang balasan (26 Okt 2026 malam)

**Masalah:** balasan terlalu panjang untuk WhatsApp (contoh "ajwa 5kg": 5 perenggan, ~600 aksara, senarai gred + closing + soalan lain sekali gus). Punca: prompt kata "ringkas 1–3 ayat" tetapi peraturan lain suruh sebut saiz, stok, closing & minta nama/poskod — model patuhi semua sekali. Tiada semakan panjang dalam set ujian. Persona admin ("galak repeat order, tonjolkan nilai") & FAQ panjang dalam textarea pengetahuan turut mendorong.

**Pembetulan:** blok "PANJANG & BENTUK BALASAN (WAJIB)" dalam prompt WA (`wa-knowledge.ts`): maks 3 baris (~300 aksara), SATU soalan setiap balasan, harga dalam satu baris, tiada bullet/tajuk/ayat penutup, jawab soalan yang ditanya sahaja, soalan kesihatan 2 ayat tanpa pivot jualan; pengecualian ringkasan pengesahan (≤6 baris) & senarai yang diminta. `GIFT_RULES`: format anggaran tetap (harga + jumlah + nota anggaran + satu soalan), `flag_gift_enquiry` sekali sahaja. Set ujian: semakan `Panjang ≤ 400 aksara` (boleh ubah per kes: beza/simpan/closing/refund 450, enquiry penuh 500, senarai 800) & `Soalan ≤ 1`; panel Ujian papar purata aksara & aksara setiap balasan.

**Ukuran (33 kes + flow gift 4 giliran, Haiku 5.5):**

| | Sebelum | Selepas |
|---|---|---|
| Purata aksara | 474 | 275 |
| Purata baris | 3.6 | 2.3 |
| Balasan >350 aksara | 29/37 | 5/37 |
| Balasan >1 soalan | 5 | 0 |
| Lulus semakan | 31/33 (tanpa semakan panjang) | 32/33 (dengan semakan panjang) |

Satu kes gagal akhir (hantar-luar-kv: tak sebut kurier/1–3 hari) adalah variasi model — lulus dalam 2 larian sebelumnya. Cadangan kepada pemilik: ringkaskan FAQ/emoji dalam textarea pengetahuan admin & buang promo ceri basi — ia memanjangkan prompt (13.4k token) dan menggalakkan jawapan berformat.

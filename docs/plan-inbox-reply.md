# Pelan: Perkemas Composer Reply Inbox (gaya Murpati)

> **Status: DIRANGKA.** Off-by-default tiada; semua additive pada composer sedia ada.
> Cetusan: composer Murpati (Reply tab, Attach, Templates, Send — ikon bersih) +
> keperluan hantar template approved dalam chat (tetingkap 72j selepas blast).

## Keadaan sekarang (inbox-client.tsx composer)
- **Dalam tetingkap 24j** (customer mesej dlm 24j): Snippet (📋) + textarea + attach
  gambar + butang Hantar.
- **Luar tetingkap 24j**: picker template approved ("Pilih template") sahaja.
- Ikon guna emoji (📋 Snippet, dll) — tak konsisten dengan polisi monochrome.

## Prinsip
- **Additive** — kekalkan logik hantar (sendText/sendTemplate/sendImage) sedia ada.
- **Monochrome** — ganti SEMUA emoji dengan ikon lucide (lihat [[feedback_ui_monochrome]]).
- **Snippet kekal** (user kata dah ok) — cuma tukar ikon.

## Perubahan

### 1. Ikon monochrome (buang emoji)
| Sekarang | Tukar ke (lucide) |
|---|---|
| 📋 Snippet | `<FileText/>` Snippet |
| Attach gambar (emoji) | `<Paperclip/>` Attach |
| Butang Hantar | `<Send/>` Hantar |
| Emoji picker ☺ (jika ada) | `<Smile/>` (atau buang) |

### 2. Dropdown "Template" SENTIASA dalam composer ⭐
Sekarang template picker muncul **hanya** bila luar tetingkap 24j. Tambah baik:
- Butang **"Template"** (`<FileText/>`) **sentiasa** ada dalam composer — dalam ATAU luar window.
- Klik → dropdown senarai **template APPROVED sahaja** (tapis `status === APPROVED`).
- Pilih template → isi parameter ({{1}}, {{2}}…) → hantar.
- Berguna untuk **tetingkap 72j selepas blast**: WhatsApp benarkan hantar ke customer
  yang di-blast guna template approved → team boleh terus hantar dari chat.

**Nota tetingkap (penting):**
- **24j service window** (customer mesej dulu) → teks bebas free.
- **Luar window / business-initiated** → WAJIB template approved (mungkin ada kos).
- **72j free entry point** (cth CTWA / selepas interaksi tertentu) → template approved.
- Sebab tu template approved perlu **mudah diakses dalam chat** bila-bila masa.

### 3. Susun atur composer (gaya Murpati)
```
┌─────────────────────────────────────────────┐
│ [textarea] Taip balasan… (⌘/Ctrl+Enter)      │
│                                               │
│ [📎 Attach] [▤ Template] [▤ Snippet]   [➤ Hantar] │
└─────────────────────────────────────────────┘
```
- Baris bawah: butang ikon (Attach · Template · Snippet) di kiri, Hantar di kanan.
- Konsisten, bersih, monochrome.

## Komponen
- `inbox-client.tsx` — composer (kotak balas): tukar ikon, tambah butang Template
  sentiasa-ada + dropdown template approved (reuse `loadTemplates` + `pickTemplate`
  + `sendTemplate` sedia ada).
- Tiada migration. Tiada perubahan API (guna send route sedia ada).

## Fasa
| Fasa | Skop |
|---|---|
| **1** | Tukar ikon emoji → lucide (Snippet/Attach/Send) — kemas segera |
| **2** | Butang "Template" sentiasa-ada + dropdown template approved (untuk window 72j/24j) |
| **3** | Susun atur baris butang gaya Murpati + polish |

## Yang TIDAK berubah
- Logik hantar (teks/template/gambar), webhook, send route.
- Picker template luar-window sedia ada (jadi sebahagian butang Template baru).

## Kos
RM0. Additive sahaja.

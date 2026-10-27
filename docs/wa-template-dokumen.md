# Template WhatsApp (Meta) untuk hantar sebut harga & invois

Diguna oleh butang **WhatsApp → Template Meta** dalam sebut harga / Pipeline Gift bila tetingkap 24 jam tutup atau klien belum pernah WhatsApp nombor Official. Cipta di **Meta Business Suite → WhatsApp Manager → Message templates** untuk WABA nombor utama, kategori **Utility**, bahasa **Malay (ms)**. Selepas **APPROVED**, template muncul dalam dialog; pilih dan tanda *Jadikan lalai*.

Sistem isi parameter badan secara automatik mengikut turutan: `{{1}}` nama klien · `{{2}}` nombor dokumen · `{{3}}` jumlah (RM) · `{{4}}` pautan. Guna parameter bernombor (bukan bernama). Header **Document** = PDF dilampirkan automatik (sebut harga: PDF website; invois: PDF Refrens). Boleh guna 1–4 parameter sahaja; yang tidak dipakai ditinggalkan.

## 1. `sebut_harga_sedia` — Utility · ms · Header: Document

**Body**
```
Salam {{1}}, sebut harga {{2}} dari Syabab Trading Sdn Bhd telah sedia. Jumlah {{3}}.
Lihat, muat turun PDF dan sahkan di sini: {{4}}
Ada soalan, balas sahaja mesej ini. Terima kasih.
```
**Sampel** (Meta minta contoh): `Encik Ahmad` · `STSB-Q2026-0012` · `RM 3,450.00` · `https://shop.syababfresh.my/q/abc123`

## 2. `invois_sedia` — Utility · ms · Header: Document

**Body**
```
Salam {{1}}, invois {{2}} dari Syabab Trading Sdn Bhd telah sedia. Jumlah {{3}}.
Butiran pembayaran ada dalam invois. Lihat: {{4}}
Sila kongsi slip bayaran selepas selesai. Terima kasih.
```
**Sampel**: `Puan Siti` · `INV-2026-0098` · `RM 3,450.00` · `https://refrens.com/...`

## Nota
- Kalau Meta tolak pautan dalam badan (jarang untuk Utility), buang `{{4}}` — PDF tetap dilampirkan melalui header Document dan pautan ada dalam PDF.
- Footer pilihan: `Syabab Trading Sdn Bhd · 011-5640 3601`.
- Template adalah per-WABA. Nombor #2 (WABA lain) perlu template sendiri; dialog senaraikan template WABA utama sahaja buat masa ini.
- Kos: template Utility dikenakan caj Meta (lihat Blaster kos sebenar); mesej bebas dalam tetingkap 24 jam percuma.

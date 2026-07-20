<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lebar page admin

Setiap page di bawah `src/app/admin/` bermula dengan satu `<div>` pembungkus. Pilih lebarnya ikut **jenis kandungan**, bukan citarasa:

```tsx
// Senarai, jadual, dashboard, grid → penuh
<div className="p-4 md:p-6">

// Borang & tetapan → berhad
<div className="p-4 md:p-6 max-w-4xl">
```

- **Penuh** bila kandungan ada banyak lajur (nama, status, tarikh, harga, butang aksi). Ruang lebar = kurang teks terpotong, kurang scroll. Contoh: Orders, Customers, Reviews, Media, Shipping.
- **`max-w-4xl`** bila kandungan dibaca atas-ke-bawah, satu medan satu baris. Borang yang regang penuh skrin besar buat label & input terlalu jauh — senang tersalah isi. Contoh: Payments, Products new/edit, Team, Categories.

Jangan cipta tier lain (`max-w-2xl`, `3xl`, `5xl`, `6xl`) — dua pilihan ini sahaja. Sebelum ini setiap page guna nilai berbeza dan hasilnya tak konsisten.

Padding mesti tepat `p-4 md:p-6` (bukan `p-6` atau `p-4 sm:p-6`), dan **jangan** letak `mx-auto` pada pembungkus — page admin rata kiri, bukan berpusat. Variasi kecil macam ni yang buat page terlepas bila kita semak keselarasan.

Pengecualian: page yang memang perlu lebar tetap tersendiri (cth. viewer/editor khas) — tulis komen ringkas di baris itu terangkan kenapa.

# View Postgres: sentiasa set security_invoker

Selepas **setiap** `create or replace view` dalam `supabase/*.sql`, sertakan:

```sql
alter view public.<nama_view> set (security_invoker = on);
```

Sebabnya: `CREATE OR REPLACE VIEW` tanpa klausa `WITH (...)` **reset reloptions ke
default**, dan default `security_invoker` ialah `off` — iaitu view jalan dengan
kebenaran pemiliknya (`postgres`) dan **pintas RLS**. Supabase Security Advisor
laporkannya sebagai "Security Definer View".

Ini bukan teori: `089_views_security_invoker.sql` dah betulkan tiga view, kemudian
`090_blast_roas_fix_lp_status.sql` me-replace salah satu dan membatalkan fix itu tanpa
disedari. Dibetulkan dalam `113_fix_view_security_invoker.sql`.

Bila menukar view sedia ada, semak dulu sama ada ia pernah di-`alter ... set
(security_invoker = on)` dalam migration terdahulu — kalau ya, ulang baris itu.

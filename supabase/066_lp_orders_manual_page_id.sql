-- 066: Pisahkan order MANUAL (Quick Order / WhatsApp) dari attribution LP.
-- Order manual disimpan dalam lp_guest_orders tapi BUKAN dari landing page — ia
-- sebelum ni "pinjam" page_id LP pertama (sebab page_id NOT NULL), menyebabkan ia
-- tersilap dikira dalam statistik LP itu (performance/route.ts: o.page_id===page.id).
--
-- Selepas ni: page_id boleh null → order manual page_id=null → tak padan mana-mana
-- LP → terkeluar automatik dari SEMUA kiraan LP. Badge 'Manual' ikut source='whatsapp'.
--
-- Idempotent — selamat dijalankan semula. Jalankan di Supabase SQL Editor.

-- 1) Benarkan page_id null (order manual tiada LP)
alter table public.lp_guest_orders alter column page_id drop not null;

-- 2) Bersihkan order manual sedia ada yang terlanjur pinjam page_id LP.
--    Quick Order hantar source 'whatsapp' atau 'whatsapp-<staff>'; order LP sebenar
--    source='lp' (tak disentuh).
update public.lp_guest_orders
   set page_id = null
 where (source like 'whatsapp%' or source = 'manual')
   and page_id is not null;

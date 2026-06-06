-- 073: Tag bila order tracking diblast melalui ReplyLa (/admin/wa-blast).
-- Berasingan daripada exported_at (itu untuk export AWB kurier) supaya tak bercampur.
-- Diset bila admin Download CSV di page WA Blast → elak order yang sama terexport
-- (dan diblast) dua kali sambil order masih status 'delivering'.
--
-- Idempotent. Jalankan di Supabase SQL Editor.

alter table public.orders
  add column if not exists wa_blasted_at timestamptz;

alter table public.lp_guest_orders
  add column if not exists wa_blasted_at timestamptz;

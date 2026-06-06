-- 068: Override kurier per-poskod untuk delivery_zones.
-- Lalamove vs Pos biasanya ditentukan julat poskod (LK: 40000–48999, 50000–60000,
-- 62000–64000). Ada kawasan tersilap kategori: dalam julat LK tapi Lalamove TAK sampai
-- (cth Hulu Selangor luar bandar: Serendah, Kuala Kubu Baru, Kerling) → kena hantar Pos.
-- Atau sebaliknya: Pos tak sampai → kena Lalamove. Lajur ini benarkan admin override
-- per-poskod dari /admin/delivery. NULL = auto (ikut julat). Idempotent.
alter table public.delivery_zones
  add column if not exists courier_override text
  check (courier_override in ('pos', 'lalamove'));

-- Seed: kawasan Hulu Selangor dalam julat poskod LK tapi Lalamove tak sampai → Pos.
-- Serendah 48200, Kuala Kubu Baru 44000, Kerling 44100. Idempotent (update by poskod).
update public.delivery_zones
   set courier_override = 'pos'
 where postcode in ('48200', '44000', '44100');

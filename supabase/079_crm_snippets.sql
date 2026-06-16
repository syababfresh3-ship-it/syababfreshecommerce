-- ============================================================
-- 079_crm_snippets.sql
-- Canned message (snippet) untuk inbox CRM — admin hantar cepat.
-- ADDITIVE. Idempotent. Seed termasuk "Borang Order".
-- ============================================================

create table if not exists public.crm_snippets (
  id         uuid primary key default uuid_generate_v4(),
  label      text not null unique,
  body       text not null,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.crm_snippets (label, body, sort) values
  ('Borang Order', E'Untuk kami proses order, sila isi & balas:\n\n📝 Nama:\n📞 No. Telefon:\n📧 Email:\n🏠 Alamat penuh:\n📮 Poskod:\n🥭 Produk + kuantiti:', 1),
  ('Terima kasih', E'Terima kasih! 🙏 Order anda sedang kami proses ya.', 2),
  ('Cara bayar', E'Anda boleh bayar melalui:\n• Online banking / FPX\n• Atau klik link bayar yang kami hantar\n\nLepas bayar, screenshot resit ya. Terima kasih! 🥭', 3)
on conflict (label) do update set body = excluded.body, sort = excluded.sort;

alter table public.crm_snippets enable row level security;
drop policy if exists "crm_snippets: admin" on public.crm_snippets;
create policy "crm_snippets: admin" on public.crm_snippets for all using (public.is_admin()) with check (public.is_admin());

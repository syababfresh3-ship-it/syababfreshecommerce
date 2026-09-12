-- ============================================================
-- 133_rate_limits.sql
-- Had kadar merentas instance untuk laluan WANG & PII.
--
-- MASALAH: `lib/rate-limit.ts` menyimpan kiraan dalam Map memori proses.
-- Pada Vercel setiap instance serverless ada Map sendiri, jadi had "5 per
-- minit" sebenarnya "5 per minit PER INSTANCE". Bila trafik naik, Vercel
-- membuka lebih banyak instance — jadi had itu melonggar tepat pada masa
-- ia paling diperlukan. Penyerang yang mengitar sambungan boleh memintasnya.
--
-- Jadual ini memberi kiraan SEJAGAT yang dikongsi semua instance.
--
-- NOTA IO: sengaja TIDAK dipakai pada laluan trafik tinggi (cth /lp/[slug]/view).
-- Hanya laluan bervolum rendah & berisiko tinggi — cipta order, bayar, OTP,
-- carian pesanan ikut telefon. Plan Supabase kita ketat IO; `lib/rate-limit-db.ts`
-- juga menyemak gate memori dahulu supaya DB tidak disentuh bila had lokal
-- sudah pun tercapai.
-- ============================================================

create table if not exists public.rate_limits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);

comment on table public.rate_limits is
  'Kiraan had kadar sejagat. Satu baris satu bucket (cth "order:ip:1.2.3.4"). Dikemas kini hanya oleh check_rate_limit().';

-- Hanya service role patut menyentuh jadual ini. RLS hidup tanpa sebarang
-- policy = anon/authenticated tidak nampak apa-apa.
alter table public.rate_limits enable row level security;

-- Untuk pembersihan berkala.
create index if not exists idx_rate_limits_window on public.rate_limits (window_start);

-- Naikkan kiraan bucket secara ATOMIK dan beritahu sama ada masih di bawah had.
-- Satu pusingan DB sahaja: insert-or-update + returning.
create or replace function public.check_rate_limit(
  p_bucket         text,
  p_max            integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer;
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  insert into public.rate_limits as rl (bucket, window_start, count)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set count        = case when rl.window_start < v_cutoff then 1 else rl.count + 1 end,
        window_start = case when rl.window_start < v_cutoff then now() else rl.window_start end
  returning rl.count into v_count;

  -- Pembersihan kebarangkalian (~1 daripada 200 panggilan) supaya jadual tidak
  -- membesar selamanya kerana IP yang tidak pernah kembali. Lebih murah
  -- daripada satu lagi kerja cron.
  if random() < 0.005 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_max;
end;
$$;

-- Ikut peraturan audit §0.2 — RPC yang mengubah data tidak boleh dipanggil
-- dengan anon key.
revoke execute on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;

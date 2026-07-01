-- ============================================================
-- 101_kad_setia.sql
-- Kad Setia (stamp card): kumpul 1 stamp/pembelian; capai 9 → auto voucher
-- RM{reward} (tebus mana-mana buah sehingga cap). Jadual BARU (dibenarkan).
-- ADDITIVE. Idempotent. Run di Supabase SQL Editor.
-- ============================================================
create table if not exists public.stamp_cards (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  stamps         int not null default 0,
  redeemed_count int not null default 0,
  updated_at     timestamptz not null default now()
);
alter table public.stamp_cards enable row level security;
-- Member baca kad sendiri (papar progress di Akaun).
drop policy if exists stamp_cards_owner_read on public.stamp_cards;
create policy stamp_cards_owner_read on public.stamp_cards for select using (auth.uid() = user_id);

-- Tambah 1 stamp (atomik) → return kiraan baru.
create or replace function public.kad_setia_add_stamp(p_user uuid)
returns int language plpgsql security definer as $$
declare n int;
begin
  insert into public.stamp_cards (user_id, stamps) values (p_user, 1)
    on conflict (user_id) do update set stamps = public.stamp_cards.stamps + 1, updated_at = now()
    returning stamps into n;
  return n;
end $$;

-- Tebus: tolak target + tambah redeemed_count.
create or replace function public.kad_setia_redeem(p_user uuid, p_target int)
returns void language sql security definer as $$
  update public.stamp_cards
    set stamps = greatest(0, stamps - p_target),
        redeemed_count = redeemed_count + 1,
        updated_at = now()
  where user_id = p_user;
$$;

-- Tetapan
insert into app_settings (key, value) values
  ('kad_setia_target', '9'),
  ('kad_setia_reward', '15.90')
on conflict (key) do nothing;

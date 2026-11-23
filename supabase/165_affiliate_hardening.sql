-- ============================================================
-- 165_affiliate_hardening.sql — Affiliate: tampal keselamatan, tempoh tahan,
-- rekod klik, RPC atomik (23 Nov 2026). Sambungan migration 139 (produk-link).
--
-- Keputusan pemilik 23 Nov: kadar komisen IKUT PRODUK (products.affiliate_pct),
-- tempoh tahan 7 hari selepas delivered+dibayar, pautan LP ditangkap juga.
--
-- Apa yang dibetulkan:
--  1) profiles: ahli boleh set is_affiliate / affiliate_balance / referral_code
--     sendiri (polisi "user can update own" hanya kunci is_admin) → trigger kunci.
--  2) affiliate_withdrawals: polisi INSERT terbuka kepada sesiapa yang log masuk → dibuang
--     (semua insert lalu API service-role / RPC di bawah).
--  3) affiliate_invites: token boleh dibaca umum (USING true) → dibuang
--     (/api/affiliate/join guna service-role).
--  4) RPC increment_affiliate_balance / increment_points / increment_spend boleh
--     dipanggil ahli via PostgREST (SECURITY DEFINER, EXECUTE default kepada PUBLIC)
--     → revoke daripada anon/authenticated; service_role sahaja.
--  5) affiliate_applications unique(user_id) halang mohon semula selepas ditolak
--     → unik hanya untuk permohonan 'pending'.
--  6) products.affiliate_pct tiada had → check 0..1.
--  7) affiliate_clicks (baharu): klik pautan direkod di pelayan → tetingkap 30 hari
--     dikuatkuasa ikut masa klik pelayan (bukan localStorage), kiraan klik & kadar tukaran.
--  8) affiliate_attributions: click_id, order_number, lp_slug, line_gross (kasar;
--     line_subtotal kini BERSIH diskaun), credit_after (tahan), reversed_at/reason.
--  9) RPC atomik: jadual kredit, kredit yang cukup tempoh (semak semula status order
--     & is_affiliate), reversal (credited→tolak baki, pending→batal), permohonan
--     pengeluaran (kunci baris + tolak + insert dalam satu transaksi), peralihan status
--     pengeluaran (mesin keadaan; rejected pulangkan baki).
--
-- Additive. Idempotent — selamat dijalankan semula. Tiada data dipadam.
-- Jadual lama (affiliate_commissions, referrals) tidak disentuh.
-- ============================================================

-- ── 1) PROFILES — kunci lajur sensitif daripada kemas kini sendiri ──────────
-- Berjalan untuk permintaan berJWT (auth.uid() ada) oleh bukan-admin: nilai lama
-- dikekalkan SENYAP (bukan raise) supaya borang profil yang hantar baris penuh tak patah.
-- Service role / SQL editor (auth.uid() null) tidak terjejas.
create or replace function public.trg_fn_protect_profile_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.is_admin          := old.is_admin;
    new.is_affiliate      := old.is_affiliate;
    new.affiliate_balance := old.affiliate_balance;
    new.referral_code     := old.referral_code;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_cols on public.profiles;
create trigger trg_protect_profile_cols
  before update on public.profiles
  for each row execute function public.trg_fn_protect_profile_cols();

comment on function public.trg_fn_protect_profile_cols() is
  'Kunci is_admin/is_affiliate/affiliate_balance/referral_code daripada kemas kini sendiri oleh ahli (migration 165).';

-- ── 2) WITHDRAWALS — buang polisi INSERT terbuka ────────────────────────────
drop policy if exists "affiliate inserts own withdrawal" on public.affiliate_withdrawals;

-- ── 3) INVITES — buang SELECT umum ──────────────────────────────────────────
drop policy if exists "public read invite by token" on public.affiliate_invites;

-- ── 4) RPC baki/mata — service_role sahaja ──────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.increment_affiliate_balance(uuid, numeric)',
    'public.increment_points(uuid, integer)',
    'public.increment_spend(uuid, numeric)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- ── 5) APPLICATIONS — benarkan mohon semula selepas ditolak ─────────────────
alter table public.affiliate_applications drop constraint if exists affiliate_applications_user_id_key;
create unique index if not exists uq_aff_app_pending
  on public.affiliate_applications(user_id) where status = 'pending';

-- ── 6) PRODUCTS — had kadar komisen 0..1 ────────────────────────────────────
alter table public.products drop constraint if exists products_affiliate_pct_range;
alter table public.products add constraint products_affiliate_pct_range
  check (affiliate_pct >= 0 and affiliate_pct <= 1);

-- ── 7) KLIK pautan affiliate ────────────────────────────────────────────────
create table if not exists public.affiliate_clicks (
  id           uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.profiles(id) on delete cascade,
  code         text not null,
  scope        text not null default '*',          -- '*' (seluruh kedai) | <slug produk> | 'lp:<slug>'
  path         text,
  product_id   uuid references public.products(id) on delete set null,
  lp_slug      text,
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_aff_clicks_affiliate_time on public.affiliate_clicks(affiliate_id, created_at desc);
create index if not exists idx_aff_clicks_dedupe on public.affiliate_clicks(affiliate_id, ip_hash, scope, created_at desc);
comment on table public.affiliate_clicks is
  'Klik pautan affiliate (?aff=KOD) direkod di pelayan — asas tetingkap attribution & kadar tukaran (migration 165).';

alter table public.affiliate_clicks enable row level security;
drop policy if exists "aff_clicks: affiliate sees own" on public.affiliate_clicks;
drop policy if exists "aff_clicks: admin all"          on public.affiliate_clicks;
create policy "aff_clicks: affiliate sees own" on public.affiliate_clicks
  for select using (affiliate_id = auth.uid() or public.is_admin());
create policy "aff_clicks: admin all" on public.affiliate_clicks
  for all using (public.is_admin()) with check (public.is_admin());
-- Insert hanya melalui /api/affiliate/click (service role).

-- ── 8) ATTRIBUTIONS — lajur tambahan ────────────────────────────────────────
alter table public.affiliate_attributions
  add column if not exists click_id        uuid references public.affiliate_clicks(id) on delete set null,
  add column if not exists order_number    text,
  add column if not exists lp_slug         text,
  add column if not exists line_gross      numeric(10,2),
  add column if not exists credit_after    timestamptz,
  add column if not exists reversed_at     timestamptz,
  add column if not exists reversed_reason text;
create index if not exists idx_aff_attr_due on public.affiliate_attributions(credit_after) where status = 'pending';
comment on column public.affiliate_attributions.line_subtotal is 'Asas komisen BERSIH diskaun (promo/flash/mata) — line_gross = sebelum diskaun (migration 165).';
comment on column public.affiliate_attributions.credit_after  is 'Masa paling awal boleh dikredit = delivered+dibayar + affiliate_hold_days (migration 165).';

-- Tetapan
insert into public.app_settings (key, value) values
  ('affiliate_hold_days',    '7'),
  ('affiliate_min_withdraw', '10'),
  ('affiliate_notify_wa',    'off')
on conflict (key) do nothing;

-- ── 9) RPC ──────────────────────────────────────────────────────────────────

-- 9a) Jadualkan kredit: dipanggil bila order delivered+dibayar (order-delivered.ts).
create or replace function public.affiliate_schedule_credit(p_source text, p_order_id uuid, p_hold_days integer default 7)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare n integer;
begin
  update public.affiliate_attributions
     set credit_after = now() + make_interval(days => greatest(0, coalesce(p_hold_days, 7)))
   where order_source = p_source and order_id = p_order_id
     and status = 'pending' and credit_after is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 9b) Kredit yang cukup tempoh tahan — SATU transaksi: semak semula order masih
--     delivered & tak refund, affiliate masih aktif; yang gagal → reversed.
--     Juga sapu pending yang ordernya dibatalkan melalui laluan lain (CHIP gagal,
--     pelanggan batal, dsb.). Dipanggil cron /api/cron/affiliate-credit.
create or replace function public.affiliate_credit_due(p_limit integer default 300)
returns table (affiliate_id uuid, total numeric, n integer)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  update public.affiliate_attributions a
     set status = 'reversed', reversed_at = now(), reversed_reason = 'order_cancelled'
   where a.status = 'pending'
     and (
       (a.order_source = 'order' and exists (
          select 1 from public.orders o
           where o.id = a.order_id and (o.status in ('cancelled','refunded') or o.payment_status = 'refunded')))
       or
       (a.order_source = 'lp_guest' and exists (
          select 1 from public.lp_guest_orders l
           where l.id = a.order_id and (l.status in ('cancelled','refunded') or l.payment_status = 'refunded')))
     );

  return query
  with due as (
    select a.id, a.affiliate_id as aff, a.amount, a.order_source, a.order_id
      from public.affiliate_attributions a
     where a.status = 'pending' and a.credit_after is not null and a.credit_after <= now()
     order by a.credit_after
     limit greatest(1, coalesce(p_limit, 300))
     for update skip locked
  ), judged as (
    select d.id, d.aff, d.amount,
      case when d.order_source = 'order'
           then exists (select 1 from public.orders o
                         where o.id = d.order_id and o.status = 'delivered' and coalesce(o.payment_status,'') <> 'refunded')
           else exists (select 1 from public.lp_guest_orders l
                         where l.id = d.order_id and l.status = 'delivered' and coalesce(l.payment_status,'') <> 'refunded')
      end as order_ok,
      exists (select 1 from public.profiles p where p.id = d.aff and p.is_affiliate) as aff_ok
      from due d
  ), voided as (
    update public.affiliate_attributions a
       set status = 'reversed', reversed_at = now(),
           reversed_reason = case when not j.order_ok then 'order_not_delivered' else 'affiliate_inactive' end
      from judged j
     where a.id = j.id and (not j.order_ok or not j.aff_ok)
     returning a.id
  ), credited as (
    update public.affiliate_attributions a
       set status = 'credited', credited_at = now()
      from judged j
     where a.id = j.id and j.order_ok and j.aff_ok
     returning a.affiliate_id as aff, a.amount
  ), sums as (
    select c.aff, sum(c.amount) as tot, count(*)::integer as cnt from credited c group by c.aff
  ), bumped as (
    update public.profiles p
       set affiliate_balance = p.affiliate_balance + s.tot
      from sums s
     where p.id = s.aff
     returning p.id as aff, s.tot, s.cnt
  )
  select b.aff, b.tot, b.cnt from bumped b;
end;
$$;

-- 9c) Reversal bila order refund/batal: credited → tolak baki; pending → batal sahaja.
create or replace function public.affiliate_reverse_order(p_source text, p_order_id uuid, p_reason text default 'refunded')
returns integer
language plpgsql security definer
set search_path = public
as $$
declare r record; n integer := 0;
begin
  for r in
    update public.affiliate_attributions
       set status = 'reversed', reversed_at = now(), reversed_reason = coalesce(p_reason, 'refunded')
     where order_source = p_source and order_id = p_order_id and status = 'credited'
     returning affiliate_id, amount
  loop
    update public.profiles set affiliate_balance = affiliate_balance - r.amount where id = r.affiliate_id;
    n := n + 1;
  end loop;

  update public.affiliate_attributions
     set status = 'reversed', reversed_at = now(), reversed_reason = coalesce(p_reason, 'cancelled')
   where order_source = p_source and order_id = p_order_id and status = 'pending';
  return n;
end;
$$;

-- 9d) Permohonan pengeluaran — atomik (kunci baris profil → semak → tolak → insert).
--     Ralat: not_affiliate | min_amount | pending_exists | insufficient
create or replace function public.affiliate_request_withdrawal(
  p_affiliate uuid, p_amount numeric, p_bank text, p_account text, p_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_bal numeric; v_is boolean; v_min numeric; v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'min_amount'; end if;
  select coalesce(nullif(value,'')::numeric, 10) into v_min from public.app_settings where key = 'affiliate_min_withdraw';
  if v_min is null then v_min := 10; end if;
  if p_amount < v_min then raise exception 'min_amount'; end if;

  select affiliate_balance, is_affiliate into v_bal, v_is
    from public.profiles where id = p_affiliate for update;
  if not coalesce(v_is, false) then raise exception 'not_affiliate'; end if;
  if exists (select 1 from public.affiliate_withdrawals
              where affiliate_id = p_affiliate and status in ('pending','approved')) then
    raise exception 'pending_exists';
  end if;
  if coalesce(v_bal, 0) < p_amount then raise exception 'insufficient'; end if;

  update public.profiles set affiliate_balance = affiliate_balance - p_amount where id = p_affiliate;
  insert into public.affiliate_withdrawals (affiliate_id, amount, bank_name, bank_account, account_name, status)
  values (p_affiliate, round(p_amount, 2), p_bank, p_account, p_name, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

-- 9e) Peralihan status pengeluaran — mesin keadaan:
--     pending  → approved | rejected | paid
--     approved → paid | rejected
--     paid / rejected → muktamad (raise 'final')
--     rejected pulangkan amaun ke baki. Ralat: not_found | final | bad_status | bad_transition
create or replace function public.affiliate_withdrawal_set_status(p_id uuid, p_status text, p_note text default null)
returns text
language plpgsql security definer
set search_path = public
as $$
declare v record;
begin
  if p_status not in ('approved','rejected','paid') then raise exception 'bad_status'; end if;
  select * into v from public.affiliate_withdrawals where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v.status in ('paid','rejected') then raise exception 'final'; end if;
  if v.status = 'approved' and p_status = 'approved' then raise exception 'bad_transition'; end if;

  update public.affiliate_withdrawals
     set status = p_status,
         admin_note = coalesce(nullif(trim(p_note), ''), admin_note),
         processed_at = now()
   where id = p_id;

  if p_status = 'rejected' then
    update public.profiles set affiliate_balance = affiliate_balance + v.amount where id = v.affiliate_id;
  end if;
  return p_status;
end;
$$;

-- Kebenaran: semua RPC di atas — service_role sahaja (dipanggil dari API Next.js).
do $$
declare f text;
begin
  foreach f in array array[
    'public.affiliate_schedule_credit(text, uuid, integer)',
    'public.affiliate_credit_due(integer)',
    'public.affiliate_reverse_order(text, uuid, text)',
    'public.affiliate_request_withdrawal(uuid, numeric, text, text, text)',
    'public.affiliate_withdrawal_set_status(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

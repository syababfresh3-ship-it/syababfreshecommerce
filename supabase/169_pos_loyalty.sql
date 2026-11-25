-- 169: Mata loyalty di POS (pemilik 25 Nov 2026) — ahli kumpul mata di kaunter (formula sama dengan online:
-- RM1 × pengganda tier, siling 5000), bukan ahli → mata MENUNGGU ikut telefon (dituntut automatik bila daftar
-- dengan nombor sama), tebus terus dari tiket (100 mata = RM1) dengan had & audit, dan void membalikkan semua.
-- Semua kewangan di DB: tebus berlaku DALAM pos_create_sale (atomik — kalau mata tak cukup, jualan ditolak).
-- Idempoten. Jalankan SEBELUM deploy kod yang menghantar `points` (tanpa 169 server tolak tebusan dengan 503).

-- ── 1) Lajur pada jualan ───────────────────────────────────────────────────
alter table public.pos_sales
  add column if not exists loyalty_user_id     uuid references public.profiles(id) on delete set null,
  add column if not exists points_redeemed     integer       not null default 0,
  add column if not exists points_discount     numeric(10,2) not null default 0,
  add column if not exists points_earned       integer       not null default 0,
  add column if not exists points_pending      integer       not null default 0,
  add column if not exists loyalty_reversed_at timestamptz;
create index if not exists pos_sales_loyalty_user_idx on public.pos_sales(loyalty_user_id) where loyalty_user_id is not null;

-- ── 2) Mata menunggu (bukan ahli) ─────────────────────────────────────────
create table if not exists public.loyalty_pending (
  id              uuid primary key default gen_random_uuid(),
  phone_norm      text not null,                         -- 60xxxxxxxxx
  points          integer not null check (points > 0),
  source          text not null default 'pos',
  ref_id          uuid,                                  -- pos_sales.id
  ref_label       text,                                  -- no resit
  created_at      timestamptz not null default now(),
  claimed_at      timestamptz,
  claimed_user_id uuid references public.profiles(id) on delete set null
);
create index if not exists loyalty_pending_phone_open_idx on public.loyalty_pending(phone_norm) where claimed_at is null;
create index if not exists loyalty_pending_ref_idx on public.loyalty_pending(ref_id) where ref_id is not null;
alter table public.loyalty_pending enable row level security;   -- tiada polisi = service_role sahaja

-- Normalisasi telefon seperti find_profile_by_phone (9 digit terakhir)
create or replace function public.phone_tail9(p text)
returns text language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 9)
$$;

-- ── 3) Carian ahli ikut telefon (untuk tiket & carian pelanggan POS) ──────
create or replace function public.pos_loyalty_lookup(p_phone text)
returns table (user_id uuid, full_name text, total_points integer, multiplier numeric, pending_points integer)
language sql stable security definer set search_path = public as $$
  with m as (
    select p.id, p.full_name, p.total_points, coalesce(t.multiplier, 1)::numeric as multiplier
      from public.profiles p left join public.loyalty_tiers t on t.id = p.tier_id
     where length(public.phone_tail9(p.phone)) >= 9 and public.phone_tail9(p.phone) = public.phone_tail9(p_phone)
     order by p.created_at limit 1
  ), pend as (
    select coalesce(sum(points), 0)::integer as pts from public.loyalty_pending
     where claimed_at is null and public.phone_tail9(phone_norm) = public.phone_tail9(p_phone)
  )
  select m.id, m.full_name, m.total_points, m.multiplier, pend.pts from pend left join m on true;
$$;

-- ── 4) Beri mata selepas jualan dibayar (sekali sahaja per jualan) ─────────
create or replace function public.pos_loyalty_earn(p_sale uuid, p_user uuid, p_points integer, p_amount numeric, p_receipt text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_bal integer;
begin
  update public.pos_sales set loyalty_awarded_at = now(), loyalty_user_id = coalesce(loyalty_user_id, p_user), points_earned = p_points
   where id = p_sale and loyalty_awarded_at is null;
  if not found then
    select total_points into v_bal from public.profiles where id = p_user; return coalesce(v_bal, 0);
  end if;
  if p_points > 0 then
    insert into public.loyalty_transactions (user_id, points, type, description)
    values (p_user, p_points, 'earn', 'Belian kaunter ' || coalesce(p_receipt, p_sale::text));
    update public.profiles set total_points = total_points + p_points, total_spend = total_spend + coalesce(p_amount, 0)
     where id = p_user returning total_points into v_bal;
  else
    select total_points into v_bal from public.profiles where id = p_user;
  end if;
  return coalesce(v_bal, 0);
end;
$$;

-- Bukan ahli: simpan menunggu (sekali sahaja per jualan)
create or replace function public.pos_loyalty_pending(p_sale uuid, p_phone text, p_points integer, p_receipt text)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if p_points <= 0 or coalesce(p_phone, '') = '' then return 0; end if;
  update public.pos_sales set loyalty_awarded_at = now(), points_pending = p_points where id = p_sale and loyalty_awarded_at is null;
  if not found then return 0; end if;
  insert into public.loyalty_pending (phone_norm, points, source, ref_id, ref_label) values (p_phone, p_points, 'pos', p_sale, p_receipt);
  return p_points;
end;
$$;

-- ── 5) Void → balikkan mata (sekali sahaja) ──────────────────────────────
create or replace function public.pos_loyalty_reverse(p_sale uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select id, receipt_no, loyalty_user_id, points_redeemed, points_earned, points_pending into s
    from public.pos_sales where id = p_sale and loyalty_reversed_at is null for update;
  if not found then return jsonb_build_object('reversed', false); end if;
  update public.pos_sales set loyalty_reversed_at = now() where id = p_sale;
  if s.loyalty_user_id is not null and s.points_earned > 0 then
    update public.profiles set total_points = greatest(0, total_points - s.points_earned) where id = s.loyalty_user_id;
    insert into public.loyalty_transactions (user_id, points, type, description)
    values (s.loyalty_user_id, -s.points_earned, 'adjustment', 'Void jualan kaunter ' || coalesce(s.receipt_no, s.id::text) || ' (mata diperoleh ditarik)');
  end if;
  if s.loyalty_user_id is not null and s.points_redeemed > 0 then
    update public.profiles set total_points = total_points + s.points_redeemed where id = s.loyalty_user_id;
    insert into public.loyalty_transactions (user_id, points, type, description)
    values (s.loyalty_user_id, s.points_redeemed, 'adjustment', 'Void jualan kaunter ' || coalesce(s.receipt_no, s.id::text) || ' (mata ditebus dipulangkan)');
  end if;
  delete from public.loyalty_pending where ref_id = p_sale and claimed_at is null;
  return jsonb_build_object('reversed', true, 'earned', s.points_earned, 'redeemed', s.points_redeemed, 'pending', s.points_pending);
end;
$$;

-- ── 6) Tuntut mata menunggu bila profil ada telefon (daftar / kemas kini profil) ──
create or replace function public.loyalty_claim_pending_fn()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tail text; v_sum integer; v_n integer;
begin
  v_tail := public.phone_tail9(new.phone);
  if length(v_tail) < 9 then return new; end if;
  if tg_op = 'UPDATE' and public.phone_tail9(old.phone) = v_tail then return new; end if;
  with c as (
    update public.loyalty_pending set claimed_at = now(), claimed_user_id = new.id
     where claimed_at is null and public.phone_tail9(phone_norm) = v_tail
     returning points
  ) select coalesce(sum(points), 0), count(*) into v_sum, v_n from c;
  if v_sum > 0 then
    insert into public.loyalty_transactions (user_id, points, type, description)
    values (new.id, v_sum, 'earn', 'Mata belian kaunter dituntut (' || v_n || ' resit)');
    update public.profiles set total_points = total_points + v_sum where id = new.id;   -- tidak mencetus semula (bukan UPDATE OF phone)
  end if;
  return new;
end;
$$;
drop trigger if exists trg_loyalty_claim_pending on public.profiles;
create trigger trg_loyalty_claim_pending
  after insert or update of phone on public.profiles
  for each row execute function public.loyalty_claim_pending_fn();

-- ── 7) pos_create_sale: terima tebusan mata & tolak baki DALAM transaksi yang sama ──
create or replace function public.pos_create_sale(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn uuid := (p->>'client_txn_id')::uuid;
  v_id uuid;
  v_receipt text;
  v_status text := coalesce(p->>'status', 'paid');
  v_existing record;
  v_user uuid := nullif(p->>'loyalty_user_id','')::uuid;
  v_pts integer := coalesce((p->>'points_redeemed')::integer, 0);
  v_pts_rm numeric := coalesce((p->>'points_discount')::numeric, 0);
  v_bal integer;
begin
  if v_txn is null then raise exception 'client_txn_id diperlukan'; end if;

  select id, receipt_no, status into v_existing from public.pos_sales where client_txn_id = v_txn;
  if found then
    return jsonb_build_object('id', v_existing.id, 'receipt_no', v_existing.receipt_no, 'status', v_existing.status, 'duplicate', true);
  end if;

  v_receipt := public.pos_next_receipt_no();

  begin
    insert into public.pos_sales (
      receipt_no, local_ref, client_txn_id, register_id, shift_id, cashier_id, created_by,
      customer_id, customer_phone, customer_name, status,
      subtotal, discount_total, discount_note, promo_code_id, promo_code, promo_discount,
      rounding_adj, total, paid_total, change_given, weight_kg_total,
      sold_at, paid_at, offline, note,
      loyalty_user_id, points_redeemed, points_discount
    ) values (
      v_receipt, p->>'local_ref', v_txn,
      nullif(p->>'register_id','')::uuid, nullif(p->>'shift_id','')::uuid, nullif(p->>'cashier_id','')::uuid, nullif(p->>'created_by','')::uuid,
      nullif(p->>'customer_id','')::uuid, nullif(p->>'customer_phone',''), nullif(p->>'customer_name',''), v_status,
      coalesce((p->>'subtotal')::numeric, 0), coalesce((p->>'discount_total')::numeric, 0), nullif(p->>'discount_note',''),
      nullif(p->>'promo_code_id','')::uuid, nullif(p->>'promo_code',''), coalesce((p->>'promo_discount')::numeric, 0),
      coalesce((p->>'rounding_adj')::numeric, 0), coalesce((p->>'total')::numeric, 0),
      coalesce((p->>'paid_total')::numeric, 0), coalesce((p->>'change_given')::numeric, 0), coalesce((p->>'weight_kg_total')::numeric, 0),
      coalesce((p->>'sold_at')::timestamptz, now()),
      case when v_status = 'paid' then coalesce((p->>'paid_at')::timestamptz, now()) else null end,
      coalesce((p->>'offline')::boolean, false), nullif(p->>'note',''),
      v_user, greatest(0, v_pts), greatest(0, v_pts_rm)
    ) returning id into v_id;
  exception when unique_violation then
    select id, receipt_no, status into v_existing from public.pos_sales where client_txn_id = v_txn;
    return jsonb_build_object('id', v_existing.id, 'receipt_no', v_existing.receipt_no, 'status', v_existing.status, 'duplicate', true);
  end;

  -- Tebusan mata: tolak baki ahli dalam transaksi ini; tak cukup → seluruh jualan dibatalkan (raise).
  if v_pts > 0 then
    if v_user is null then raise exception 'POINTS_NO_MEMBER'; end if;
    select total_points into v_bal from public.profiles where id = v_user for update;
    if v_bal is null or v_bal < v_pts then raise exception 'POINTS_INSUFFICIENT'; end if;
    update public.profiles set total_points = total_points - v_pts where id = v_user;
    insert into public.loyalty_transactions (user_id, points, type, description)
    values (v_user, -v_pts, 'redeem', 'Tebus di kaunter ' || v_receipt || ' (−RM' || to_char(v_pts_rm, 'FM999990.00') || ')');
  end if;

  insert into public.pos_sale_items (
    sale_id, sort, product_id, variant_id, name, variant_name, sku, barcode, sell_by_weight,
    qty, unit, unit_price, catalog_price, line_discount, line_total
  )
  select v_id, coalesce((i->>'sort')::int, ord::int - 1),
         nullif(i->>'product_id','')::uuid, nullif(i->>'variant_id','')::uuid,
         coalesce(i->>'name', 'Item'), nullif(i->>'variant_name',''), nullif(i->>'sku',''), nullif(i->>'barcode',''),
         coalesce((i->>'sell_by_weight')::boolean, false),
         coalesce((i->>'qty')::numeric, 1), coalesce(nullif(i->>'unit',''), 'pcs'),
         coalesce((i->>'unit_price')::numeric, 0), (i->>'catalog_price')::numeric,
         coalesce((i->>'line_discount')::numeric, 0), coalesce((i->>'line_total')::numeric, 0)
  from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) with ordinality as t(i, ord);

  insert into public.pos_payments (sale_id, method, amount, tendered, change_given, ref, status, chip_purchase_id, checkout_url, paid_at)
  select v_id, m->>'method', coalesce((m->>'amount')::numeric, 0), (m->>'tendered')::numeric, (m->>'change_given')::numeric,
         nullif(m->>'ref',''), coalesce(nullif(m->>'status',''), 'paid'), nullif(m->>'chip_purchase_id',''), nullif(m->>'checkout_url',''),
         case when coalesce(nullif(m->>'status',''), 'paid') = 'paid' then coalesce((m->>'paid_at')::timestamptz, now()) else null end
  from jsonb_array_elements(coalesce(p->'payments', '[]'::jsonb)) as t(m);

  return jsonb_build_object('id', v_id, 'receipt_no', v_receipt, 'status', v_status, 'duplicate', false);
end;
$$;

-- ── 8) Kebenaran: service_role sahaja (POS API guna klien admin) ─────────
do $$ declare f text; begin
  foreach f in array array['pos_loyalty_lookup(text)','pos_loyalty_earn(uuid,uuid,integer,numeric,text)','pos_loyalty_pending(uuid,text,integer,text)','pos_loyalty_reverse(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

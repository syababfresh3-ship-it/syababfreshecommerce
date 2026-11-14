-- 161_pos_issue_transfer_rpc.sql — Issue DO (pindahan stok) dalam SATU transaksi.
--
-- Masalah (audit 14 Nov 2026): lib/pos/outlets.ts issueTransfer menanda status 'issued' + stock_applied_at
-- DAHULU, kemudian menggerakkan stok baris demi baris melalui beberapa panggilan REST (2 RPC + 1 insert lejar
-- setiap baris). Timeout/crash separuh jalan pada DO 40 baris → DO nampak "issued", stok HQ ditolak sebahagian,
-- outlet dikreditkan kurang, dan tuntutan status sudah dimakan — tiada cara ulang.
--
-- Penyelesaian: RPC ini kunci baris DO (for update), ambil nombor DO, gerakkan SEMUA stok (HQ pek:
-- pos_deduct_stock / restore_stock; outlet: pos_outlet_stock_apply + lejar pos_stock_movements) dan tukar status
-- dalam satu transaksi. Gagal di mana-mana → semuanya undur, DO kekal draf. Peraturan stok sama seperti kod TS
-- (HQ kg tak disentuh; kekurangan HQ direkod hq_stock_short, tak menghalang; outlet clamp 0 + 'short' dalam nota).
-- Kod TS jatuh ke laluan lama jika RPC belum wujud (PGRST202/42883). Idempotent: create or replace.

create or replace function public.pos_issue_transfer(p_transfer uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t   record;
  f   record;   -- outlet sumber
  d   record;   -- outlet destinasi
  it  record;
  v_doc   text;
  v_short numeric;
  v_now   timestamptz := now();
begin
  select * into t from public.pos_transfers where id = p_transfer for update;
  if not found then
    return jsonb_build_object('ok', false, 'status', 404, 'error', 'Transfer not found');
  end if;
  if t.status <> 'draft' then
    return jsonb_build_object('ok', false, 'status', 409, 'error', 'Transfer is already ' || t.status);
  end if;
  if not exists (select 1 from public.pos_transfer_items where transfer_id = p_transfer) then
    return jsonb_build_object('ok', false, 'status', 400, 'error', 'Add at least one line before issuing');
  end if;

  select * into f from public.pos_outlets where id = t.from_outlet_id;
  select * into d from public.pos_outlets where id = t.to_outlet_id;
  v_doc := public.pos_next_transfer_no();

  for it in select * from public.pos_transfer_items where transfer_id = p_transfer order by sort loop
    continue when it.product_id is null;   -- baris bebas (nama sahaja) — tiada stok

    -- Keluar dari sumber
    if f.type = 'hq' then
      if it.base_unit = 'pcs' then
        v_short := public.pos_deduct_stock(it.product_id, it.variant_id, round(it.base_qty)::integer);
        if coalesce(v_short, 0) > 0 then
          update public.pos_transfer_items set hq_stock_short = v_short where id = it.id;
        end if;
      end if;
    else
      v_short := coalesce(public.pos_outlet_stock_apply(f.id, it.product_id, it.variant_id, it.base_unit, -it.base_qty), 0);
      insert into public.pos_stock_movements (outlet_id, product_id, variant_id, unit, qty, type, ref_type, ref_id, note, created_by)
      values (f.id, it.product_id, it.variant_id, it.base_unit, -(it.base_qty - v_short), 'transfer_out', 'transfer', t.id,
              case when v_short > 0 then v_doc || ' · short ' || v_short::text else v_doc end, p_user);
    end if;

    -- Masuk ke destinasi
    if d.type = 'hq' then
      if it.base_unit = 'pcs' then
        perform public.restore_stock(it.product_id, it.variant_id, round(it.base_qty)::integer);
      end if;
    else
      perform public.pos_outlet_stock_apply(d.id, it.product_id, it.variant_id, it.base_unit, it.base_qty);
      insert into public.pos_stock_movements (outlet_id, product_id, variant_id, unit, qty, type, ref_type, ref_id, note, created_by)
      values (d.id, it.product_id, it.variant_id, it.base_unit, it.base_qty, 'transfer_in', 'transfer', t.id, v_doc, p_user);
    end if;
  end loop;

  update public.pos_transfers
     set status = 'issued', doc_no = v_doc, issued_at = v_now, issued_by = p_user, stock_applied_at = v_now, updated_at = v_now
   where id = p_transfer;

  return jsonb_build_object('ok', true, 'doc_no', v_doc);
end $$;

-- Hanya service role boleh panggil (corak 155/157).
revoke execute on function public.pos_issue_transfer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pos_issue_transfer(uuid, uuid) to service_role;

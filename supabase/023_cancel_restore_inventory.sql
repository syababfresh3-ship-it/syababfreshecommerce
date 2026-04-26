-- ============================================================
-- 023: cancel_order — pulihkan stok bila order dibatalkan
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_order(p_order_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order record;
  v_item  record;
BEGIN
  SELECT id, user_id, status, created_at
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Pesanan tidak dijumpai');
  END IF;

  IF v_order.user_id <> auth.uid() THEN
    RETURN json_build_object('ok', false, 'error', 'Tidak dibenarkan');
  END IF;

  IF v_order.status NOT IN ('pending', 'confirmed') THEN
    RETURN json_build_object('ok', false, 'error', 'Pesanan tidak boleh dibatalkan');
  END IF;

  IF extract(epoch FROM now() - v_order.created_at) > 1800 THEN
    RETURN json_build_object('ok', false, 'error', 'Masa batalkan telah tamat (30 minit)');
  END IF;

  -- Pulihkan stok hanya untuk 'confirmed' (stok dah ditolak)
  -- 'pending' = belum bayar FPX, stok belum ditolak lagi
  IF v_order.status = 'confirmed' THEN
    FOR v_item IN
      SELECT product_id, variant_id, quantity
        FROM public.order_items
        WHERE order_id = p_order_id
    LOOP
      IF v_item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
          SET stock = stock + v_item.quantity
          WHERE id = v_item.variant_id;
      ELSE
        -- Masukkan semula sebagai batch baru (expiry 1 tahun)
        INSERT INTO public.inventory_batches (product_id, quantity, batch_date, expiry_date)
          VALUES (v_item.product_id, v_item.quantity, current_date, current_date + interval '365 days');
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
    SET status = 'cancelled', cancelled_at = now()
    WHERE id = p_order_id;

  RETURN json_build_object('ok', true);
END;
$$;

"use client";

// Redesign v2 — Pesan Semula: ambil produk+variant SEMASA (harga/stok terkini), tambah ke troli.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/lib/stores/cart";

export type ReorderItem = { product_id: string; variant_id: string | null; quantity: number };

export function SfReorderButton({ items }: { items: ReorderItem[] }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  async function reorder() {
    if (busy) return;
    setBusy(true);
    try {
      const sb = createClient();
      const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
      const variantIds = [...new Set(items.map((i) => i.variant_id).filter(Boolean))] as string[];
      const [pRes, vRes] = await Promise.all([
        sb.from("products").select("*").in("id", productIds).eq("is_active", true),
        variantIds.length
          ? sb.from("product_variants").select("*").in("id", variantIds).eq("is_active", true)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pMap = new Map<string, any>((pRes.data ?? []).map((p: any) => [p.id, p]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vMap = new Map<string, any>((vRes.data ?? []).map((v: any) => [v.id, v]));

      let added = 0, skipped = 0;
      for (const it of items) {
        const p = pMap.get(it.product_id);
        if (!p) { skipped++; continue; }
        const v = it.variant_id ? vMap.get(it.variant_id) ?? null : null;
        if (it.variant_id && !v) { skipped++; continue; } // variant dah tiada/tak aktif
        addItem(p, it.quantity || 1, v);
        added++;
      }

      if (added === 0) { toast.error("Produk dalam pesanan ini tidak lagi tersedia"); return; }
      toast.success(`${added} item ditambah ke troli${skipped ? ` · ${skipped} dilangkau` : ""}`);
      router.push("/cart");
    } catch {
      toast.error("Gagal pesan semula. Cuba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); reorder(); }}
      disabled={busy}
      className="w-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-[#E11D2A] py-1.5 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      Pesan Semula
    </button>
  );
}

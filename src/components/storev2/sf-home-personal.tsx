"use client";

// Home peribadi — pill Kad Setia + Points SEBENAR & Pesanan Terakhir sebenar.
// Client component supaya page kekal cache (revalidate 300); data peribadi
// dimuat selepas mount ikut sesi. Guest → paparan default sama macam dulu.
// RLS: stamp_cards owner-read, profiles/orders own-row — anon key selamat.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Leaf, Star, ChevronRight, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ReorderButton } from "@/app/orders/[id]/reorder-button";

interface LastOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  order_items: {
    product_id: string;
    product_name: string;
    product_image: string | null;
    unit_price: number;
    quantity: number;
  }[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu", confirmed: "Disahkan", preparing: "Disediakan",
  delivering: "Dihantar", delivered: "Selesai", cancelled: "Dibatal", refunded: "Refund",
};

// `middle` = kandungan antara pills dan Pesanan Terakhir (promo + trust strip
// dari server page) — kekalkan susunan visual asal dengan SATU fetch sahaja.
export function SfHomePersonal({ middle }: { middle?: React.ReactNode }) {
  const [stamps, setStamps] = useState<number | null>(null);
  const [target, setTarget] = useState(9);
  const [points, setPoints] = useState<number | null>(null);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.auth.getUser() as Promise<any>).then(async (res) => {
      const user = res.data?.user;
      if (!user) return;
      setLoggedIn(true);
      const [{ data: card }, { data: prof }, { data: order }, { data: tgt }] = await Promise.all([
        supabase.from("stamp_cards").select("stamps").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("total_points").eq("id", user.id).maybeSingle(),
        supabase
          .from("orders")
          .select("id, order_number, status, total, created_at, order_items(product_id, product_name, product_image, unit_price, quantity)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "kad_setia_target").maybeSingle(),
      ]);
      setStamps(card?.stamps ?? 0);
      setPoints(prof?.total_points ?? 0);
      setLastOrder((order as unknown as LastOrder) ?? null);
      if (tgt?.value) setTarget(Number(tgt.value) || 9);
    });
  }, []);

  return (
    <>
      {/* Stat pills */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Kad Setia — progress sebenar bila login */}
        <Link href="/loyalty" className="relative rounded-2xl bg-white border border-gray-200 p-4 block active:scale-[0.98] transition">
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] font-semibold text-gray-700">Kad Setia</span>
          </div>
          <div className="text-[22px] font-extrabold text-gray-900 mt-1 leading-none">
            {stamps !== null ? (
              <>
                {stamps}<span className="text-gray-400 text-[15px] font-bold">/{target} 🎁</span>
              </>
            ) : (
              <>
                {target}<span className="text-gray-400 text-[15px] font-bold"> = 🎁</span>
              </>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 leading-tight">
            {stamps !== null && stamps > 0
              ? `Lagi ${Math.max(0, target - stamps)} belian → buah free`
              : `Beli ${target} kali → buah free`}
          </p>
          <Leaf className="absolute top-4 right-4 h-[18px] w-[18px] text-brand-red-400" />
        </Link>
        {/* Syabab Points — baki sebenar bila login */}
        <Link href="/loyalty" className="relative rounded-2xl bg-white border border-gray-200 p-4 block">
          <span className="text-[12.5px] font-semibold text-gray-700">Syabab Points</span>
          <div className="text-[22px] font-extrabold text-gray-900 mt-1 leading-none">
            {points !== null ? points.toLocaleString() : 0}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 leading-tight">
            {points !== null && points > 0 ? `Boleh guna RM${(points / 100).toFixed(2)} diskaun` : "Kumpul setiap belian"}
          </p>
          <Star className="absolute top-4 right-4 h-[18px] w-[18px] text-amber-500 fill-amber-500" />
        </Link>
      </div>

      {middle}

      <SfLastOrderSection loggedIn={loggedIn} order={lastOrder} />
    </>
  );
}

function SfLastOrderSection({ loggedIn, order }: { loggedIn: boolean; order: LastOrder | null }) {
  return (
    <section className="pb-2 sf-last-order">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[16px] font-extrabold text-gray-900">Pesanan Terakhir</h3>
        <Link href="/orders" className="text-[13px] text-[#E11D2A] font-bold flex items-center gap-0.5">
          Lihat semua <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {order ? (
        <div className="rounded-2xl bg-white border border-gray-200 p-4 space-y-3">
          <Link href={`/orders/${order.id}`} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-gray-900 truncate">
                {order.order_items?.map((i) => i.product_name).slice(0, 2).join(", ")}
                {(order.order_items?.length ?? 0) > 2 ? ` +${order.order_items.length - 2} lagi` : ""}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {order.order_number} · {new Date(order.created_at).toLocaleDateString("ms-MY", { day: "2-digit", month: "short" })} · RM{Number(order.total).toFixed(2)}
              </p>
            </div>
            <span className="shrink-0 text-[10.5px] font-bold bg-[#F4F6F5] text-gray-600 rounded-full px-2.5 py-1">
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </Link>
          <ReorderButton
            items={(order.order_items ?? []).map((i) => ({
              product_id: i.product_id,
              product_name: i.product_name,
              product_image: i.product_image,
              unit_price: Number(i.unit_price),
              quantity: i.quantity,
            }))}
          />
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-gray-200 p-6 flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-full bg-[#F4F6F5] grid place-items-center">
            <ShoppingBag className="h-6 w-6 text-gray-400" />
          </div>
          <div className="text-[13.5px] font-semibold text-gray-500">
            {loggedIn ? "Belum ada pesanan lagi" : "Log masuk untuk lihat pesanan anda"}
          </div>
          <Link
            href={loggedIn ? "/products" : "/login"}
            className="mt-1 bg-[#E11D2A] text-white rounded-xl px-5 py-2.5 text-[13px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)] active:scale-95 transition"
          >
            {loggedIn ? "Mula Beli-belah" : "Log Masuk"}
          </Link>
        </div>
      )}
    </section>
  );
}

"use client";

// View Pesanan untuk GUEST (tak log masuk): CTA log masuk + jejak pesanan ikut telefon.
import { useState } from "react";
import Link from "next/link";
import { Search, Package, ChevronRight, Loader2, LogIn } from "lucide-react";
import { statusStyles, statusLabel } from "./status";

type TrackOrder = { id: string; order_number: string; status: string; total: number; created_at: string };

export function GuestOrders() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<TrackOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function track(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) { setError("Masukkan no. telefon yang sah"); return; }
    setError(""); setLoading(true); setOrders(null);
    try {
      const r = await fetch(`/api/store/track-orders?phone=${encodeURIComponent(phone)}`);
      const j = await r.json();
      if (!r.ok) { setError(j.error || "Gagal jejak. Cuba lagi."); return; }
      setOrders(j.orders ?? []);
    } catch {
      setError("Gagal jejak. Cuba lagi.");
    } finally { setLoading(false); }
  }

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <h1 className="text-[18px] font-extrabold text-gray-900">Pesanan</h1>

      {/* CTA log masuk */}
      <div className="rounded-2xl border border-[#E11D2A]/30 bg-[#FDECEC]/50 p-4">
        <p className="text-[14px] font-extrabold text-gray-900">Log masuk untuk sejarah penuh</p>
        <p className="text-[12px] text-gray-500 mt-0.5">Simpan pesanan, kumpul Syabab Points & jejak mudah.</p>
        <div className="flex gap-2 mt-3">
          <Link href="/login?redirect=/orders" className="flex-1 flex items-center justify-center gap-1.5 bg-[#E11D2A] text-white rounded-xl py-2.5 text-[13px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)]">
            <LogIn className="h-4 w-4" /> Log Masuk
          </Link>
          <Link href="/daftar?redirect=/orders" className="flex-1 grid place-items-center bg-white border border-gray-200 text-gray-700 rounded-xl py-2.5 text-[13px] font-bold">
            Daftar
          </Link>
        </div>
      </div>

      {/* Jejak ikut telefon */}
      <div className="rounded-2xl bg-white border border-gray-200 p-4">
        <p className="text-[13px] font-bold text-gray-900 mb-2">Jejak pesanan tanpa log masuk</p>
        <form onSubmit={track} className="flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="No. telefon (cth 0123456789)"
            className="flex-1 rounded-xl bg-[#F4F6F5] border border-gray-200 px-3.5 py-2.5 text-[14px] font-medium text-gray-900 outline-none focus:border-[#E11D2A]"
          />
          <button type="submit" disabled={loading} className="px-4 rounded-xl bg-gray-900 text-white text-[13px] font-bold disabled:opacity-50 grid place-items-center">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </form>
        <p className="text-[11px] text-gray-400 mt-1.5">Guna nombor yang sama seperti masa buat pesanan.</p>
        {error && <p className="text-[12px] text-red-500 font-semibold mt-2">{error}</p>}
      </div>

      {/* Keputusan */}
      {orders !== null && (
        orders.length === 0 ? (
          <div className="flex flex-col items-center text-center py-10 gap-2">
            <div className="h-12 w-12 rounded-full bg-[#F4F6F5] grid place-items-center">
              <Package className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-[13px] font-semibold text-gray-500">Tiada pesanan dijumpai</p>
            <p className="text-[12px] text-gray-400">Pastikan no. telefon sama seperti masa order.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((o) => (
              <Link key={o.id} href={`/resit/${o.id}`} className="block bg-white rounded-2xl border border-gray-200 px-4 py-3.5 active:scale-[0.99] transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] text-gray-400">{o.order_number}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyles[o.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {statusLabel[o.status] ?? o.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {new Date(o.created_at).toLocaleDateString("ms-MY", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-extrabold text-gray-900 text-[14px]">RM{Number(o.total).toFixed(2)}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}

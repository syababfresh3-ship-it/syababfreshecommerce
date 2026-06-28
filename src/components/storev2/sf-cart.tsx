"use client";

// Redesign v2 — Troli (Seksyen J): toggle mod + kad semak poskod (mod Penghantaran) +
// item rows (composite key produk+variant) + baris Syabab Points + pecahan kos + gate CTA.
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Minus, Plus, Trash2, ShoppingBag, AlertTriangle, ArrowRight, Store, Truck,
  ShieldCheck, Star, MapPin, Check, X, Loader2,
} from "lucide-react";
import { useCartStore } from "@/lib/stores/cart";
import { createClient } from "@/lib/supabase/client";

type Mode = "pickup" | "delivery";
type PcRes = { covered: boolean; fee?: number; area?: string; city?: string; error?: string };

export function SfCart() {
  const { items, updateQuantity, removeItem, getTotal } = useCartStore();
  const subtotal = getTotal();
  const [liveStock, setLiveStock] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<Mode>("delivery");

  // Poskod (mod Penghantaran)
  const [pc, setPc] = useState("");
  const [pcRes, setPcRes] = useState<PcRes | null>(null);
  const [pcBusy, setPcBusy] = useState(false);

  // Syabab Points
  const [points, setPoints] = useState<number | null>(null);
  const [guest, setGuest] = useState(true);

  // Pengesahan padam
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  // Mod fulfilment dikongsi dengan Checkout
  useEffect(() => {
    const saved = localStorage.getItem("sf_mode");
    if (saved === "pickup" || saved === "delivery") setMode(saved);
    const savedPc = localStorage.getItem("sf_postcode");
    if (savedPc) setPc(savedPc);
  }, []);
  const pick = (m: Mode) => { setMode(m); localStorage.setItem("sf_mode", m); };

  // Stok hidup
  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.map((i) => i.product.id);
    const supabase = createClient();
    supabase
      .from("product_stock")
      .select("product_id, available_stock")
      .in("product_id", ids)
      .then(({ data }: { data: { product_id: string; available_stock: number }[] | null }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        data.forEach((r) => { map[r.product_id] = r.available_stock; });
        setLiveStock(map);
      });
  }, [items.length]);

  // Syabab Points (jika log masuk)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      const user = data.user;
      if (!user) { setGuest(true); setPoints(null); return; }
      setGuest(false);
      supabase.from("profiles").select("total_points").eq("id", user.id).single()
        .then(({ data: p }: { data: { total_points: number | null } | null }) => setPoints(p?.total_points ?? 0));
    });
  }, []);

  async function checkPostcode() {
    if (!/^\d{5}$/.test(pc)) { setPcRes({ covered: false, error: "Poskod tidak sah" }); return; }
    setPcBusy(true);
    try {
      const r: PcRes = await fetch(`/api/delivery/check?postcode=${pc}`).then((x) => x.json());
      setPcRes(r);
      if (!r.error) localStorage.setItem("sf_postcode", pc);
    } catch {
      setPcRes({ covered: false, error: "Gagal semak. Cuba lagi." });
    } finally { setPcBusy(false); }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-[#F4F6F5] grid place-items-center mb-5">
          <ShoppingBag className="h-9 w-9 text-gray-300" />
        </div>
        <h2 className="text-[17px] font-extrabold text-gray-900 mb-1.5">Troli masih kosong</h2>
        <p className="text-[13px] text-gray-400 mb-7 leading-relaxed">Tambah buah segar ke troli untuk meneruskan</p>
        <Link href="/products" className="bg-[#E11D2A] text-white px-8 py-3 rounded-xl text-[14px] font-bold shadow-[0_6px_16px_rgba(225,29,42,0.32)] active:scale-95 transition">
          Lihat Produk
        </Link>
      </div>
    );
  }

  const hasStockIssue = items.some(({ product, variant, quantity }) => {
    const s = variant ? variant.stock : liveStock[product.id];
    return s !== undefined && quantity > s;
  });

  // Kos ikut zon
  const pcChecked = !!pcRes && !pcRes.error;
  const isKV = pcRes?.covered === true;
  const outsideKV = pcChecked && !isKV;
  const deliveryFee = mode === "pickup" ? 0 : isKV ? Number(pcRes?.fee ?? 0) : 0;
  const grandTotal = subtotal + deliveryFee;

  // Gate: pickup bebas; delivery perlu poskod disahkan
  const gateOpen = mode === "pickup" || pcChecked;

  return (
    <>
      <div className="px-4 pt-4 pb-44">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 bg-white border border-gray-200 rounded-full p-1 mb-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {([
            { m: "pickup" as Mode, icon: Store, label: "Ambil Sendiri" },
            { m: "delivery" as Mode, icon: Truck, label: "Penghantaran" },
          ]).map(({ m, icon: Icon, label }) => (
            <button
              key={m}
              onClick={() => pick(m)}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[13px] font-bold transition ${
                mode === m ? "bg-[#E11D2A] text-white shadow-[0_4px_12px_rgba(225,29,42,0.28)]" : "text-gray-600 hover:bg-[#F4F6F5]"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {/* #1 Kad semak poskod — mod Penghantaran, di ATAS senarai item */}
        {mode === "delivery" && (
          <div className={`mb-4 rounded-2xl border p-4 ${isKV ? "border-emerald-200 bg-emerald-50/50" : outsideKV ? "border-amber-200 bg-amber-50/50" : "border-[#E11D2A]/30 bg-[#FDECEC]/50"}`}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-[#E11D2A]" />
              <span className="text-[13px] font-bold text-gray-900">Semak kawasan penghantaran</span>
            </div>
            <div className="flex gap-2">
              <input
                value={pc}
                onChange={(e) => { setPc(e.target.value.replace(/\D/g, "").slice(0, 5)); setPcRes(null); }}
                inputMode="numeric"
                placeholder="Poskod (5 digit)"
                className="flex-1 rounded-xl bg-white border border-gray-200 px-3.5 py-2.5 text-[14px] font-medium text-gray-900 outline-none focus:border-[#E11D2A]"
              />
              <button
                onClick={checkPostcode}
                disabled={pcBusy || pc.length !== 5}
                className="px-5 rounded-xl bg-[#E11D2A] text-white text-[13px] font-bold disabled:opacity-40"
              >
                {pcBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Semak"}
              </button>
            </div>
            {pcRes?.error && <p className="text-[12px] text-red-500 font-semibold mt-2">{pcRes.error}</p>}
            {isKV && (
              <p className="text-[12px] text-emerald-700 font-semibold mt-2">
                ✓ {pcRes?.area}{pcRes?.city ? `, ${pcRes.city}` : ""} — Lembah Klang · kos RM{Number(pcRes?.fee ?? 0).toFixed(2)}
              </p>
            )}
            {outsideKV && (
              <p className="text-[12px] text-amber-700 font-semibold mt-2">
                Luar Lembah Klang — kurier sejuk 1–3 hari, kos ikut berat (disahkan team)
              </p>
            )}
          </div>
        )}

        {/* Item rows */}
        <div className="space-y-3">
          {items.map(({ product, variant, quantity }) => {
            const unitPrice = variant ? Number(variant.price) : Number(product.price);
            const availStock = variant ? variant.stock : liveStock[product.id];
            const isOutOfStock = availStock !== undefined && availStock === 0;
            const exceedsStock = availStock !== undefined && quantity > availStock;
            const itemKey = `${product.id}-${variant?.id ?? ""}`;
            const confirming = confirmKey === itemKey;

            return (
              <div
                key={itemKey}
                className={`bg-white rounded-2xl border p-3.5 flex gap-3 ${
                  isOutOfStock ? "border-red-200 bg-red-50/40" : exceedsStock ? "border-amber-200 bg-amber-50/40" : "border-gray-200"
                }`}
              >
                <div className="h-[72px] w-[72px] rounded-xl bg-[#F4F6F5] overflow-hidden grid place-items-center shrink-0">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl">🍓</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-[13.5px] font-bold text-gray-900 truncate">{product.name}</h3>
                      {/* #5 papar variant dengan jelas */}
                      {variant ? (
                        <span className="inline-block text-[10.5px] font-bold text-[#E11D2A] bg-[#FDECEC] rounded-full px-2 py-0.5 mt-1">{variant.name}</span>
                      ) : (
                        <p className="text-[11.5px] text-gray-400 mt-0.5">RM{unitPrice.toFixed(2)} / {product.unit}</p>
                      )}
                      <p className="text-[15px] font-extrabold text-[#E11D2A] mt-1">RM{(unitPrice * quantity).toFixed(2)}</p>
                    </div>

                    {/* #6 Padam — hit target besar + pengesahan inline */}
                    {confirming ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { removeItem(product.id, variant?.id ?? null); setConfirmKey(null); }}
                          className="h-9 px-2.5 grid place-items-center rounded-lg bg-[#E11D2A] text-white text-[11px] font-bold"
                          aria-label="Sahkan buang"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmKey(null)}
                          className="h-9 w-9 grid place-items-center rounded-lg bg-gray-100 text-gray-500"
                          aria-label="Batal"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmKey(itemKey)}
                        className="h-10 w-10 grid place-items-center rounded-xl text-gray-400 hover:text-[#E11D2A] hover:bg-[#FDECEC] active:scale-90 transition shrink-0"
                        aria-label="Buang item"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {confirming && <p className="text-[11px] text-gray-400 mt-1">Buang item ini dari troli?</p>}

                  {isOutOfStock && (
                    <p className="flex items-center gap-1 text-[11.5px] text-red-500 font-semibold mt-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> Stok habis — sila buang
                    </p>
                  )}
                  {exceedsStock && !isOutOfStock && (
                    <p className="flex items-center gap-1 text-[11.5px] text-amber-600 font-semibold mt-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> Stok tinggal {availStock}
                    </p>
                  )}

                  {/* #5 Stepper — kekalkan variant (composite key) */}
                  <div className="flex items-center gap-1.5 mt-2 bg-[#F4F6F5] rounded-full p-1 w-fit">
                    <button
                      onClick={() => updateQuantity(product.id, quantity - 1, variant?.id ?? null)}
                      className="h-7 w-7 grid place-items-center rounded-full bg-white text-[#E11D2A] active:scale-90 transition"
                      aria-label="Kurang"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-[14px] font-extrabold text-gray-900 w-5 text-center tabular-nums">{quantity}</span>
                    <button
                      onClick={() => { if (availStock !== undefined && quantity >= availStock) return; updateQuantity(product.id, quantity + 1, variant?.id ?? null); }}
                      disabled={availStock !== undefined && quantity >= availStock}
                      className="h-7 w-7 grid place-items-center rounded-full bg-[#E11D2A] text-white active:scale-90 transition disabled:opacity-30"
                      aria-label="Tambah"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* #4 Baris Syabab Points — sentiasa papar (kelabu bila 0/guest) */}
        <div className={`mt-3 rounded-2xl border border-gray-200 px-4 py-3 flex items-center gap-3 ${guest || (points ?? 0) === 0 ? "opacity-60" : ""}`}>
          <Star className="h-5 w-5 text-amber-500 fill-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-bold text-gray-900">Guna Syabab Points</p>
            <p className="text-[11px] text-gray-400">
              {guest
                ? "Log masuk untuk kumpul & tebus mata · 100 pts = RM1"
                : `Baki ${(points ?? 0).toLocaleString()} pts · 100 pts = RM1 · tebus semasa bayar`}
            </p>
          </div>
          {guest && <Link href="/login" className="text-[12px] font-bold text-[#E11D2A]">Log masuk</Link>}
        </div>

        {/* #2 Pecahan kos */}
        <div className="mt-3 rounded-2xl bg-white border border-gray-200 px-4 py-3.5 space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500">Subjumlah</span>
            <span className="font-bold text-gray-900">RM{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-gray-500">Penghantaran</span>
            <span className="font-bold text-gray-900">
              {mode === "pickup" ? "PERCUMA"
                : isKV ? `RM${deliveryFee.toFixed(2)}`
                : outsideKV ? "Ikut berat"
                : "—"}
            </span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <span className="text-[14px] font-extrabold text-gray-900">Jumlah</span>
            <span className="text-[17px] font-extrabold text-[#E11D2A]">
              RM{grandTotal.toFixed(2)}{outsideKV ? "+" : ""}
            </span>
          </div>
          {outsideKV && <p className="text-[10.5px] text-gray-400">+ kos kurier sejuk ikut berat (disahkan semasa checkout)</p>}
        </div>

        {/* Jaminan */}
        <div className="mt-3 rounded-2xl bg-white border border-gray-200 px-4 py-3 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-[#E11D2A] shrink-0" />
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-gray-900">Jaminan segar 100%</p>
            <p className="text-[11px] text-gray-400">Buah rosak masa sampai? Ganti atau refund penuh</p>
          </div>
        </div>
      </div>

      {/* Sticky bar — gate ikut #3 */}
      <div className="fixed bottom-16 lg:bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 px-4 pt-3 pb-3 lg:pb-4">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400 leading-none">{items.length} item</p>
            <p className="text-[22px] font-extrabold text-gray-900 leading-tight">RM{grandTotal.toFixed(2)}{outsideKV ? "+" : ""}</p>
          </div>
          {hasStockIssue ? (
            <div className="flex-1 text-center bg-gray-100 text-gray-400 font-bold py-3.5 rounded-xl text-[14px]">
              Betulkan kuantiti dahulu
            </div>
          ) : !gateOpen ? (
            <div className="flex-1 text-center bg-gray-100 text-gray-400 font-bold py-3.5 rounded-xl text-[13px] leading-tight">
              Semak poskod dahulu
            </div>
          ) : (
            <Link
              href="/checkout"
              className="flex-1 flex items-center justify-center gap-2 bg-[#E11D2A] text-white font-bold py-3.5 rounded-xl text-[15px] shadow-[0_6px_16px_rgba(225,29,42,0.32)] active:scale-[0.98] transition"
            >
              Ke Pembayaran <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

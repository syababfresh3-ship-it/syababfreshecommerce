"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Variant { id: string; name: string; price: number }
interface Product { id: string; name: string; price: number; image_url: string | null; product_variants: Variant[] }
interface Item { product_id: string; variant_id: string | null; product_name: string; variant_name: string | null; quantity: number; unit_price: number }

export function OrderClient() {
  const supabase = createClient();
  const params = useSearchParams();
  const contactId = params.get("contact") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [discount, setDiscount] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/landing-pages/products")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setProducts(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!contactId) return;
    supabase
      .from("wa_contacts")
      .select("name, phone, wa_id, profiles(full_name, email)")
      .eq("id", contactId)
      .single()
      .then(({ data }: { data: { name: string | null; phone: string | null; wa_id: string; profiles: unknown } | null }) => {
        if (!data) return;
        const prof = data.profiles as { full_name?: string; email?: string } | null;
        setName(data.name || prof?.full_name || "");
        setPhone(data.phone || data.wa_id || "");
        if (prof?.email) setEmail(prof.email);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const filtered = useMemo(
    () => (search ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) : products).slice(0, 20),
    [search, products],
  );

  function addItem(p: Product, v: Variant | null) {
    setItems((its) => [
      ...its,
      {
        product_id: p.id,
        variant_id: v?.id ?? null,
        product_name: p.name,
        variant_name: v?.name ?? null,
        quantity: 1,
        unit_price: v?.price ?? p.price,
      },
    ]);
  }
  function setQty(idx: number, q: number) {
    setItems((its) => its.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, q) } : it)));
  }
  function removeItem(idx: number) {
    setItems((its) => its.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const total = Math.max(0, subtotal + (Number(deliveryFee) || 0) - (Number(discount) || 0));

  async function submit() {
    setMsg("");
    if (items.length === 0) return setMsg("Tambah sekurang-kurangnya 1 produk.");
    if (!name || !phone || !address || !/^\d{5}$/.test(postcode)) return setMsg("Isi nama, telefon, alamat & poskod (5 digit).");
    setBusy(true);
    const res = await fetch("/api/whatsapp/order-paylink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, name, phone, email, address, postcode, delivery_fee: Number(deliveryFee) || 0, discount: Number(discount) || 0, items }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok && j.ok) {
      setMsg(`✅ Order ${j.order_number} dicipta (RM${Number(j.total).toFixed(2)})${j.sentWhatsApp ? " — pay link dihantar ke WhatsApp!" : " — tapi WA gagal hantar"}`);
      setItems([]);
    } else {
      setMsg("❌ " + (j.error || "Gagal."));
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-gray-800">Buat Order + Hantar Pay Link</h1>

      {/* Customer */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <div className="text-sm font-semibold text-gray-700">Maklumat customer</div>
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Poskod (5 digit)" className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat penuh" className="w-full border rounded-lg px-3 py-2 text-sm" />
      </div>

      {/* Produk */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <div className="text-sm font-semibold text-gray-700">Tambah produk</div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk…" className="w-full border rounded-lg px-3 py-2 text-sm" />
        <div className="max-h-52 overflow-y-auto divide-y">
          {filtered.map((p) => (
            <div key={p.id} className="py-2 flex items-center justify-between gap-2">
              <span className="text-sm text-gray-700">{p.name}</span>
              {p.product_variants?.length > 0 ? (
                <div className="flex gap-1 flex-wrap justify-end">
                  {p.product_variants.map((v) => (
                    <button key={v.id} onClick={() => addItem(p, v)} className="text-xs bg-gray-100 hover:bg-emerald-100 rounded px-2 py-1">
                      {v.name} +
                    </button>
                  ))}
                </div>
              ) : (
                <button onClick={() => addItem(p, null)} className="text-xs bg-gray-100 hover:bg-emerald-100 rounded px-2 py-1">
                  RM{p.price} +
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Item dipilih */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <div className="text-sm font-semibold text-gray-700">Pesanan</div>
        {items.length === 0 && <div className="text-sm text-gray-400">Belum ada item.</div>}
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2 text-sm border-b py-1.5">
            <span className="flex-1 truncate">
              {it.product_name}
              {it.variant_name ? ` (${it.variant_name})` : ""}
            </span>
            <input type="number" value={it.quantity} onChange={(e) => setQty(idx, Number(e.target.value))} className="w-14 border rounded px-2 py-1 text-sm" />
            <span className="w-20 text-right">RM{(it.unit_price * it.quantity).toFixed(2)}</span>
            <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-gray-600">Penghantaran (RM)</span>
          <input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="0" className="w-24 border rounded px-2 py-1 text-sm text-right" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Diskaun team sale (RM)</span>
          <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="w-24 border rounded px-2 py-1 text-sm text-right text-red-500" />
        </div>
        <div className="flex justify-between font-semibold text-gray-800 pt-1">
          <span>Jumlah</span>
          <span>RM{total.toFixed(2)}</span>
        </div>
      </div>

      <button onClick={submit} disabled={busy} className="w-full bg-emerald-500 text-white rounded-lg py-3 font-medium disabled:opacity-50">
        {busy ? "Memproses…" : "🛒 Cipta Order + Hantar Pay Link"}
      </button>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}
    </div>
  );
}

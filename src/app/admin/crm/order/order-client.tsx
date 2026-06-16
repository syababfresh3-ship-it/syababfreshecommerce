"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Variant { id: string; name: string; price: number }
interface Product { id: string; name: string; price: number; image_url: string | null; product_variants: Variant[] }
interface Item { product_id: string; variant_id: string | null; product_name: string; variant_name: string | null; quantity: number; unit_price: number }
interface Msg { id: string; direction: "in" | "out"; type: string; body: string | null; media_url: string | null; created_at: string }

const STAFF_NAMES = ["Muhd", "Man", "Pika", "Far"];

export function OrderClient() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const contactId = params.get("contact") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"paylink" | "cod">("paylink");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");
  const [staffName, setStaffName] = useState("");
  const [staffOther, setStaffOther] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [extracting, setExtracting] = useState(false);

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

  // Muat chat customer (read-only) untuk rujukan
  useEffect(() => {
    if (!contactId) return;
    supabase
      .from("wa_conversations")
      .select("id")
      .eq("contact_id", contactId)
      .maybeSingle()
      .then(({ data: conv }: { data: { id: string } | null }) => {
        if (!conv) return;
        supabase
          .from("wa_messages")
          .select("id, direction, type, body, media_url, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true })
          .limit(100)
          .then(({ data }: { data: unknown[] | null }) => setMsgs((data as unknown as Msg[]) ?? []));
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
    if (!name || !phone) return setMsg("Isi nama & telefon.");
    if (deliveryMethod === "delivery" && (!address || !/^\d{5}$/.test(postcode)))
      return setMsg("Isi alamat & poskod (5 digit) untuk delivery.");
    setBusy(true);
    const res = await fetch("/api/whatsapp/order-paylink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, name, phone, email, address, postcode, delivery_fee: Number(deliveryFee) || 0, discount: Number(discount) || 0, items, paymentMethod, deliveryMethod, staff_name: staffName }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok && j.ok) {
      setMsg(
        `✅ Order ${j.order_number} dicipta (RM${Number(j.total).toFixed(2)})${
          j.sentWhatsApp ? (j.cod ? " — pengesahan dihantar ke WhatsApp" : " — pay link dihantar ke WhatsApp!") : " — tapi WA gagal hantar"
        }`,
      );
      setItems([]);
    } else {
      setMsg("❌ " + (j.error || "Gagal."));
    }
  }

  async function autoFill() {
    if (!contactId) return;
    setExtracting(true);
    setMsg("");
    const res = await fetch("/api/whatsapp/extract-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, products }),
    });
    const j = await res.json();
    setExtracting(false);
    if (res.ok && j.ok) {
      if (j.name) setName(j.name);
      if (j.phone) setPhone(j.phone);
      if (j.email) setEmail(j.email);
      if (j.address) setAddress(j.address);
      if (j.postcode) setPostcode(j.postcode);
      if (Array.isArray(j.items) && j.items.length) setItems(j.items as Item[]);
      setMsg(`✨ Auto-isi siap (${j.items?.length || 0} item) — sila semak & betulkan jika perlu.`);
    } else {
      setMsg("❌ " + (j.error || "Gagal auto-isi."));
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto flex flex-col lg:flex-row gap-4">
      <div className="flex-1 min-w-0 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-800">← Kembali</button>
        <a href="/admin/crm/inbox" className="text-sm text-blue-600 hover:underline">Inbox</a>
      </div>
      <h1 className="text-xl font-semibold text-gray-800">Buat Order + Hantar Pay Link</h1>

      {contactId && (
        <button
          onClick={autoFill}
          disabled={extracting}
          className="w-full bg-violet-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {extracting ? "🤖 AI tengah baca chat…" : "✨ Auto-isi dari chat (AI)"}
        </button>
      )}

      {/* Customer */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-gray-700">Maklumat customer</div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-400">Team sale:</label>
            <select
              value={staffOther ? "__other__" : staffName}
              onChange={(e) => {
                if (e.target.value === "__other__") {
                  setStaffOther(true);
                  setStaffName("");
                } else {
                  setStaffOther(false);
                  setStaffName(e.target.value);
                }
              }}
              className="border rounded-lg px-2 py-1 text-xs"
            >
              <option value="">— pilih —</option>
              {STAFF_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="__other__">Lain-lain…</option>
            </select>
            {staffOther && (
              <input
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Nama"
                className="border rounded-lg px-2 py-1 text-xs w-20"
              />
            )}
          </div>
        </div>
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

      {/* Kaedah bayaran & penghantaran */}
      <div className="bg-white rounded-lg border p-4 space-y-2">
        <div className="text-sm font-semibold text-gray-700">Kaedah</div>
        <div className="flex flex-wrap gap-3 text-sm items-center">
          <span className="text-gray-500 w-24">Bayaran:</span>
          <label className="flex items-center gap-1">
            <input type="radio" checked={paymentMethod === "paylink"} onChange={() => setPaymentMethod("paylink")} /> Pay link (online)
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} /> COD (bayar masa terima)
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-sm items-center">
          <span className="text-gray-500 w-24">Penghantaran:</span>
          <label className="flex items-center gap-1">
            <input type="radio" checked={deliveryMethod === "delivery"} onChange={() => setDeliveryMethod("delivery")} /> Hantar
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={deliveryMethod === "pickup"} onChange={() => setDeliveryMethod("pickup")} /> Pickup (ambil sendiri)
          </label>
        </div>
      </div>

      <button onClick={submit} disabled={busy} className="w-full bg-emerald-500 text-white rounded-lg py-3 font-medium disabled:opacity-50">
        {busy ? "Memproses…" : paymentMethod === "cod" ? "🛒 Cipta Order (COD)" : "🛒 Cipta Order + Hantar Pay Link"}
      </button>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}
      </div>

      {/* Chat customer (read-only) — rujukan masa buat order */}
      <aside className="lg:w-80 shrink-0 bg-white border rounded-lg flex flex-col lg:sticky lg:top-4 max-h-[75vh]">
        <div className="px-3 py-2 border-b text-sm font-semibold text-gray-700">💬 Chat customer</div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {msgs.length === 0 && <div className="text-xs text-gray-400">Tiada chat untuk customer ni.</div>}
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap ${
                  m.direction === "out" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-800"
                }`}
              >
                {m.media_url && m.type === "image" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.media_url} alt="" className="rounded mb-1 max-w-full" />
                )}
                {m.body || (m.type !== "text" ? `[${m.type}]` : "")}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

"use client";

// Admin Waitlist — kumpul entri ikut produk; bila restock: salin nombor
// → tampal ke Blast (Rasmi) "Paste numbers" → hantar → tanda "Dah maklum".
import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Copy, Loader2 } from "lucide-react";

interface Entry {
  id: string;
  product_id: string;
  phone: string;
  name: string | null;
  notified_at: string | null;
  created_at: string;
  products?: { name: string; slug: string; image_url: string | null } | null;
}

interface Group {
  productId: string;
  productName: string;
  image: string | null;
  pending: Entry[];
  notified: number;
}

export function WaitlistClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/waitlist");
    const j = await res.json();
    setEntries(j.entries ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups: Group[] = [];
  for (const e of entries) {
    let g = groups.find((x) => x.productId === e.product_id);
    if (!g) {
      g = { productId: e.product_id, productName: e.products?.name ?? "(produk dipadam)", image: e.products?.image_url ?? null, pending: [], notified: 0 };
      groups.push(g);
    }
    if (e.notified_at) g.notified++;
    else g.pending.push(e);
  }
  groups.sort((a, b) => b.pending.length - a.pending.length);

  async function copyNumbers(g: Group) {
    const nums = g.pending.map((e) => e.phone).join("\n");
    await navigator.clipboard.writeText(nums);
    window.alert(`${g.pending.length} nombor disalin.\n\nPergi Blast (Rasmi) → New Campaign → Paste numbers → tampal → hantar template restock.`);
  }

  async function markNotified(g: Group) {
    if (!window.confirm(`Tanda ${g.pending.length} entri "${g.productName}" sebagai dah dimaklum?\n\n(Buat SELEPAS blast dihantar.)`)) return;
    setMarking(g.productId);
    const res = await fetch("/api/admin/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: g.productId }),
    });
    setMarking(null);
    if (res.ok) load();
    else window.alert("Gagal tanda.");
  }

  const totalPending = groups.reduce((s, g) => s + g.pending.length, 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bell size={20} /> Waitlist Produk
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Customer yang minta dimaklum bila stok masuk — senarai pembeli paling panas untuk blast restock
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400">Menunggu stok</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{totalPending}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400">Produk terlibat</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{groups.filter((g) => g.pending.length > 0).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuatkan…</div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Belum ada pendaftaran waitlist. Butang &ldquo;Bagitahu bila ada&rdquo; muncul automatik pada produk habis stok.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {groups.map((g) => (
              <div key={g.productId} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {g.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.image} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{g.productName}</p>
                    <p className="text-[11px] text-gray-400">
                      <b className="text-gray-700">{g.pending.length}</b> menunggu
                      {g.notified > 0 && <span> · {g.notified} dah dimaklum</span>}
                    </p>
                  </div>
                  {g.pending.length > 0 && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => copyNumbers(g)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                      >
                        <Copy size={13} /> Salin nombor
                      </button>
                      <button
                        onClick={() => markNotified(g)}
                        disabled={marking === g.productId}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-gray-800 rounded-lg px-3 py-1.5 hover:bg-gray-900 disabled:opacity-50"
                      >
                        {marking === g.productId ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Dah maklum
                      </button>
                    </div>
                  )}
                </div>
                {g.pending.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-13">
                    {g.pending.slice(0, 12).map((e) => (
                      <span key={e.id} className="text-[10.5px] bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 text-gray-500">
                        {e.name ? `${e.name} · ` : ""}{e.phone}
                      </span>
                    ))}
                    {g.pending.length > 12 && (
                      <span className="text-[10.5px] text-gray-400">+{g.pending.length - 12} lagi</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

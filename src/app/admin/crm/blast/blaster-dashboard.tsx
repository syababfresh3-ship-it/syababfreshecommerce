"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Clock, Eraser, Eye, Plus, Trash2 } from "lucide-react";

interface Progress {
  total: number; pending: number; sent: number; delivered: number; read: number; failed: number;
}
interface Roas {
  sent: number; orders_attributed: number; revenue: number; cost: number; roas: number | null; conversion_rate: number;
}
interface Blast {
  id: string;
  name: string;
  template_name: string;
  status: string;
  total: number;
  scheduled_at: string | null;
  created_at: string;
  progress: Progress;
  roas?: Roas | null;
  replies?: number;
}
interface Stats {
  campaigns_sent: number;
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  total_recipients: number;
}

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-50 text-blue-600",
  sending: "bg-amber-50 text-amber-600",
  sent: "bg-emerald-50 text-emerald-600",
  failed: "bg-red-50 text-red-600",
};

function pct(n: number, d: number) {
  if (!d) return "0%";
  return ((n / d) * 100).toFixed(1) + "%";
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ms-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function BlasterDashboard() {
  const router = useRouter();
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/whatsapp/blast");
    const j = await res.json();
    setBlasts(j.blasts ?? []);
    setStats(j.stats ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string, name: string) {
    if (!window.confirm(`Padam campaign "${name}"? Rekod penerima juga dibuang.`)) return;
    const res = await fetch(`/api/whatsapp/blast/${id}`, { method: "DELETE" });
    if (res.ok) setBlasts((b) => b.filter((x) => x.id !== id));
    else window.alert("Gagal padam.");
  }

  const [cleaning, setCleaning] = useState(false);
  async function cleanupDead() {
    setCleaning(true);
    try {
      // Pratonton dulu (dry-run) — berapa nombor undeliverable.
      const prev = await fetch("/api/whatsapp/contacts/cleanup-undeliverable").then((r) => r.json());
      const n = prev.count ?? 0;
      if (!n) { window.alert("Tiada nombor undeliverable (#131026) untuk dibersihkan. 👍"); return; }
      if (!window.confirm(`Jumpa ${n} nombor "mati" (gagal terima / bukan WhatsApp aktif).\n\nMasukkan ke senarai suppress supaya tak di-blast lagi? (contact kekal, boleh undo di Unsubscribe)`)) return;
      const res = await fetch("/api/whatsapp/contacts/cleanup-undeliverable", { method: "POST" }).then((r) => r.json());
      window.alert(`✅ ${res.suppressed ?? 0} nombor disuppress. Blast akan datang auto-langkau mereka.`);
    } catch {
      window.alert("Gagal bersih nombor.");
    } finally {
      setCleaning(false);
    }
  }

  const totalRevenue = blasts.reduce((s, b) => s + Number(b.roas?.revenue ?? 0), 0);
  const totalOrders = blasts.reduce((s, b) => s + Number(b.roas?.orders_attributed ?? 0), 0);
  const totalCost = blasts.reduce((s, b) => s + Number(b.roas?.cost ?? 0), 0);
  const overallRoas = totalCost > 0 ? totalRevenue / totalCost : null;

  const cards = [
    { label: "Campaigns sent", value: stats ? String(stats.campaigns_sent) : "—" },
    { label: "Messages delivered", value: stats ? stats.messages_delivered.toLocaleString() : "—" },
    { label: "Read rate", value: stats ? pct(stats.messages_read, stats.messages_delivered) : "—" },
    { label: "Order dari blast", value: totalOrders > 0 ? String(totalOrders) : "—", hint: totalOrders > 0 ? `${pct(totalOrders, stats?.messages_delivered ?? 0)} conversion` : undefined },
    { label: "Revenue dari blast", value: totalRevenue > 0 ? `RM${totalRevenue.toLocaleString("ms-MY", { maximumFractionDigits: 0 })}` : "—", hint: totalOrders > 0 ? `${totalOrders} order` : undefined },
    { label: "ROAS keseluruhan", value: overallRoas != null ? `${overallRoas.toFixed(2)}×` : "—", hint: totalCost > 0 ? `kos WA ~RM${totalCost.toLocaleString("ms-MY", { maximumFractionDigits: 0 })}` : undefined },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Blaster</h1>
          <p className="text-sm text-gray-400 mt-0.5">Hantar mesej template WhatsApp ke kontak anda</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cleanupDead}
            disabled={cleaning}
            className="inline-flex items-center gap-1.5 text-gray-600 border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
            title="Suppress nombor yang gagal terima (#131026 — bukan WhatsApp aktif)"
          >
            <Eraser size={14} />
            {cleaning ? "Membersih…" : "Bersih nombor mati"}
          </button>
          <Link
            href="/admin/crm/blast/suppression"
            className="inline-flex items-center gap-1.5 text-gray-600 border border-gray-200 bg-white rounded-xl px-3.5 py-2.5 text-sm font-semibold hover:bg-gray-50"
          >
            <Ban size={14} />
            Unsubscribe
          </Link>
          <Link
            href="/admin/crm/blast/new"
            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400">{c.label}</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{c.value}</p>
            {"hint" in c && c.hint ? <p className="text-[11px] text-gray-400 mt-0.5">{c.hint}</p> : null}
          </div>
        ))}
      </div>

      {/* Campaign list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold text-gray-700">
          {blasts.length} campaign
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuatkan…</div>
        ) : blasts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Belum ada campaign. Klik “+ New Campaign”.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {blasts.map((b) => {
              const p = b.progress;
              return (
                <div key={b.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-gray-50/60">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{b.name}</p>
                    <p className="text-[11px] text-gray-400">{b.template_name}</p>
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${statusBadge[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {b.status}
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] shrink-0 sm:w-96">
                    <span className="text-gray-400">Pending <b className="text-gray-600">{p.pending}</b></span>
                    <span className="text-red-400">Unreached <b className="text-red-500">{p.failed}</b></span>
                    <span className="text-sky-400">Sent <b className="text-sky-500">{p.sent}</b></span>
                    <span className="text-emerald-400">Delivered <b className="text-emerald-600">{p.delivered}</b></span>
                    <span className="text-violet-400">Read <b className="text-violet-500">{p.read}</b></span>
                    <span className="text-gray-400">Reply <b className="text-gray-700">{b.replies ?? 0}</b></span>
                  </div>
                  <div className="text-[11px] shrink-0 sm:w-28">
                    {b.roas && Number(b.roas.revenue) > 0 ? (
                      <>
                        <span className="text-emerald-600 font-bold">RM{Number(b.roas.revenue).toLocaleString("ms-MY", { maximumFractionDigits: 0 })}</span>
                        <span className="text-gray-400"> · {b.roas.orders_attributed} order</span>
                        {b.roas.roas != null && <div className="text-gray-400">ROAS <b className="text-gray-600">{b.roas.roas}×</b></div>}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px] text-gray-400 shrink-0 sm:w-28">
                    {b.scheduled_at ? (
                      <>
                        <Clock size={11} />
                        {fmtDate(b.scheduled_at)}
                      </>
                    ) : (
                      fmtDate(b.created_at)
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => router.push(`/admin/crm/blast/${b.id}`)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100" title="Lihat">
                      <Eye size={15} />
                    </button>
                    <button onClick={() => remove(b.id, b.name)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50" title="Padam">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

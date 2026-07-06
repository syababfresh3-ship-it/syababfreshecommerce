"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Row { id: string; wa_id: string; source: string; note: string | null; created_at: string }
interface Counts { total: number; replied_stop: number; wa_opt_out: number; manual: number }

const sourceBadge: Record<string, { label: string; cls: string }> = {
  replied_stop: { label: "Replied STOP", cls: "bg-red-50 text-red-600" },
  wa_opt_out: { label: "WhatsApp opt-out", cls: "bg-amber-50 text-amber-600" },
  manual: { label: "Added manually", cls: "bg-gray-100 text-gray-600" },
};

export function SuppressionClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (source) p.set("source", source);
    const res = await fetch(`/api/whatsapp/blast/suppression?${p}`);
    const j = await res.json();
    setRows(j.rows ?? []);
    setCounts(j.counts ?? null);
    setLoading(false);
  }, [q, source]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    const numbers = addText.split(/[\n,;\s]+/).map((s) => s.trim()).filter(Boolean);
    if (numbers.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/whatsapp/blast/suppression", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numbers }),
    });
    setBusy(false);
    if (res.ok) { setAddText(""); setAdding(false); load(); }
    else window.alert("Gagal tambah.");
  }

  async function remove(waId: string) {
    if (!window.confirm(`Buang ${waId} dari suppression? Nombor ini boleh terima blast semula.`)) return;
    const res = await fetch(`/api/whatsapp/blast/suppression?wa_id=${encodeURIComponent(waId)}`, { method: "DELETE" });
    if (res.ok) setRows((r) => r.filter((x) => x.wa_id !== waId));
  }

  const filters = [
    { v: "", label: `Semua (${counts?.total ?? 0})` },
    { v: "replied_stop", label: `Replied STOP (${counts?.replied_stop ?? 0})` },
    { v: "wa_opt_out", label: `WA opt-out (${counts?.wa_opt_out ?? 0})` },
    { v: "manual", label: `Manual (${counts?.manual ?? 0})` },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/crm/blast" className="text-sm text-gray-400 hover:text-gray-700">← Blaster</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Unsubscribe list</h1>
          <p className="text-sm text-gray-400">Nombor di sini disekat dari semua kempen Blaster</p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="bg-gray-900 text-white rounded-xl px-4 py-2.5 text-sm font-bold">+ Add numbers</button>
      </div>

      {adding && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <textarea value={addText} onChange={(e) => setAddText(e.target.value)} rows={3}
            placeholder="60123456789, 60198765432 … (satu baris atau dipisah koma)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-300" />
          <div className="flex gap-2">
            <button onClick={add} disabled={busy} className="bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">{busy ? "…" : "Tambah"}</button>
            <button onClick={() => setAdding(false)} className="text-sm text-gray-500 px-3">Batal</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 cari nombor…" className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 min-w-40" />
        <div className="flex gap-1">
          {filters.map((f) => (
            <button key={f.v} onClick={() => setSource(f.v)}
              className={`text-xs font-semibold px-3 py-2 rounded-xl ${source === f.v ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-500"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuatkan…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Tiada nombor disekat.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((r) => {
              const b = sourceBadge[r.source] ?? sourceBadge.manual;
              return (
                <div key={r.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-mono text-gray-800 flex-1">{r.wa_id}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                  <button onClick={() => remove(r.wa_id)} className="text-gray-300 hover:text-red-500 text-xs" title="Buang">✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

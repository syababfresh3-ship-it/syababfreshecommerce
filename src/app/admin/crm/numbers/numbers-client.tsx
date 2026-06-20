"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface WaNumber {
  phone_number_id: string; display_name: string; owner: string | null;
  is_active: boolean; is_default: boolean;
}
interface Admin { id: string; full_name: string | null }

export function NumbersClient() {
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ phone_number_id: "", display_name: "", owner: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch("/api/whatsapp/numbers").then((r) => r.json());
    setNumbers(j.numbers ?? []);
    setAdmins(j.admins ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const ownerName = (id: string | null) => admins.find((a) => a.id === id)?.full_name || (id ? "—" : "Belum set");

  async function add() {
    if (!form.phone_number_id.trim() || !form.display_name.trim()) { window.alert("Isi Phone Number ID & nama."); return; }
    setBusy(true);
    const res = await fetch("/api/whatsapp/numbers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, owner: form.owner || null }),
    });
    setBusy(false);
    if (res.ok) { setForm({ phone_number_id: "", display_name: "", owner: "" }); setAdding(false); load(); }
    else window.alert("Gagal tambah: " + ((await res.json()).error ?? ""));
  }

  async function patch(phone_number_id: string, body: Record<string, unknown>) {
    await fetch("/api/whatsapp/numbers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number_id, ...body }),
    });
    load();
  }
  async function remove(n: WaNumber) {
    if (n.is_default) { window.alert("Tak boleh padam nombor lalai."); return; }
    if (!window.confirm(`Padam nombor "${n.display_name}"?`)) return;
    await fetch(`/api/whatsapp/numbers?phone_number_id=${encodeURIComponent(n.phone_number_id)}`, { method: "DELETE" });
    load();
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/crm/inbox" className="text-sm text-gray-400 hover:text-gray-700">← Inbox</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Nombor WhatsApp</h1>
          <p className="text-sm text-gray-400">Setiap nombor boleh diuruskan salesperson berbeza</p>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="bg-gray-900 text-white rounded-xl px-4 py-2.5 text-sm font-bold">+ Tambah nombor</button>
      </div>

      {adding && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-[11px] text-amber-700">
            Daftar nombor di Meta dulu (WhatsApp Manager → Add phone number → verify). Salin <b>Phone Number ID</b> nombor itu, masukkan di sini.
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">PHONE NUMBER ID (dari Meta)</label>
            <input value={form.phone_number_id} onChange={(e) => setForm((f) => ({ ...f, phone_number_id: e.target.value.replace(/\D/g, "") }))} placeholder="cth 1107044612487426" className={`${inputCls} font-mono`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">NAMA PAPARAN</label>
            <input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="cth Sales Pika" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">PEMILIK (SALESPERSON)</label>
            <select value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} className={inputCls}>
              <option value="">— Belum set —</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.id}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">Conversation dari nombor ni auto-assign ke pemilik.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={busy} className="bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">{busy ? "…" : "Tambah"}</button>
            <button onClick={() => setAdding(false)} className="text-sm text-gray-500 px-3">Batal</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuatkan…</div>
        ) : numbers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Tiada nombor.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {numbers.map((n) => (
              <div key={n.phone_number_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    {n.display_name}
                    {n.is_default && <span className="ml-2 text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Lalai</span>}
                    {!n.is_active && <span className="ml-2 text-[10px] font-bold bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">Nyahaktif</span>}
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono">{n.phone_number_id}</p>
                </div>
                <div className="shrink-0">
                  <select value={n.owner ?? ""} onChange={(e) => patch(n.phone_number_id, { owner: e.target.value || null })}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    <option value="">— Pemilik: belum set —</option>
                    {admins.map((a) => <option key={a.id} value={a.id}>{a.full_name || a.id}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 shrink-0 text-xs">
                  <button onClick={() => patch(n.phone_number_id, { is_active: !n.is_active })} className="text-gray-500 hover:text-gray-900">{n.is_active ? "Nyahaktif" : "Aktifkan"}</button>
                  {!n.is_default && <button onClick={() => remove(n)} className="text-gray-300 hover:text-red-500">Padam</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        Nota: nombor lalai = guna semasa conversation tiada nombor tertentu. Pastikan nombor dalam WABA yang sama (token dikongsi).
      </p>
    </div>
  );
}

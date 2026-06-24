"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

type Row = { phone: string; name?: string };

// Parse CSV/paste ringkas: kesan lajur phone + nama (header atau lajur 0/1).
function parse(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const delim = lines[0].includes("\t") ? "\t" : ",";
  let phoneIdx = 0, nameIdx = 1, start = 0;
  const head = lines[0].toLowerCase().split(delim).map((s) => s.trim());
  const hp = head.findIndex((h) => /phone|nombor|^no$|hp|tel/.test(h));
  const hn = head.findIndex((h) => /name|nama/.test(h));
  if (hp !== -1 || hn !== -1) {
    phoneIdx = hp !== -1 ? hp : 0;
    nameIdx = hn !== -1 ? hn : phoneIdx === 0 ? 1 : 0;
    start = 1;
  }
  const out: Row[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = lines[i].split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
    const phone = cells[phoneIdx] ?? "";
    if (!/\d/.test(phone)) continue;
    out.push({ phone, name: cells[nameIdx] || undefined });
  }
  return out;
}

export function ImportContacts() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setRows(parse(String(reader.result || "")));
    reader.readAsText(f);
  }

  async function submit() {
    if (rows.length === 0) { toast.error("Tiada nombor dikesan."); return; }
    setBusy(true);
    const res = await fetch("/api/whatsapp/contacts/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, tag: tag.trim() }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(j.error ?? "Gagal import"); return; }
    toast.success(`${j.imported} kontak diimport${j.tag ? ` · tag: ${j.tag}` : ""}`);
    setOpen(false); setRows([]); setTag("");
    setTimeout(() => location.reload(), 900);
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 px-3 py-2 rounded-lg hover:bg-emerald-700">
        <Upload className="h-4 w-4" /> Import CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Import Kontak</h2>
              <button onClick={() => !busy && setOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">FAIL CSV (lajur: Phone, Name)</label>
              <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile}
                className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-900 file:text-white file:text-xs file:font-semibold" />
              <p className="text-[11px] text-gray-400 mt-1">Atau tampal terus di bawah (satu baris satu nombor + nama).</p>
              <textarea onChange={(e) => setRows(parse(e.target.value))} rows={4} placeholder={"60123456789, Ali\n60198765432, Siti"}
                className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">TAG SUMBER (cth tiktok-kv-ogos)</label>
              <input value={tag} onChange={(e) => setTag(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))}
                placeholder="tiktok-kv" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
              <p className="text-[11px] text-gray-400 mt-1">Semua kontak ni ditag dengan ini → senang segment & blast.</p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-gray-500">{rows.length > 0 ? <><b className="text-emerald-600">{rows.length}</b> nombor dikesan</> : "Tiada nombor lagi"}</span>
              <button onClick={submit} disabled={busy || rows.length === 0}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 px-4 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengimport…</> : <>Import {rows.length > 0 ? `(${rows.length})` : ""}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

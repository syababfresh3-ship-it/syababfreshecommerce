"use client";

// "Mungkin minta STOP" — mesej customer yang sebut stop/berhenti tapi nombornya
// belum disekat. Admin pilih: Tambah ke STOP, atau "Bukan STOP" (sembunyi di
// pelayar ini sahaja).

import { useEffect, useState } from "react";

interface Row { message_id: string; wa_id: string; name: string | null; body: string; created_at: string }

const DISMISS_KEY = "crm-possible-optout-dismissed";

function readDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[]); }
  catch { return new Set(); }
}

export function PossibleOptOut({ onAdded }: { onAdded: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/whatsapp/blast/suppression/review")
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => { if (alive && j) setRows(j.rows ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function add(r: Row) {
    setBusy(r.message_id);
    const res = await fetch("/api/whatsapp/blast/suppression", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numbers: [r.wa_id], note: `Semak admin: "${r.body.slice(0, 60)}"` }),
    });
    setBusy(null);
    if (res.ok) { setRows((x) => x.filter((y) => y.message_id !== r.message_id)); onAdded(); }
    else window.alert("Gagal tambah.");
  }

  function dismiss(r: Row) {
    const next = new Set(dismissed).add(r.message_id);
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])); } catch { /* storage disekat — sembunyi untuk sesi ini sahaja */ }
  }

  const visible = rows.filter((r) => !dismissed.has(r.message_id));
  if (visible.length === 0) return null;

  return (
    <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-amber-800">⚠️ Mungkin minta STOP ({visible.length})</h2>
        <p className="text-xs text-amber-700">Customer sebut stop/berhenti tapi nombor belum disekat. Baca mesej, kemudian pilih.</p>
      </div>
      <div className="divide-y divide-amber-100">
        {visible.map((r) => (
          <div key={r.message_id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <span className="font-mono text-gray-800">{r.wa_id}</span>
            {r.name && <span className="text-gray-500 text-xs">{r.name}</span>}
            <span className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString("ms-MY")}</span>
            <span className="w-full text-gray-700 italic">&ldquo;{r.body}&rdquo;</span>
            <button onClick={() => add(r)} disabled={busy === r.message_id}
              className="bg-red-500 text-white rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50">
              {busy === r.message_id ? "…" : "Tambah ke STOP"}
            </button>
            <button onClick={() => dismiss(r)} className="text-xs text-gray-500 px-2">Bukan STOP</button>
          </div>
        ))}
      </div>
    </div>
  );
}

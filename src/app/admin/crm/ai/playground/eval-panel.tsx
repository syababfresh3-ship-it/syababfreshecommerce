"use client";

// Tab "Ujian" Playground — jalankan set soalan sebenar (lib/ai/eval-cases.ts) melalui chatbot (tool dry-run),
// tunjuk lulus/gagal semakan automatik + skor penilai AI (pilihan). 6 kes setiap panggilan, berurutan.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Play, RotateCcw, ChevronDown, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { EVAL_CASES, EVAL_GROUP_LABEL, type EvalCase, type EvalCheck } from "@/lib/ai/eval-cases";
import { AI_MODELS, USD_TO_MYR } from "@/lib/ai/models";

interface Result { id: string; ok: boolean; pass: boolean; checks: EvalCheck[]; judge: { score: number; reason: string } | null; reply: string; tools: { name: string; input: Record<string, unknown> }[]; model: string | null; costUsd: number; ms: number; error?: string }

const btnPrimary = "inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50";

export function EvalPanel({ model }: { model: string }) {
  const [results, setResults] = useState<Record<string, Result>>({});
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);
  const [judge, setJudge] = useState(true);
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const cases = useMemo(() => EVAL_CASES.filter((c) => !group || c.group === group), [group]);
  const stats = useMemo(() => {
    const done = cases.filter((c) => results[c.id]);
    const pass = done.filter((c) => results[c.id].pass).length;
    const cost = done.reduce((s, c) => s + (results[c.id].costUsd || 0), 0);
    const judged = done.filter((c) => results[c.id].judge);
    const avgJudge = judged.length ? judged.reduce((s, c) => s + (results[c.id].judge?.score ?? 0), 0) / judged.length : null;
    const avgChars = done.length ? Math.round(done.reduce((s, c) => s + (results[c.id].reply?.length ?? 0), 0) / done.length) : 0;
    return { done: done.length, pass, cost, avgJudge, avgChars };
  }, [cases, results]);

  async function run(ids: string[]) {
    if (!ids.length) return;
    setRunning({ done: 0, total: ids.length });
    let done = 0;
    for (let i = 0; i < ids.length; i += 6) {
      const chunk = ids.slice(i, i + 6);
      try {
        const res = await fetch("/api/admin/ai/eval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: chunk, model: model || undefined, judge }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(j.error ?? "Gagal jalankan ujian"); break; }
        setResults((prev) => { const n = { ...prev }; for (const r of j.results as Result[]) n[r.id] = r; return n; });
        done += chunk.length;
      } catch { toast.error("Ralat rangkaian"); break; }
      setRunning({ done, total: ids.length });
    }
    setRunning(null);
  }
  const failedIds = cases.filter((c) => results[c.id] && !results[c.id].pass).map((c) => c.id);

  const status = (c: EvalCase) => {
    const r = results[c.id];
    if (!r) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-gray-200 text-gray-400 inline-flex items-center gap-1"><MinusCircle className="h-3 w-3" />Belum</span>;
    if (r.pass) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-900 text-white inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Lulus</span>;
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1"><XCircle className="h-3 w-3" />Gagal</span>;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {cases.length} soalan sebenar dari inbox + senario gift. {stats.done > 0 && <>Lulus <b>{stats.pass}/{stats.done}</b>{stats.avgJudge !== null && <> · penilai AI purata <b>{stats.avgJudge.toFixed(1)}/2</b></>} · purata <b>{stats.avgChars}</b> aksara · kos RM{(stats.cost * USD_TO_MYR).toFixed(3)}</>}
          {model && <span className="text-gray-400"> · model {AI_MODELS[model]?.label ?? model}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white" aria-label="Kumpulan"><option value="">Semua kumpulan</option>{Object.entries(EVAL_GROUP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label className="inline-flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} className="accent-gray-900" />Penilai AI</label>
          <button type="button" onClick={() => run(failedIds)} disabled={!!running || !failedIds.length} className={btnGhost}><RotateCcw className="h-4 w-4" />Ulang yang gagal ({failedIds.length})</button>
          <button type="button" onClick={() => run(cases.map((c) => c.id))} disabled={!!running} className={btnPrimary}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{running ? `Menjalankan ${running.done}/${running.total}…` : "Jalankan semua"}</button>
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Semakan automatik: tool dipanggil, frasa wajib, frasa dilarang. Penilai AI (Haiku 5.5) beri skor 0–2 berdasarkan fakta rujukan. Kes bertanda <i>live</i> bergantung pada stok/harga semasa. Tiada WhatsApp dihantar, tiada rekod ditulis.</p>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {cases.map((c) => {
          const r = results[c.id];
          const isOpen = open === c.id;
          return (
            <div key={c.id}>
              <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50">
                <span className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">{EVAL_GROUP_LABEL[c.group]}</span>
                <span className="flex-1 text-sm text-gray-900 truncate">{c.q}{c.live && <span className="ml-1 text-[10px] text-gray-400">live</span>}</span>
                {r?.judge && <span className="text-[11px] font-mono text-gray-500 shrink-0">{r.judge.score}/2</span>}
                <span className="shrink-0">{status(c)}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pt-1 bg-gray-50 text-sm space-y-2">
                  {c.note && <p className="text-xs text-gray-500">{c.note}</p>}
                  {c.reference && <p className="text-xs text-gray-500"><b>Rujukan:</b> {c.reference}</p>}
                  {!r ? <p className="text-xs text-gray-400">Belum dijalankan.</p> : r.error ? <p className="text-xs text-red-600">Ralat: {r.error}</p> : (
                    <>
                      <div className="rounded-lg border border-gray-200 bg-white p-2.5 whitespace-pre-wrap text-gray-800">{r.reply || <span className="text-gray-400">(tiada balasan)</span>}</div>
                      <p className="text-[11px] text-gray-500">tool: {r.tools.length ? r.tools.map((t) => `${t.name}(${JSON.stringify(t.input)})`).join(" · ") : "tiada"} · {AI_MODELS[r.model ?? ""]?.label ?? r.model} · {r.reply.length} aksara · {(r.ms / 1000).toFixed(1)}s · RM{(r.costUsd * USD_TO_MYR).toFixed(4)}</p>
                      <ul className="text-xs space-y-0.5">{r.checks.map((ch, i) => <li key={i} className={`inline-flex items-center gap-1 mr-3 ${ch.ok ? "text-gray-600" : "text-red-700 font-semibold"}`}>{ch.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{ch.text}</li>)}</ul>
                      {r.judge && <p className="text-xs text-gray-700"><b>Penilai AI {r.judge.score}/2:</b> {r.judge.reason}</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

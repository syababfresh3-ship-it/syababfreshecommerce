"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { FlaskConical, ArrowLeft, Send, Loader2, Wrench, RotateCcw } from "lucide-react";
import { AI_MODELS, USD_TO_MYR } from "@/lib/ai/models";

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result: string;
}
interface Turn {
  role: "user" | "assistant";
  content: string;
  tools?: ToolCall[];
  model?: string;
  costUsd?: number;
}

export function PlaygroundClient() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(""); // "" = guna model tersimpan
  const [err, setErr] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo(0, threadRef.current.scrollHeight);
  }, [turns, busy]);

  async function send() {
    const msg = input.trim();
    if (!msg || busy) return;
    setErr("");
    setInput("");
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((p) => [...p, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ai/playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history, model: model || undefined }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || "AI gagal.");
        setBusy(false);
        return;
      }
      setTurns((p) => [
        ...p,
        { role: "assistant", content: j.reply || "(tiada balasan)", tools: j.tools, model: j.model, costUsd: j.costUsd },
      ]);
    } catch {
      setErr("Ralat rangkaian.");
    }
    setBusy(false);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-gray-700" />
          <h1 className="text-xl font-semibold text-gray-800">AI Playground</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm text-gray-700"
            title="Model untuk ujian (lalai = ikut tetapan)"
          >
            <option value="">Model tersimpan</option>
            {Object.values(AI_MODELS).map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <button onClick={() => { setTurns([]); setErr(""); }} className="text-gray-400 p-1.5" title="Reset perbualan">
            <RotateCcw className="h-4 w-4" />
          </button>
          <Link href="/admin/crm/ai" className="text-sm text-gray-500 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Config
          </Link>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Test AI guna persona &amp; pengetahuan yang disimpan. Tiada WhatsApp dihantar; tool dijalankan mod ujian
        (search_products LIVE, order/flag tanpa kesan). Sesuai untuk tala persona &quot;Kak Syabab&quot;.
      </p>

      <div ref={threadRef} className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border p-3 space-y-3">
        {turns.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-8">
            Taip mesej macam customer, cth &quot;nak order cherry, hantar ke Shah Alam&quot;.
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] ${t.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  t.role === "user" ? "bg-emerald-600 text-white" : "bg-white border text-gray-800"
                }`}
              >
                {t.content}
              </div>
              {t.role === "assistant" && (t.tools?.length || t.model) && (
                <div className="text-[11px] text-gray-400 space-y-0.5">
                  {t.tools?.map((tc, j) => (
                    <div key={j} className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> {tc.name}({JSON.stringify(tc.input)})
                    </div>
                  ))}
                  {t.model && (
                    <div>
                      {AI_MODELS[t.model]?.label ?? t.model}
                      {typeof t.costUsd === "number" && ` · RM${(t.costUsd * USD_TO_MYR).toFixed(4)}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-white border rounded-2xl px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> menaip…
            </div>
          </div>
        )}
      </div>

      {err && <div className="text-sm text-red-500">{err}</div>}

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Taip mesej customer… (⌘/Ctrl+Enter hantar)"
          className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, ArrowLeft, Loader2 } from "lucide-react";
import { AI_MODELS, USD_TO_MYR } from "@/lib/ai/models";

interface Data {
  days: number;
  capped: boolean;
  handled: number;
  replied: number;
  escalated: number;
  unansweredCount: number;
  errors: number;
  totalCostUsd: number;
  avgTokens: number;
  byModel: Record<string, { count: number; cost: number; tokensIn: number; tokensOut: number }>;
  unanswered: { preview: string; outcome: string; created_at: string }[];
}

const RANGES = [7, 30, 90];
const rm = (usd: number) => `RM${(usd * USD_TO_MYR).toFixed(2)}`;
const modelLabel = (k: string) => AI_MODELS[k]?.label ?? k;

export function AnalyticsClient() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/ai/analytics?days=${days}`)
      .then((r) => r.json())
      .then((j) => setData(j.error ? null : j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-700" />
          <h1 className="text-xl font-semibold text-gray-800">AI Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={`px-3 py-1.5 text-sm ${days === r ? "bg-gray-800 text-white" : "bg-white text-gray-600"}`}
              >
                {r} hari
              </button>
            ))}
          </div>
          <Link href="/admin/crm/ai" className="text-sm text-gray-500 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Config
          </Link>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
        </div>
      )}

      {!loading && data && (
        <>
          {/* Kad ringkasan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Balasan AI" value={data.replied.toLocaleString()} />
            <Stat label="Jumlah dikendali" value={data.handled.toLocaleString()} />
            <Stat label="Kos" value={rm(data.totalCostUsd)} sub={`$${data.totalCostUsd.toFixed(4)}`} />
            <Stat label="Avg token/balasan" value={data.avgTokens.toLocaleString()} />
            <Stat label="Tak terjawab" value={data.unansweredCount.toLocaleString()} />
            <Stat label="Diserah team" value={data.escalated.toLocaleString()} />
            <Stat label="Error" value={data.errors.toLocaleString()} />
          </div>

          {/* Kos ikut model */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">Kos ikut model</div>
            {Object.keys(data.byModel).length === 0 ? (
              <div className="text-xs text-gray-400">Tiada data lagi.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400">
                  <tr>
                    <th className="text-left py-1">Model</th>
                    <th className="text-right py-1">Panggilan</th>
                    <th className="text-right py-1">Token</th>
                    <th className="text-right py-1">Kos</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.byModel).map(([k, v]) => (
                    <tr key={k} className="border-t">
                      <td className="py-1.5 text-gray-800">{modelLabel(k)}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600">{v.count.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-600">{(v.tokensIn + v.tokensOut).toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-700">{rm(v.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Soalan tak terjawab */}
          <div className="bg-white rounded-xl border p-4">
            <div className="text-sm font-semibold text-gray-600 mb-2">
              Soalan tak terjawab / diserah team
            </div>
            {data.unanswered.length === 0 ? (
              <div className="text-xs text-gray-400">Tiada — AI berjaya jawab semua dalam tempoh ini.</div>
            ) : (
              <ul className="divide-y">
                {data.unanswered.map((u, i) => (
                  <li key={i} className="py-2 flex items-start justify-between gap-3">
                    <span className="text-sm text-gray-700 flex-1">{u.preview || <span className="text-gray-400">(tiada teks)</span>}</span>
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {u.outcome === "escalated" ? "minta manusia" : "AI tak tahu"} ·{" "}
                      {new Date(u.created_at).toLocaleDateString("ms-MY", { day: "numeric", month: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data.capped && (
            <p className="text-[11px] text-amber-600">Nota: paparan dihadkan kepada rekod terkini (volum tinggi).</p>
          )}
        </>
      )}

      {!loading && !data && <div className="text-sm text-red-500">Gagal muat analytics.</div>}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-3">
      <div className="text-lg font-semibold text-gray-800 tabular-nums">{value}</div>
      <div className="text-[11px] text-gray-400">{label}</div>
      {sub && <div className="text-[11px] text-gray-300">{sub}</div>}
    </div>
  );
}

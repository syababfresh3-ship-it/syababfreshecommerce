"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Recipient {
  wa_id: string; name: string | null; status: string; error: string | null;
  sent_at: string | null; delivered_at: string | null; read_at: string | null;
  orders?: number; revenue?: number;
}
interface Blast {
  id: string; name: string; template_name: string; status: string; total: number;
  scheduled_at: string | null; created_at: string;
}
interface Progress { total: number; pending: number; sent: number; delivered: number; read: number; failed: number; }

const statusColor: Record<string, string> = {
  pending: "text-gray-400", sent: "text-sky-500", delivered: "text-emerald-600",
  read: "text-violet-500", failed: "text-red-500",
};
function fmt(s: string | null) {
  return s ? new Date(s).toLocaleString("ms-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

export function CampaignDetail({ id }: { id: string }) {
  const [blast, setBlast] = useState<Blast | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/whatsapp/blast/${id}`)
      .then((r) => r.json())
      .then((j) => { setBlast(j.blast ?? null); setRecipients(j.recipients ?? []); setProgress(j.progress ?? null); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-gray-400">Memuatkan…</div>;
  if (!blast) return <div className="p-6 text-sm text-gray-400">Campaign tidak dijumpai. <Link href="/admin/crm/blast" className="text-emerald-600">Kembali</Link></div>;

  const p = progress ?? { total: blast.total, pending: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
  const buyers = recipients.filter((r) => (r.orders ?? 0) > 0).length;
  const revenue = recipients.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const buckets = [
    { label: "Unreached", n: p.failed, c: "text-red-500" },
    { label: "Sent", n: p.sent, c: "text-sky-500" },
    { label: "Delivered", n: p.delivered, c: "text-emerald-600" },
    { label: "Read", n: p.read, c: "text-violet-500" },
    { label: revenue > 0 ? `Beli · RM${revenue.toLocaleString("ms-MY", { maximumFractionDigits: 0 })}` : "Beli", n: buyers, c: "text-[#E11D2A]" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <Link href="/admin/crm/blast" className="text-sm text-gray-400 hover:text-gray-700">← Blaster</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">{blast.name}</h1>
        <p className="text-sm text-gray-400">{blast.template_name} · {blast.status} · {p.total} penerima</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {buckets.map((b) => (
          <div key={b.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
            <p className={`text-2xl font-black ${b.c}`}>{b.n}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{b.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-bold text-gray-700">Penerima</div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
          {recipients.map((r, i) => (
            <div key={i} className="px-4 py-2 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <span className="text-gray-800">{r.name || r.wa_id}</span>
                <span className="text-[11px] text-gray-400 ml-2">{r.wa_id}</span>
                {(r.orders ?? 0) > 0 && (
                  <span className="text-[10px] font-extrabold text-[#E11D2A] bg-[#FDECEC] rounded-full px-2 py-0.5 ml-2">
                    🛒 Beli RM{Number(r.revenue ?? 0).toLocaleString("ms-MY", { maximumFractionDigits: 0 })}
                  </span>
                )}
                {r.error && <span className="text-[11px] text-red-400 ml-2">{r.error}</span>}
              </div>
              <span className={`text-xs font-bold ${statusColor[r.status] ?? "text-gray-400"}`}>{r.status}</span>
              <span className="text-[11px] text-gray-300 w-28 text-right hidden sm:block">
                {fmt(r.read_at ?? r.delivered_at ?? r.sent_at)}
              </span>
            </div>
          ))}
          {recipients.length === 0 && <div className="p-6 text-center text-sm text-gray-400">Tiada penerima.</div>}
        </div>
      </div>
    </div>
  );
}

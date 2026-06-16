"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Contact {
  wa_id: string;
  name: string | null;
  phone: string | null;
}
interface Lead {
  id: string;
  stage: string;
  source: string | null;
  campaign: string | null;
  value: number | null;
  next_followup_at: string | null;
  won_at: string | null;
  contact_id: string;
  wa_contacts: Contact | null;
}

const STAGES = [
  { key: "baru", label: "Baru", color: "border-gray-300" },
  { key: "followup", label: "Follow-up", color: "border-blue-300" },
  { key: "hangat", label: "Hangat", color: "border-amber-300" },
  { key: "won", label: "Won 🎉", color: "border-emerald-400" },
  { key: "lost", label: "Lost", color: "border-red-300" },
];

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("ms-MY", { day: "2-digit", month: "short" }) : "";

export function PipelineClient() {
  const supabase = createClient();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Lead | null>(null);
  const [val, setVal] = useState("");
  const [followup, setFollowup] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMsg, setPayMsg] = useState("");

  const loadLeads = useCallback(async () => {
    const { data } = await supabase
      .from("crm_leads")
      .select("id, stage, source, campaign, value, next_followup_at, won_at, contact_id, wa_contacts(wa_id, name, phone)")
      .order("updated_at", { ascending: false })
      .limit(500);
    setLeads((data as unknown as Lead[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLeads();
  }, [loadLeads]);

  async function moveLead(id: string, stage: string) {
    const patch: Record<string, unknown> = { stage };
    if (stage === "won") patch.won_at = new Date().toISOString();
    if (stage === "lost") patch.lost_at = new Date().toISOString();
    // optimistik
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l)));
    await supabase.from("crm_leads").update(patch).eq("id", id);
  }

  function openEdit(l: Lead) {
    setEdit(l);
    setVal(l.value != null ? String(l.value) : "");
    setFollowup(l.next_followup_at ? l.next_followup_at.slice(0, 10) : "");
    setPayAmount("");
    setPayMsg("");
  }

  async function sendPaymentLink() {
    if (!edit || !payAmount || Number(payAmount) <= 0) {
      setPayMsg("Masukkan jumlah (RM).");
      return;
    }
    setPayMsg("Menghantar link…");
    const res = await fetch("/api/whatsapp/payment-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: edit.contact_id, amount: Number(payAmount), description: "Pembayaran SyababFresh" }),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      setPayMsg("✅ Link bayar dihantar ke WhatsApp!");
      setPayAmount("");
      loadLeads();
    } else {
      setPayMsg("❌ " + (j.error || "Gagal hantar."));
    }
  }

  async function saveEdit() {
    if (!edit) return;
    await supabase
      .from("crm_leads")
      .update({
        value: val ? Number(val) : 0,
        next_followup_at: followup ? new Date(followup).toISOString() : null,
      })
      .eq("id", edit.id);
    setEdit(null);
    loadLeads();
  }

  const name = (l: Lead) => l.wa_contacts?.name || l.wa_contacts?.phone || l.wa_contacts?.wa_id || "?";
  const overdue = (l: Lead) => l.next_followup_at && new Date(l.next_followup_at) < new Date();

  return (
    <div className="p-4 h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold text-gray-800">Sales Pipeline</h1>
        <span className="text-sm text-gray-400">{leads.length} lead · seret kad untuk tukar stage</span>
      </div>

      <div className="flex-1 flex gap-3 overflow-x-auto">
        {STAGES.map((st) => {
          const items = leads.filter((l) => l.stage === st.key);
          const total = items.reduce((s, l) => s + (Number(l.value) || 0), 0);
          return (
            <div
              key={st.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) moveLead(dragId, st.key);
                setDragId(null);
              }}
              className="w-64 shrink-0 bg-gray-100 rounded-lg flex flex-col"
            >
              <div className="px-3 py-2 border-b flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700">
                  {st.label} <span className="text-gray-400">({items.length})</span>
                </span>
                {total > 0 && <span className="text-[11px] text-emerald-600">RM{total.toFixed(0)}</span>}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onClick={() => openEdit(l)}
                    className={`bg-white rounded-lg border-l-4 ${st.color} shadow-sm p-2.5 cursor-pointer hover:shadow`}
                  >
                    <div className="text-sm font-medium text-gray-800 truncate">{name(l)}</div>
                    <div className="text-xs text-gray-400">{l.wa_contacts?.phone || l.wa_contacts?.wa_id}</div>
                    {l.campaign && <div className="text-[10px] text-blue-500 mt-1">📣 {l.campaign}</div>}
                    <div className="flex justify-between items-center mt-1.5">
                      {l.value ? <span className="text-xs text-emerald-600 font-medium">RM{Number(l.value).toFixed(0)}</span> : <span />}
                      {l.next_followup_at && (
                        <span className={`text-[10px] ${overdue(l) ? "text-red-500 font-medium" : "text-gray-400"}`}>
                          ⏰ {fmtDate(l.next_followup_at)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="text-xs text-gray-300 text-center py-4">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal edit lead */}
      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-gray-800">{name(edit)}</div>
            <div className="text-xs text-gray-400">{edit.wa_contacts?.phone || edit.wa_contacts?.wa_id}</div>

            <div>
              <label className="text-xs text-gray-500">Nilai deal (RM)</label>
              <input
                type="number"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Follow-up seterusnya</label>
              <input
                type="date"
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { moveLead(edit.id, "won"); setEdit(null); }} className="flex-1 bg-emerald-500 text-white rounded-lg py-2 text-sm">
                Won 🎉
              </button>
              <button onClick={() => { moveLead(edit.id, "lost"); setEdit(null); }} className="flex-1 bg-gray-200 text-gray-700 rounded-lg py-2 text-sm">
                Lost
              </button>
            </div>

            <div className="border-t pt-3">
              <label className="text-xs text-gray-500">💳 Hantar link bayar (CHIP) ke WhatsApp</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Jumlah RM"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button onClick={sendPaymentLink} className="bg-blue-600 text-white rounded-lg px-4 text-sm font-medium">
                  Hantar
                </button>
              </div>
              {payMsg && <div className="text-xs mt-1.5 text-gray-600">{payMsg}</div>}
            </div>

            <a
              href={`/admin/crm/inbox`}
              className="block text-center text-sm text-blue-600 hover:underline"
            >
              💬 Buka inbox untuk balas
            </a>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEdit(null)} className="flex-1 border rounded-lg py-2 text-sm">
                Batal
              </button>
              <button onClick={saveEdit} className="flex-1 bg-gray-900 text-white rounded-lg py-2 text-sm">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

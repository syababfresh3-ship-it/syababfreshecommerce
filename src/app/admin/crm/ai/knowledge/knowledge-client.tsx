"use client";

// Pengetahuan buah — senarai produk + status kad fakta (tiada/draf/disahkan), panel edit medan tetap + FAQ produk,
// "Jana draf AI" (satu / pukal 5 sekali), Sahkan / Batal pengesahan; tab FAQ umum (ai_faq).
// AI chatbot hanya guna kad berstatus DISAHKAN. Ikon lucide monokrom. Panel fixed (admin-shell overflow-hidden).
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Search, X, Sparkles, ShieldCheck, Undo2, Save, Plus, Trash2, Settings2, FlaskConical, Leaf, ChevronDown } from "lucide-react";
import { FACT_FIELDS, type FactKey, type FaqItem, type ProductFacts } from "@/lib/ai/product-knowledge-fields";

interface Row { id: string; name: string; slug: string; category: string | null; has_description: boolean; status: "none" | "draft" | "verified"; source: string | null; filled: number; updated_at: string | null; updated_by: string | null; verified_by: string | null }
interface Summary { total: number; verified: number; draft: number; none: number }
interface Detail {
  product: { id: string; name: string; slug: string; unit: string; description: string; category: string | null; variants: string[] };
  knowledge: { facts: ProductFacts; status: "draft" | "verified"; source: string | null; drafted_at: string | null; verified_at: string | null; verified_by: string | null; updated_at: string; updated_by: string | null } | null;
}
interface FaqRow { id: string; category: string | null; question: string; answer: string; is_active: boolean; sort_order: number; updated_by: string | null; _new?: boolean }

const inp = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white w-full focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50";
const lbl = "block text-xs font-semibold text-gray-600 mb-1";
const btnPrimary = "inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50";
const btnGhost = "inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50";
const fmtDT = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const STATUS_LABEL: Record<Row["status"], string> = { none: "Tiada", draft: "Draf", verified: "Disahkan" };
function StatusChip({ s }: { s: Row["status"] }) {
  const cls = s === "verified" ? "bg-gray-900 text-white border-gray-900" : s === "draft" ? "bg-white text-gray-700 border-gray-300" : "bg-gray-50 text-gray-400 border-gray-200";
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${cls}`}>{s === "verified" && <ShieldCheck className="h-3 w-3" />}{STATUS_LABEL[s]}</span>;
}
const emptyForm = (): Record<FactKey, string> => Object.fromEntries(FACT_FIELDS.map((f) => [f.key, ""])) as Record<FactKey, string>;

export function KnowledgeClient() {
  const [tab, setTab] = useState<"produk" | "faq">("produk");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);   // cth migration 151 belum dijalankan
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<Record<FactKey, string>>(emptyForm());
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number; cost: number; fail: number } | null>(null);
  const [confirmUnverify, setConfirmUnverify] = useState(false);
  // FAQ umum
  const [faq, setFaq] = useState<FaqRow[]>([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const res = await fetch("/api/admin/ai/knowledge");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setError(j.error ?? "Gagal muat"); setRows([]); setSummary(null); setLoading(false); return; }
    setRows(j.products ?? []); setSummary(j.summary ?? null); setWarning(j.warning ?? null); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadFaq = useCallback(async () => {
    setFaqLoading(true); setFaqError(null);
    const res = await fetch("/api/admin/ai/faq");
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setFaqError(j.error ?? "Gagal muat FAQ"); setFaq([]); setFaqLoading(false); return; }
    setFaq(j.faq ?? []); setFaqLoading(false);
  }, []);
  useEffect(() => { if (tab === "faq") loadFaq(); }, [tab, loadFaq]);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/ai/knowledge?id=${id}`);
    const j = (await res.json().catch(() => ({}))) as Detail & { error?: string };
    if (!res.ok) { toast.error(j.error ?? "Gagal muat produk"); setOpenId(null); return; }
    setDetail(j);
    const f = emptyForm();
    for (const x of FACT_FIELDS) f[x.key] = j.knowledge?.facts?.[x.key] ?? "";
    setForm(f); setFaqItems(j.knowledge?.facts?.faq ?? []); setConfirmUnverify(false);
  }, []);
  useEffect(() => { if (openId) loadDetail(openId); else setDetail(null); }, [openId, loadDetail]);

  const filtered = useMemo(() => rows.filter((r) => (!status || r.status === status) && (!q.trim() || `${r.name} ${r.category ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, status, q]);
  const noneIds = useMemo(() => rows.filter((r) => r.status === "none").map((r) => r.id), [rows]);

  async function save(action: "save" | "verify" | "unverify") {
    if (!detail) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/ai/knowledge/${detail.product.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, facts: { ...form, faq: faqItems } }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error ?? "Gagal simpan"); return; }
      toast.success(action === "verify" ? "Disahkan — AI akan guna fakta ini" : action === "unverify" ? "Pengesahan dibatalkan (kembali draf)" : "Draf disimpan");
      await loadDetail(detail.product.id); await load();
    } finally { setBusy(null); setConfirmUnverify(false); }
  }
  async function draftOne() {
    if (!detail) return;
    setBusy("draft");
    try {
      const res = await fetch("/api/admin/ai/knowledge/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [detail.product.id], overwrite: true }) });
      const j = await res.json().catch(() => ({}));
      const r = j.results?.[0];
      if (!res.ok || !r?.ok) { toast.error(r?.error ?? j.error ?? "Gagal jana draf"); return; }
      toast.success("Draf AI dijana — semak & sahkan");
      await loadDetail(detail.product.id); await load();
    } finally { setBusy(null); }
  }
  async function bulkDraft() {
    const ids = noneIds;
    if (!ids.length) return;
    setBulk({ done: 0, total: ids.length, cost: 0, fail: 0 });
    let done = 0, cost = 0, fail = 0;
    for (let i = 0; i < ids.length; i += 5) {
      const chunk = ids.slice(i, i + 5);
      try {
        const res = await fetch("/api/admin/ai/knowledge/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: chunk }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { toast.error(j.error ?? "Gagal"); fail += chunk.length; break; }
        for (const r of j.results ?? []) { if (r.ok) done++; else fail++; }
        cost += Number(j.costUsd) || 0;
      } catch { fail += chunk.length; }
      setBulk({ done, total: ids.length, cost, fail });
    }
    toast.success(`${done} draf dijana${fail ? `, ${fail} gagal` : ""} · ~US$${cost.toFixed(3)}`);
    setBulk(null); await load();
  }
  async function removeCard() {
    if (!detail) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/admin/ai/knowledge/${detail.product.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Gagal buang"); return; }
      toast.success("Kad fakta dibuang"); setOpenId(null); await load();
    } finally { setBusy(null); }
  }

  // FAQ umum
  const addFaqRow = () => setFaq((l) => [{ id: `new-${Date.now()}`, category: "", question: "", answer: "", is_active: true, sort_order: 0, updated_by: null, _new: true }, ...l]);
  const editFaq = (id: string, patch: Partial<FaqRow>) => setFaq((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  async function saveFaq(r: FaqRow) {
    setBusy(`faq-${r.id}`);
    try {
      const body = { category: r.category ?? "", question: r.question, answer: r.answer, is_active: r.is_active, sort_order: r.sort_order };
      const res = await fetch(r._new ? "/api/admin/ai/faq" : `/api/admin/ai/faq/${r.id}`, { method: r._new ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error ?? "Gagal simpan"); return; }
      toast.success("FAQ disimpan"); await loadFaq();
    } finally { setBusy(null); }
  }
  async function deleteFaq(r: FaqRow) {
    if (r._new) { setFaq((l) => l.filter((x) => x.id !== r.id)); setConfirmDel(null); return; }
    setBusy(`faq-${r.id}`);
    try {
      const res = await fetch(`/api/admin/ai/faq/${r.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Gagal padam"); return; }
      toast.success("FAQ dipadam"); await loadFaq();
    } finally { setBusy(null); setConfirmDel(null); }
  }

  const k = detail?.knowledge ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Leaf className="h-5 w-5 text-gray-500" />Pengetahuan buah</h1>
          <p className="text-sm text-gray-500">Kad fakta setiap produk untuk AI chatbot. AI hanya guna kad yang <b>disahkan</b>. Draf dijana AI dari penerangan produk — anda semak, betulkan, sahkan.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/crm/ai" className="text-sm text-gray-500 flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" /> Config</Link>
          <Link href="/admin/crm/ai/playground" className="text-sm text-gray-500 flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" /> Playground</Link>
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white mb-4">
        {(["produk", "faq"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md text-sm font-semibold ${tab === t ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>{t === "produk" ? "Produk" : "FAQ umum"}</button>
        ))}
      </div>

      {tab === "produk" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-sm text-gray-600">{summary ? <>{summary.total} produk · <b>{summary.verified}</b> disahkan · {summary.draft} draf · {summary.none} tiada</> : ""}</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative"><Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk / kategori" className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gray-900" /></div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white" aria-label="Status"><option value="">Semua status</option><option value="none">Tiada</option><option value="draft">Draf</option><option value="verified">Disahkan</option></select>
              <button type="button" onClick={bulkDraft} disabled={!!bulk || !noneIds.length} className={btnPrimary} title="AI jana draf untuk semua produk yang belum ada kad fakta">{bulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{bulk ? `Menjana ${bulk.done}/${bulk.total}…` : `Jana draf AI (${noneIds.length} tanpa fakta)`}</button>
            </div>
          </div>
          {error && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-3" role="alert">{error}</div>}
          {warning && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-3" role="alert">{warning} — senarai dipapar, tetapi draf/sahkan belum boleh disimpan.</div>}
          {loading ? <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : (
            <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500"><tr>
                  <th className="text-left font-bold px-3 py-2.5">Produk</th><th className="text-left font-bold px-3 py-2.5">Kategori</th><th className="text-left font-bold px-3 py-2.5">Penerangan</th><th className="text-left font-bold px-3 py-2.5">Status</th><th className="text-left font-bold px-3 py-2.5">Medan terisi</th><th className="text-left font-bold px-3 py-2.5">Kemas kini</th><th className="text-left font-bold px-3 py-2.5">Oleh</th>
                </tr></thead>
                <tbody>
                  {filtered.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Tiada produk.</td></tr> : filtered.map((r) => (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <td className="px-3 py-2.5 text-gray-900 font-medium">{r.name}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{r.category ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">{r.has_description ? <span className="text-gray-600">Ada</span> : <span className="text-amber-700 font-semibold">Tiada</span>}</td>
                      <td className="px-3 py-2.5"><StatusChip s={r.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{r.status === "none" ? "—" : `${r.filled}/${FACT_FIELDS.length + 1}`}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtDT(r.updated_at)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">{r.status === "verified" ? r.verified_by ?? "—" : r.source === "ai" ? "AI (draf)" : r.updated_by ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "faq" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="text-sm text-gray-600">Soalan umum (penghantaran, kualiti, kurma, bayaran) yang AI guna terus. Hanya yang <b>aktif</b> disuntik ke chatbot WhatsApp.</p>
            <button type="button" onClick={addFaqRow} className={btnPrimary}><Plus className="h-4 w-4" />Tambah soalan</button>
          </div>
          {faqError && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-3" role="alert">{faqError}</div>}
          {faqLoading ? <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : faq.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center">Belum ada FAQ. Tambah soalan pertama.</p> : (
            <div className="space-y-2">
              {faq.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                  <div><label className={lbl}>Kategori</label><input value={r.category ?? ""} onChange={(e) => editFaq(r.id, { category: e.target.value })} className={inp} placeholder="cth Penghantaran" /></div>
                  <div className="space-y-2">
                    <div><label className={lbl}>Soalan</label><input value={r.question} onChange={(e) => editFaq(r.id, { question: e.target.value })} className={inp} placeholder="cth Berapa lama kurma tahan?" /></div>
                    <div><label className={lbl}>Jawapan</label><textarea value={r.answer} onChange={(e) => editFaq(r.id, { answer: e.target.value })} rows={2} className={inp} /></div>
                  </div>
                  <div className="flex sm:flex-col items-end gap-2 justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={r.is_active} onChange={(e) => editFaq(r.id, { is_active: e.target.checked })} className="accent-gray-900" />Aktif</label>
                    <div className="flex items-center gap-1">
                      {confirmDel === r.id ? <span className="inline-flex items-center gap-2 text-xs"><span className="text-gray-600">Padam?</span><button type="button" onClick={() => deleteFaq(r)} className="font-bold text-gray-900">Ya</button><button type="button" onClick={() => setConfirmDel(null)} className="text-gray-500">Tidak</button></span>
                        : <button type="button" onClick={() => setConfirmDel(r.id)} className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900" aria-label="Padam"><Trash2 className="h-4 w-4" /></button>}
                      <button type="button" onClick={() => saveFaq(r)} disabled={busy === `faq-${r.id}` || !r.question.trim() || !r.answer.trim()} className={btnGhost}>{busy === `faq-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Simpan</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Panel produk */}
      {openId && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpenId(null)} />
          <aside className="absolute right-0 top-0 h-full w-full sm:w-[640px] bg-white shadow-2xl overflow-y-auto">
            {!detail ? <div className="py-12 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : (
              <div className="p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Kad fakta</p>
                    <h2 className="text-lg font-bold text-gray-900 leading-snug">{detail.product.name}</h2>
                    <p className="text-sm text-gray-500 flex flex-wrap items-center gap-2">{detail.product.category ?? "—"} <StatusChip s={k?.status ?? "none"} />{k?.status === "verified" && <span className="text-xs">oleh {k.verified_by ?? "—"} · {fmtDT(k.verified_at)}</span>}{k?.source === "ai" && k.status === "draft" && <span className="text-xs">draf AI {fmtDT(k.drafted_at)}</span>}</p>
                  </div>
                  <button type="button" onClick={() => setOpenId(null)} className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-600" aria-label="Tutup"><X className="h-4 w-4" /></button>
                </div>

                <details className="rounded-xl border border-gray-200 p-3 group">
                  <summary className="text-xs font-bold uppercase tracking-wide text-gray-400 cursor-pointer flex items-center justify-between">Penerangan produk (sumber draf) <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition" /></summary>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{detail.product.description || <span className="text-amber-700">Tiada penerangan — draf AI akan bergantung pada pengetahuan umum; semak lebih teliti.</span>}</p>
                  {detail.product.variants.length > 0 && <p className="text-xs text-gray-500 mt-2">Saiz/gred: {detail.product.variants.join(" · ")}</p>}
                </details>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={draftOne} disabled={busy === "draft"} className={btnGhost} title="AI isi semula semua medan dari penerangan (menimpa teks sekarang; status jadi draf)">{busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{k ? "Jana semula draf AI" : "Jana draf AI"}</button>
                  <span className="text-[11px] text-gray-400">Draf dari penerangan produk + pengetahuan umum jenis buah. Betulkan apa yang salah sebelum sahkan.</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {FACT_FIELDS.map((f) => (
                    <div key={f.key} className={f.key === "beza_gred" || f.key === "kesihatan" ? "sm:col-span-2" : ""}>
                      <label className={lbl}>{f.label}{f.hint && <span className="text-gray-400 font-normal"> · {f.hint}</span>}</label>
                      <textarea value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} rows={2} className={inp} />
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2"><p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Soalan lazim produk ini</p><button type="button" onClick={() => setFaqItems((l) => [...l, { q: "", a: "" }])} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"><Plus className="h-3.5 w-3.5" />Tambah</button></div>
                  {faqItems.length === 0 ? <p className="text-xs text-gray-400">Tiada. Contoh: &quot;Boleh makan terus tanpa cuci?&quot;</p> : (
                    <div className="space-y-2">
                      {faqItems.map((it, i) => (
                        <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                          <div className="space-y-1">
                            <input value={it.q} onChange={(e) => setFaqItems((l) => l.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} placeholder="Soalan" className={inp} />
                            <textarea value={it.a} onChange={(e) => setFaqItems((l) => l.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} placeholder="Jawapan" rows={2} className={inp} />
                          </div>
                          <button type="button" onClick={() => setFaqItems((l) => l.filter((_, j) => j !== i))} className="h-8 w-8 grid place-items-center rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 self-start" aria-label="Buang"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {k && (confirmUnverify ? <span className="inline-flex items-center gap-2 text-xs"><span className="text-gray-600">{k.status === "verified" ? "Batal pengesahan?" : "Buang kad?"}</span><button type="button" onClick={() => (k.status === "verified" ? save("unverify") : removeCard())} className="font-bold text-gray-900">Ya</button><button type="button" onClick={() => setConfirmUnverify(false)} className="text-gray-500">Tidak</button></span>
                      : <button type="button" onClick={() => setConfirmUnverify(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900">{k.status === "verified" ? <><Undo2 className="h-3.5 w-3.5" />Batal pengesahan</> : <><Trash2 className="h-3.5 w-3.5" />Buang kad</>}</button>)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => save("save")} disabled={!!busy} className={btnGhost}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{k?.status === "verified" ? "Simpan" : "Simpan draf"}</button>
                    {k?.status !== "verified" && <button type="button" onClick={() => save("verify")} disabled={!!busy} className={btnPrimary}>{busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Simpan &amp; sahkan</button>}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">Sahkan = AI chatbot mula guna fakta ini untuk jawab customer. Harga & stok tetap datang dari katalog live, bukan dari sini.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

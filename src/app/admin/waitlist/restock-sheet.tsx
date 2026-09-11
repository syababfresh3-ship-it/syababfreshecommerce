"use client";

// Sheet pengesahan "Hantar notis restock" (Sprint 3 G) — satu klik dari waitlist.
// Buka → POST dry (kiraan penerima, stok, lalai) → admin semak template WA
// (wajib untuk saluran WA: Cloud API hanya terima template diluluskan) & mesej
// e-mel → Hantar (POST sebenar). WA guna Blaster yang SAMA dengan aliran manual
// dulu (salin nombor → wizard), cuma automatik; e-mel diutamakan bila ada.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, Mail, MessageSquare, Send, X } from "lucide-react";
import { autoMapTemplateParams, classifyParamKey, extractTemplateParams, previewTemplateBody } from "@/lib/waitlist-restock-message";

interface Template { name: string; language: string; category: string; components: Array<{ type: string; text?: string; format?: string }> }
interface WaNumber { phone_number_id: string; display_name: string; is_default: boolean }
interface Plan {
  product: { id: string; name: string; slug: string; image_url: string | null; is_active: boolean; url: string };
  stock: { available: number | null; hasVariants: boolean; source: string };
  counts: { pending: number; wa: number; email: number; both: number; suppressed: number; noChannel: number };
  campaign: { name: string; total: number };
  defaults: {
    message: string;
    waNumbers: WaNumber[];
    lastRestock: { template_name: string; template_lang: string; phone_number_id: string | null; header_image: string | null } | null;
  };
}
interface Result {
  blastId: string | null;
  counts: { waQueued: number; waSentNow: number; emailSent: number; emailFailed: number; marked: number; skipped: number };
}

const bodyOf = (t: Template | null) => t?.components.find((c) => c.type === "BODY")?.text ?? "";
const hasHeader = (t: Template | null, fmt: string) => t?.components.some((c) => c.type === "HEADER" && c.format === fmt) ?? false;

// Lalai bila template dipilih: auto-map param + gambar header = gambar produk.
function templateDefaults(t: Template | null, p: Plan) {
  if (!t) return { params: {} as Record<string, string>, headerImage: "" };
  const params = autoMapTemplateParams(extractTemplateParams(bodyOf(t)), { productName: p.product.name, productUrl: p.product.url });
  return { params, headerImage: hasHeader(t, "IMAGE") ? (p.product.image_url ?? "") : "" };
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800";
const label = "text-xs font-semibold text-gray-500";

export function RestockSheet({ productId, onClose, onDone }: { productId: string; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loadError, setLoadError] = useState("");
  const [channels, setChannels] = useState({ wa: true, email: true });
  const [message, setMessage] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  // Senarai template DITANDA nombor asalnya → "loading" = state terbitan (tiada
  // setState segerak dalam effect, ikut react-hooks/set-state-in-effect).
  const [tplState, setTplState] = useState<{ forNumber: string; list: Template[] } | null>(null);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [headerImage, setHeaderImage] = useState("");
  const [headerVideo, setHeaderVideo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  // 1) Pelan (dry) — kiraan & lalai; tiada tulisan.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/waitlist/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, dry: true }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Gagal muat pelan.");
        return j as Plan;
      })
      .then((p) => {
        if (cancelled) return;
        setPlan(p);
        setMessage(p.defaults.message);
        setChannels({ wa: p.counts.wa > 0, email: p.counts.email > 0 });
        const nums = p.defaults.waNumbers;
        const last = p.defaults.lastRestock?.phone_number_id;
        const pick = (last && nums.find((n) => n.phone_number_id === last)) || nums.find((n) => n.is_default) || nums[0];
        setFromNumber(pick?.phone_number_id ?? "");
      })
      .catch((e: Error) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [productId]);

  // 2) Template ikut nombor (per-WABA) — pra-pilih template restock terakhir / nama sepadan.
  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    const url = fromNumber ? `/api/whatsapp/templates?phoneId=${encodeURIComponent(fromNumber)}` : "/api/whatsapp/templates";
    fetch(url)
      .then((r) => r.json())
      .catch(() => ({ templates: [] }))
      .then((j) => {
        if (cancelled) return;
        const list: Template[] = j.templates ?? [];
        setTplState({ forNumber: fromNumber, list });
        const lastName = plan.defaults.lastRestock?.template_name;
        const pick = (lastName && list.find((t) => t.name === lastName)) || list.find((t) => /restock|waiting|stok|stock/i.test(t.name)) || null;
        const d = templateDefaults(pick, plan);
        setTpl(pick);
        setParams(d.params);
        setHeaderImage(d.headerImage);
        setHeaderVideo("");
      });
    return () => { cancelled = true; };
  }, [plan, fromNumber]);

  const tplLoading = !!plan && (!tplState || tplState.forNumber !== fromNumber);
  const templates = tplState?.list ?? [];

  function pickTemplate(name: string) {
    if (!plan) return;
    const t = templates.find((x) => x.name === name) ?? null;
    const d = templateDefaults(t, plan);
    setTpl(t);
    setParams(d.params);
    setHeaderImage(d.headerImage);
    setHeaderVideo("");
  }

  const bodyText = bodyOf(tpl);
  const needsImg = hasHeader(tpl, "IMAGE");
  const needsVid = hasHeader(tpl, "VIDEO");
  const waPreview = useMemo(() => previewTemplateBody(bodyText, params), [bodyText, params]);
  const otherKeys = Object.keys(params).filter((k) => classifyParamKey(k) === "other");

  const counts = plan?.counts;
  const waTargets = channels.wa ? (counts?.wa ?? 0) : 0;
  const emailTargets = channels.email ? (counts?.email ?? 0) : 0;
  const waOk = waTargets === 0 || (!!tpl && (!needsImg || headerImage.trim().length > 0) && (!needsVid || headerVideo.trim().length > 0));
  const canSend = !!plan && !sending && (waTargets > 0 || emailTargets > 0) && waOk && (emailTargets === 0 || message.trim().length > 0);

  async function send() {
    if (!plan) return;
    const parts = [waTargets > 0 ? `WhatsApp ${waTargets}` : null, emailTargets > 0 ? `e-mel ${emailTargets}` : null].filter(Boolean).join(" + ");
    if (!window.confirm(`Hantar notis restock "${plan.product.name}" ke ${parts}? Mesej sebenar.`)) return;
    setSending(true);
    setSendError("");
    const res = await fetch("/api/admin/waitlist/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        dry: false,
        message,
        channels,
        templateName: waTargets > 0 ? tpl?.name : undefined,
        templateLang: waTargets > 0 ? tpl?.language : undefined,
        params: waTargets > 0 ? params : undefined,
        headerImage: needsImg ? headerImage.trim() : undefined,
        headerVideo: needsVid ? headerVideo.trim() : undefined,
        phoneNumberId: fromNumber || undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setSendError(j.error || "Gagal hantar."); return; }
    setResult(j as Result);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Send size={16} className="text-gray-500" /> Hantar notis restock
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Tutup"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {loadError ? (
            <p className="text-sm text-gray-600">{loadError}</p>
          ) : !plan ? (
            <div className="py-10 text-center text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-xs">Mengira penerima &amp; semak stok…</p>
            </div>
          ) : result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-900 font-bold">
                <Check size={18} /> Notis dihantar
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500">WhatsApp</span>
                  <span className="font-semibold">
                    {result.counts.waQueued} dalam kempen
                    {result.counts.waQueued > 0 && <span className="text-gray-400 font-normal"> · {result.counts.waSentNow} keluar serta-merta, baki oleh cron</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">E-mel</span>
                  <span className="font-semibold">
                    {result.counts.emailSent} dihantar
                    {result.counts.emailFailed > 0 && <span className="text-gray-400 font-normal"> · {result.counts.emailFailed} gagal</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ditanda dah dimaklum</span>
                  <span className="font-semibold">{result.counts.marked}{result.counts.skipped > 0 && <span className="text-gray-400 font-normal"> · {result.counts.skipped} belum (tiada saluran / gagal)</span>}</span>
                </div>
              </div>
              {result.blastId && (
                <Link href={`/admin/crm/blast/${result.blastId}`} className="block text-center text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50">
                  Lihat kempen di Blaster
                </Link>
              )}
              <button onClick={onClose} className="w-full bg-gray-800 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-gray-900">Tutup</button>
            </div>
          ) : (
            <>
              {/* Produk + stok */}
              <div className="flex items-center gap-3">
                {plan.product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={plan.product.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-gray-100 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{plan.product.name}</p>
                  <p className="text-xs text-gray-500">
                    Stok semasa: <b className="text-gray-800">{plan.stock.available ?? "?"}</b>
                    {plan.stock.hasVariants && <span> (termasuk varian)</span>}
                    {!plan.product.is_active && <span> · produk tidak aktif</span>}
                  </p>
                  <a href={plan.product.url} target="_blank" rel="noreferrer" className="text-[11px] text-gray-400 underline truncate block">{plan.product.url}</a>
                </div>
              </div>
              {(plan.stock.available ?? 0) <= 0 && (
                <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Stok masih 0. Masukkan stok dulu supaya pelanggan boleh terus beli bila klik pautan.</span>
                </div>
              )}

              {/* Penerima */}
              <div>
                <p className={label}>Penerima (belum dimaklum: {plan.counts.pending})</p>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <div className="border border-gray-200 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-gray-500 flex items-center gap-1"><MessageSquare size={12} /> WhatsApp</p>
                    <p className="text-lg font-black text-gray-900">{plan.counts.wa}</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-gray-500 flex items-center gap-1"><Mail size={12} /> E-mel</p>
                    <p className="text-lg font-black text-gray-900">{plan.counts.email}</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-gray-500">Kedua-dua</p>
                    <p className="text-lg font-black text-gray-900">{plan.counts.both}</p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Entri yang ada e-mel terima WA + e-mel.
                  {plan.counts.suppressed > 0 && <span> · {plan.counts.suppressed} disekat (opt-out / suppression) — WA tidak dihantar.</span>}
                  {plan.counts.noChannel > 0 && <span> · {plan.counts.noChannel} tiada saluran (kekal menunggu).</span>}
                </p>
              </div>

              {/* Saluran */}
              <div className="flex gap-4">
                <label className={`flex items-center gap-2 text-sm ${plan.counts.wa === 0 ? "text-gray-300" : "text-gray-700"}`}>
                  <input type="checkbox" checked={channels.wa} disabled={plan.counts.wa === 0} onChange={(e) => setChannels((c) => ({ ...c, wa: e.target.checked }))} />
                  WhatsApp ({plan.counts.wa})
                </label>
                <label className={`flex items-center gap-2 text-sm ${plan.counts.email === 0 ? "text-gray-300" : "text-gray-700"}`}>
                  <input type="checkbox" checked={channels.email} disabled={plan.counts.email === 0} onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))} />
                  E-mel ({plan.counts.email})
                </label>
              </div>

              {/* WhatsApp — template diluluskan (Blaster) */}
              {channels.wa && plan.counts.wa > 0 && (
                <div className="border border-gray-200 rounded-xl p-3 space-y-2.5">
                  <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5"><MessageSquare size={13} /> WhatsApp — kempen &ldquo;{plan.campaign.name}&rdquo;</p>
                  {plan.defaults.waNumbers.length > 1 && (
                    <div>
                      <label className={label}>Hantar dari nombor</label>
                      <select className={`${inputCls} mt-1`} value={fromNumber} onChange={(e) => setFromNumber(e.target.value)}>
                        {plan.defaults.waNumbers.map((n) => <option key={n.phone_number_id} value={n.phone_number_id}>{n.display_name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className={label}>Template diluluskan {tplLoading && <Loader2 size={11} className="inline animate-spin ml-1" />}</label>
                    <select className={`${inputCls} mt-1`} value={tpl?.name ?? ""} onChange={(e) => pickTemplate(e.target.value)} disabled={tplLoading}>
                      <option value="">— pilih template —</option>
                      {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.category})</option>)}
                    </select>
                    {!tplLoading && templates.length === 0 && (
                      <p className="text-[11px] text-gray-500 mt-1">Tiada template diluluskan untuk nombor ini — luluskan template restock di WhatsApp Manager dulu, atau matikan saluran WhatsApp.</p>
                    )}
                  </div>
                  {tpl && Object.keys(params).length > 0 && (
                    <p className="text-[11px] text-gray-400">
                      Param auto: {Object.keys(params).map((k) => {
                        const kind = classifyParamKey(k);
                        return `${k} → ${kind === "name" ? "nama penerima" : kind === "product" ? "nama produk" : kind === "link" ? "pautan produk" : "isi bawah"}`;
                      }).join(" · ")}
                    </p>
                  )}
                  {otherKeys.map((k) => (
                    <div key={k}>
                      <label className={label}>{k}</label>
                      <input value={params[k]} onChange={(e) => setParams((p) => ({ ...p, [k]: e.target.value }))} className={`${inputCls} mt-1`} placeholder={k} />
                    </div>
                  ))}
                  {tpl && needsImg && (
                    <div>
                      <label className={label}>Gambar header (URL) — lalai gambar produk</label>
                      <input value={headerImage} onChange={(e) => setHeaderImage(e.target.value)} className={`${inputCls} mt-1`} placeholder="https://…" />
                    </div>
                  )}
                  {tpl && needsVid && (
                    <div>
                      <label className={label}>Video header (URL .mp4 awam)</label>
                      <input value={headerVideo} onChange={(e) => setHeaderVideo(e.target.value)} className={`${inputCls} mt-1`} placeholder="https://…" />
                    </div>
                  )}
                  {tpl && (
                    <div>
                      <p className={label}>Preview WhatsApp</p>
                      <pre className="mt-1 whitespace-pre-wrap font-sans text-[12.5px] text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">{waPreview}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* E-mel — teks bebas */}
              {channels.email && plan.counts.email > 0 && (
                <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5"><Mail size={13} /> E-mel — subjek &ldquo;{plan.product.name} dah ada stok semula&rdquo;</p>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className={`${inputCls} resize-y`} />
                  <p className="text-[11px] text-gray-400">{"{nama}"} diganti nama penerima. Butang &ldquo;Beli sekarang&rdquo; ke pautan produk ditambah automatik.</p>
                </div>
              )}

              {sendError && <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{sendError}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50">Batal</button>
                <button onClick={send} disabled={!canSend} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-gray-800 rounded-xl py-2.5 hover:bg-gray-900 disabled:opacity-40">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Hantar{waTargets + emailTargets > 0 ? ` (${[waTargets > 0 ? `WA ${waTargets}` : null, emailTargets > 0 ? `e-mel ${emailTargets}` : null].filter(Boolean).join(" + ")})` : ""}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

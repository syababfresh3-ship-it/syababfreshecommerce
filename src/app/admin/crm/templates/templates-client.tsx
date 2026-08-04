"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Bold, Italic, Strikethrough, Code, Braces, Link2, Phone, CornerUpLeft, X, Plus, Trash2 } from "lucide-react";

type ButtonType = "URL" | "PHONE_NUMBER" | "QUICK_REPLY";
interface TplButton { type: ButtonType; text: string; value: string } // value = URL atau no. telefon (kosong utk QUICK_REPLY)

const BUTTON_TYPE_LABEL: Record<ButtonType, string> = {
  URL: "Pergi ke URL",
  PHONE_NUMBER: "Panggil telefon",
  QUICK_REPLY: "Balas pantas",
};

interface Template {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text?: string; url?: string }>;
  }>;
}

interface Metric { sent: number; delivered: number; read: number }

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  REJECTED: "bg-red-50 text-red-700",
  PAUSED: "bg-gray-100 text-gray-600",
  DISABLED: "bg-gray-100 text-gray-600",
};

// Render teks gaya WhatsApp: *tebal* _condong_ ~coret~ ```mono```. Tokenizer
// ringkas — tak nested (sama macam WhatsApp sendiri). Newline dikekalkan oleh
// `whitespace-pre-wrap` pada bekas, jadi di sini kita cuma proses inline.
function renderWhatsAppText(text: string): ReactNode {
  if (!text) return null;
  const RE = /(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)|(```[^`]+```)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) out.push(<strong key={k++}>{tok.slice(1, -1)}</strong>);
    else if (m[2]) out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    else if (m[3]) out.push(<span key={k++} className="line-through">{tok.slice(1, -1)}</span>);
    else if (m[4]) out.push(<code key={k++} className="font-mono text-[13px]">{tok.slice(3, -3)}</code>);
    last = RE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Gelembung preview gaya WhatsApp — dipakai modal cipta (hidup) & modal preview.
function WhatsAppBubble({
  headerType, headerText, headerImageUrl, body, footer, buttons,
}: {
  headerType: "none" | "text" | "image";
  headerText?: string;
  headerImageUrl?: string | null;
  body: string;
  footer?: string;
  buttons?: { text: string; type?: string }[];
}) {
  const visible = (buttons ?? []).filter((b) => b.text?.trim());
  // WhatsApp papar maks 3 butang dalam mesej; selebihnya jadi "Lihat semua pilihan".
  const shown = visible.slice(0, 3);
  const overflow = visible.length - shown.length;
  const btnIcon = (t?: string) =>
    t === "PHONE_NUMBER" ? <Phone className="w-4 h-4" />
    : t === "QUICK_REPLY" ? <CornerUpLeft className="w-4 h-4" />
    : <Link2 className="w-4 h-4" />;
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: "#efeae2" }}>
      <div className="max-w-[92%]">
        <div className="bg-white rounded-lg rounded-tl-sm shadow-sm overflow-hidden">
          {headerType === "image" && (
            headerImageUrl
              ? <img src={headerImageUrl} alt="" className="w-full max-h-56 object-cover" />
              : <div className="bg-gray-100 text-gray-400 text-xs py-10 text-center">Gambar header</div>
          )}
          <div className="px-2.5 py-1.5">
            {headerType === "text" && headerText && (
              <div className="font-semibold text-[14.5px] text-gray-900 mb-0.5 whitespace-pre-wrap break-words">{headerText}</div>
            )}
            <div className="text-[14px] leading-[1.35] text-gray-800 whitespace-pre-wrap break-words">
              {body ? renderWhatsAppText(body) : <span className="text-gray-400">…isi mesej…</span>}
            </div>
            {footer && <div className="text-[12px] text-gray-400 mt-1.5 whitespace-pre-wrap break-words">{footer}</div>}
            <div className="text-[11px] text-gray-400 text-right mt-0.5 -mb-0.5">10:30</div>
          </div>
        </div>
        {shown.map((b, i) => (
          <div key={i} className="mt-1 bg-white rounded-lg shadow-sm py-2.5 flex items-center justify-center gap-1.5 text-sky-500 text-[14px] font-medium">
            {btnIcon(b.type)} {b.text}
          </div>
        ))}
        {overflow > 0 && (
          <div className="mt-1 bg-white rounded-lg shadow-sm py-2.5 flex items-center justify-center gap-1.5 text-sky-500 text-[14px] font-medium">
            <Braces className="w-4 h-4" /> Lihat semua pilihan
          </div>
        )}
      </div>
    </div>
  );
}

export function TemplatesClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Multi-number: template per-WABA. Pilih nombor → lihat/cipta template WABA-nya.
  const [waNumbers, setWaNumbers] = useState<{ phone_number_id: string; display_name: string }[]>([]);
  const [phoneId, setPhoneId] = useState("");

  // Prestasi (Meta Template Analytics) + preview.
  const [insights, setInsights] = useState<Record<string, Metric>>({});
  const [insightsNote, setInsightsNote] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);

  // Borang cipta
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("ms");
  const [headerType, setHeaderType] = useState<"none" | "text" | "image">("none");
  const [headerText, setHeaderText] = useState("");
  const [headerImage, setHeaderImage] = useState<File | null>(null);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [examples, setExamples] = useState<Record<string, string>>({});
  const [footerText, setFooterText] = useState("");
  const [buttons, setButtons] = useState<TplButton[]>([]);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr("");
    const url = phoneId ? `/api/whatsapp/templates?all=1&phoneId=${encodeURIComponent(phoneId)}` : "/api/whatsapp/templates?all=1";
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (j.templates) setTemplates(j.templates);
        else setErr(j.error || "Gagal muat template.");
        setLoading(false);
      })
      .catch(() => {
        setErr("Gagal muat template.");
        setLoading(false);
      });
  }, [phoneId]);

  useEffect(() => {
    load();
  }, [load]);

  // Senarai nombor aktif untuk pemilih WABA.
  useEffect(() => {
    fetch("/api/whatsapp/numbers")
      .then((r) => r.json())
      .then((j) => setWaNumbers((j.numbers ?? []).filter((n: { is_active: boolean }) => n.is_active)))
      .catch(() => {});
  }, []);

  // Prestasi template (sent/delivered/read, 30 hari) — per-WABA, tak block jadual.
  useEffect(() => {
    setInsights({});
    setInsightsNote("");
    const url = phoneId ? `/api/whatsapp/templates/insights?phoneId=${encodeURIComponent(phoneId)}` : "/api/whatsapp/templates/insights";
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (j.insights) setInsights(j.insights);
        if (j.enabled === false) setInsightsNote("Prestasi belum aktif untuk nombor ini — accept terms di WhatsApp Manager → Insights.");
      })
      .catch(() => {});
  }, [phoneId]);

  // Preview gambar header dari fail yang dipilih (object URL, dilepas bila tukar).
  useEffect(() => {
    if (!headerImage) { setHeaderImageUrl(null); return; }
    const url = URL.createObjectURL(headerImage);
    setHeaderImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [headerImage]);

  const count = (s: string) => templates.filter((t) => t.status === s).length;
  const bodyOf = (t: Template) => t.components.find((c) => c.type === "BODY")?.text ?? "";
  const varNames = Array.from(
    new Set(Array.from(bodyText.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map((m) => m[1])),
  );
  const previewBody = varNames.reduce(
    (txt, n) => txt.replace(new RegExp(`{{\\s*${n}\\s*}}`, "g"), examples[n] || `{{${n}}}`),
    bodyText,
  );

  // Toolbar formatting: balut teks terpilih (atau "teks") dengan simbol WhatsApp.
  function wrapSelection(sym: string) {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = bodyText.slice(s, e) || "teks";
    setBodyText(bodyText.slice(0, s) + sym + sel + sym + bodyText.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + sym.length, s + sym.length + sel.length);
    });
  }

  function insertVariable() {
    const ta = bodyRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const token = "{{nama}}";
    setBodyText(bodyText.slice(0, s) + token + bodyText.slice(ta.selectionEnd));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + 2, s + 6); // pilih "nama"
    });
  }

  // Butang: had Meta — maks 10 butang, maks 2 URL, maks 1 telefon.
  const urlCount = buttons.filter((b) => b.type === "URL").length;
  const phoneCount = buttons.filter((b) => b.type === "PHONE_NUMBER").length;
  function addButton() {
    if (buttons.length >= 10) return;
    // Pilih jenis default yang masih ada baki kuota.
    const type: ButtonType = urlCount < 2 ? "URL" : phoneCount < 1 ? "PHONE_NUMBER" : "QUICK_REPLY";
    setButtons((b) => [...b, { type, text: "", value: "" }]);
  }
  function updateButton(i: number, patch: Partial<TplButton>) {
    setButtons((b) => b.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeButton(i: number) {
    setButtons((b) => b.filter((_, idx) => idx !== i));
  }

  function resetForm() {
    setName("");
    setBodyText("");
    setExamples({});
    setHeaderType("none");
    setHeaderText("");
    setHeaderImage(null);
    setFooterText("");
    setButtons([]);
  }

  async function submitCreate() {
    setCreateMsg("");
    if (!name.trim() || !bodyText.trim()) {
      setCreateMsg("Nama & isi (body) wajib.");
      return;
    }
    // Sahkan butang: teks wajib; URL/telefon wajib ada nilai.
    const cleanButtons = buttons
      .map((b) => ({ ...b, text: b.text.trim(), value: b.value.trim() }))
      .filter((b) => b.text);
    const badBtn = cleanButtons.find((b) => (b.type === "URL" || b.type === "PHONE_NUMBER") && !b.value);
    if (badBtn) {
      setCreateMsg(`❌ Butang "${badBtn.text}" perlu ${badBtn.type === "URL" ? "URL" : "nombor telefon"}.`);
      return;
    }
    setCreating(true);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("category", category);
    fd.append("language", language);
    fd.append("headerType", headerType);
    fd.append("headerText", headerText);
    fd.append("bodyText", bodyText);
    fd.append("variables", JSON.stringify(varNames.map((n) => ({ name: n, example: examples[n] || "" }))));
    fd.append("footerText", footerText);
    fd.append("buttons", JSON.stringify(cleanButtons));
    if (headerType === "image" && headerImage) fd.append("headerImage", headerImage);
    if (phoneId) fd.append("phoneId", phoneId);

    const res = await fetch("/api/whatsapp/create-template", { method: "POST", body: fd });
    const j = await res.json();
    setCreating(false);
    if (res.ok && j.ok) {
      setCreateMsg(`✅ Template "${j.name}" dihantar untuk audit (status: ${j.status || "PENDING"}). Tunggu kelulusan Meta.`);
      resetForm();
      load();
    } else {
      setCreateMsg("❌ " + (j.error || "Gagal cipta template."));
    }
  }

  const toolbarBtn = "p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors";

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Template WhatsApp</h1>
          <p className="text-sm text-gray-500">
            {templates.length} template · {count("APPROVED")} diluluskan
            {count("PENDING") > 0 && ` · ${count("PENDING")} menunggu`}
            {count("REJECTED") > 0 && ` · ${count("REJECTED")} ditolak`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {waNumbers.length > 1 && (
            <select
              value={phoneId}
              onChange={(e) => setPhoneId(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm text-gray-700"
              title="Template adalah per-WABA. Pilih nombor untuk lihat/cipta template WABA-nya."
            >
              <option value="">Nombor utama</option>
              {waNumbers.map((n) => <option key={n.phone_number_id} value={n.phone_number_id}>{n.display_name}</option>)}
            </select>
          )}
          <button onClick={() => setShowCreate(true)} className="bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium">
            + Cipta Template
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-400">Memuat…</div>}
      {err && <div className="text-sm text-red-500">{err}</div>}

      {!loading && !err && (
        <>
          {insightsNote && <div className="text-xs text-amber-600">{insightsNote}</div>}
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Nama</th>
                  <th className="text-left px-3 py-2">Kategori</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Dihantar</th>
                  <th className="text-right px-3 py-2">Dibaca</th>
                  <th className="text-right px-3 py-2">Read rate</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => {
                  const m = insights[t.name];
                  const rate = m && m.delivered > 0 ? Math.round((m.read / m.delivered) * 100) : null;
                  return (
                    <tr
                      key={`${t.name}-${t.language}`}
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => setPreview(t)}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800">{t.name}</td>
                      <td className="px-3 py-2 text-gray-500">{t.category}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[11px] rounded-full px-2 py-0.5 ${STATUS_STYLE[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{m ? m.sent.toLocaleString() : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{m ? m.read.toLocaleString() : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">{rate !== null ? `${rate}%` : "—"}</td>
                      <td className="px-3 py-2 text-right text-xs text-emerald-600 whitespace-nowrap">Lihat</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400">Prestasi: 30 hari lepas, dari Meta. Klik baris untuk preview.</p>
        </>
      )}

      {/* Modal preview template (gaya gelembung WhatsApp) */}
      {preview && (() => {
        const header = preview.components.find((c) => c.type === "HEADER");
        const footer = preview.components.find((c) => c.type === "FOOTER");
        const buttons = preview.components.find((c) => c.type === "BUTTONS")?.buttons ?? [];
        const m = insights[preview.name];
        const rate = m && m.delivered > 0 ? Math.round((m.read / m.delivered) * 100) : null;
        const pHeaderType: "none" | "text" | "image" = header?.format === "TEXT" ? "text" : header?.format ? "image" : "none";
        return (
          <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={() => setPreview(null)}>
            <div className="bg-white rounded-xl p-5 w-full max-w-md mx-auto my-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-gray-800">{preview.name}</h2>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="text-xs text-gray-500">{preview.category} · {preview.language} · {preview.status}</div>

              <WhatsAppBubble
                headerType={pHeaderType}
                headerText={header?.text}
                body={bodyOf(preview)}
                footer={footer?.text}
                buttons={buttons.map((b) => ({ text: b.text ?? "", type: b.type }))}
              />

              {/* Prestasi 30 hari */}
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Prestasi · 30 hari</div>
                {m ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border p-2">
                      <div className="text-lg font-semibold text-gray-800 tabular-nums">{m.sent.toLocaleString()}</div>
                      <div className="text-[11px] text-gray-400">Dihantar</div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-lg font-semibold text-gray-800 tabular-nums">{m.read.toLocaleString()}</div>
                      <div className="text-[11px] text-gray-400">Dibaca</div>
                    </div>
                    <div className="rounded-lg border p-2">
                      <div className="text-lg font-semibold text-gray-800 tabular-nums">{rate !== null ? `${rate}%` : "—"}</div>
                      <div className="text-[11px] text-gray-400">Read rate</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">Tiada data (belum dihantar dalam 30 hari, atau prestasi belum aktif).</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal cipta template — 2 lajur: borang + preview WhatsApp hidup (gaya Meta) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl w-full max-w-4xl mx-auto my-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-3.5 border-b">
              <h2 className="font-semibold text-gray-800">Cipta Template Baru</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid md:grid-cols-2">
              {/* ── Lajur borang ── */}
              <div className="p-5 space-y-3 order-2 md:order-1 max-h-[75vh] md:max-h-[70vh] overflow-y-auto">
                {waNumbers.length > 1 && (
                  <p className="text-xs text-gray-500">
                    Untuk: <b>{phoneId ? (waNumbers.find((n) => n.phone_number_id === phoneId)?.display_name ?? "—") : "Nombor utama"}</b>
                    {" "}— template dicipta di WABA nombor ini.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Nama (huruf kecil, _)</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="promo_ceri_jun" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Kategori</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="MARKETING">Marketing</option>
                      <option value="UTILITY">Utility</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Bahasa</label>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="ms">Melayu (ms)</option>
                      <option value="en_US">English (en_US)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Header</label>
                    <select value={headerType} onChange={(e) => setHeaderType(e.target.value as "none" | "text" | "image")} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="none">Tiada</option>
                      <option value="text">Teks</option>
                      <option value="image">Gambar</option>
                    </select>
                  </div>
                </div>

                {headerType === "text" && (
                  <input value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="Teks header" className="w-full border rounded-lg px-3 py-2 text-sm" />
                )}
                {headerType === "image" && (
                  <div>
                    <label className="text-xs text-gray-500">Gambar header (contoh untuk audit)</label>
                    <input type="file" accept="image/*" onChange={(e) => setHeaderImage(e.target.files?.[0] ?? null)} className="w-full text-sm" />
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Isi mesej (body)</label>
                    {/* Toolbar formatting gaya WhatsApp */}
                    <div className="flex items-center gap-0.5">
                      <button type="button" title="Tebal (*teks*)" onClick={() => wrapSelection("*")} className={toolbarBtn}><Bold className="w-4 h-4" /></button>
                      <button type="button" title="Condong (_teks_)" onClick={() => wrapSelection("_")} className={toolbarBtn}><Italic className="w-4 h-4" /></button>
                      <button type="button" title="Coret (~teks~)" onClick={() => wrapSelection("~")} className={toolbarBtn}><Strikethrough className="w-4 h-4" /></button>
                      <button type="button" title="Monospace (```teks```)" onClick={() => wrapSelection("```")} className={toolbarBtn}><Code className="w-4 h-4" /></button>
                      <span className="w-px h-4 bg-gray-200 mx-0.5" />
                      <button type="button" title="Sisip pemboleh ubah {{nama}}" onClick={insertVariable} className={toolbarBtn}><Braces className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <textarea ref={bodyRef} value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={6} placeholder="Hai {{nama}}, promo ceri sekarang RM45! …" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <p className="text-[11px] text-gray-400 mt-1">Guna <b>*tebal*</b>, <i>_condong_</i>, <span className="line-through">~coret~</span>. {"{{nama}}"} = pemboleh ubah.</p>
                </div>

                {varNames.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Contoh nilai (wajib untuk audit Meta)</label>
                    {varNames.map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-28 truncate">{`{{${n}}}`}</span>
                        <input
                          value={examples[n] || ""}
                          onChange={(e) => setExamples((p) => ({ ...p, [n]: e.target.value }))}
                          placeholder="contoh nilai"
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Footer (optional)" className="w-full border rounded-lg px-3 py-2 text-sm" />

                {/* Butang — boleh tambah beberapa (maks 10; 2 URL, 1 telefon, selebihnya balas pantas) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">Butang (optional)</label>
                    <button
                      type="button"
                      onClick={addButton}
                      disabled={buttons.length >= 10}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah butang
                    </button>
                  </div>
                  {buttons.map((b, i) => {
                    // Elak lebih kuota: sekat pilihan jenis yang dah penuh (kecuali jenis semasa baris ni).
                    const urlFull = urlCount >= 2 && b.type !== "URL";
                    const phoneFull = phoneCount >= 1 && b.type !== "PHONE_NUMBER";
                    return (
                      <div key={i} className="border rounded-lg p-2 space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <select
                            value={b.type}
                            onChange={(e) => updateButton(i, { type: e.target.value as ButtonType, value: "" })}
                            className="border rounded-lg px-2 py-1.5 text-sm bg-white"
                          >
                            <option value="URL" disabled={urlFull}>{BUTTON_TYPE_LABEL.URL}</option>
                            <option value="PHONE_NUMBER" disabled={phoneFull}>{BUTTON_TYPE_LABEL.PHONE_NUMBER}</option>
                            <option value="QUICK_REPLY">{BUTTON_TYPE_LABEL.QUICK_REPLY}</option>
                          </select>
                          <input
                            value={b.text}
                            onChange={(e) => updateButton(i, { text: e.target.value })}
                            placeholder="Teks butang"
                            maxLength={25}
                            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                          />
                          <button type="button" onClick={() => removeButton(i)} className="p-1.5 text-gray-400 hover:text-red-500" title="Buang butang">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {b.type === "URL" && (
                          <input value={b.value} onChange={(e) => updateButton(i, { value: e.target.value })} placeholder="https://shop.syababfresh.my/…" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                        )}
                        {b.type === "PHONE_NUMBER" && (
                          <input value={b.value} onChange={(e) => updateButton(i, { value: e.target.value })} placeholder="+60123456789" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                        )}
                      </div>
                    );
                  })}
                  {buttons.length > 0 && (
                    <p className="text-[11px] text-gray-400">WhatsApp papar 3 butang dulu; lebih dari itu jadi senarai. Had Meta: 2 URL, 1 telefon.</p>
                  )}
                </div>

                {createMsg && <div className="text-sm text-gray-700">{createMsg}</div>}
                <button onClick={submitCreate} disabled={creating} className="w-full bg-emerald-500 text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
                  {creating ? "Menghantar…" : "Hantar untuk audit Meta"}
                </button>
                <p className="text-[11px] text-gray-400">Selepas hantar, Meta akan audit (biasanya beberapa minit–jam). Status akan jadi APPROVED/REJECTED dalam senarai.</p>
              </div>

              {/* ── Lajur preview WhatsApp (hidup) ── */}
              <div className="p-5 bg-gray-50 md:border-l order-1 md:order-2">
                <div className="md:sticky md:top-0">
                  <div className="text-xs font-semibold text-gray-500 mb-2">Preview WhatsApp</div>
                  <WhatsAppBubble
                    headerType={headerType}
                    headerText={headerText}
                    headerImageUrl={headerImageUrl}
                    body={previewBody}
                    footer={footerText}
                    buttons={buttons.map((b) => ({ text: b.text, type: b.type }))}
                  />
                  <p className="text-[11px] text-gray-400 mt-2">Ini anggaran rupa mesej di telefon pelanggan. Nilai contoh diganti masuk pemboleh ubah.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

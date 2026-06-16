"use client";

import { useCallback, useEffect, useState } from "react";

interface Template {
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{ type: string; text?: string; format?: string }>;
}

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  REJECTED: "bg-red-50 text-red-700",
  PAUSED: "bg-gray-100 text-gray-600",
  DISABLED: "bg-gray-100 text-gray-600",
};

export function TemplatesClient() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Borang cipta
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("ms");
  const [headerType, setHeaderType] = useState<"none" | "text" | "image">("none");
  const [headerText, setHeaderText] = useState("");
  const [headerImage, setHeaderImage] = useState<File | null>(null);
  const [bodyText, setBodyText] = useState("");
  const [examples, setExamples] = useState<Record<string, string>>({});
  const [footerText, setFooterText] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const load = useCallback(() => {
    fetch("/api/whatsapp/templates?all=1")
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
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const count = (s: string) => templates.filter((t) => t.status === s).length;
  const bodyOf = (t: Template) => t.components.find((c) => c.type === "BODY")?.text ?? "";
  const varNames = Array.from(
    new Set(Array.from(bodyText.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map((m) => m[1])),
  );
  const previewBody = varNames.reduce(
    (txt, n) => txt.replace(new RegExp(`{{\\s*${n}\\s*}}`, "g"), examples[n] || `{{${n}}}`),
    bodyText,
  );

  async function submitCreate() {
    setCreateMsg("");
    if (!name.trim() || !bodyText.trim()) {
      setCreateMsg("Nama & isi (body) wajib.");
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
    fd.append("buttonText", buttonText);
    fd.append("buttonUrl", buttonUrl);
    if (headerType === "image" && headerImage) fd.append("headerImage", headerImage);

    const res = await fetch("/api/whatsapp/create-template", { method: "POST", body: fd });
    const j = await res.json();
    setCreating(false);
    if (res.ok && j.ok) {
      setCreateMsg(`✅ Template "${j.name}" dihantar untuk audit (status: ${j.status || "PENDING"}). Tunggu kelulusan Meta.`);
      setName("");
      setBodyText("");
      setExamples({});
      setHeaderText("");
      setHeaderImage(null);
      setFooterText("");
      setButtonText("");
      setButtonUrl("");
      load();
    } else {
      setCreateMsg("❌ " + (j.error || "Gagal cipta template."));
    }
  }

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
        <button onClick={() => setShowCreate(true)} className="bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium">
          + Cipta Template
        </button>
      </div>

      {loading && <div className="text-sm text-gray-400">Memuat…</div>}
      {err && <div className="text-sm text-red-500">{err}</div>}

      {!loading && !err && (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Nama</th>
                <th className="text-left px-3 py-2">Bahasa</th>
                <th className="text-left px-3 py-2">Kategori</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Isi (ringkas)</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={`${t.name}-${t.language}`} className="border-t">
                  <td className="px-3 py-2 font-medium text-gray-800">{t.name}</td>
                  <td className="px-3 py-2 text-gray-500">{t.language}</td>
                  <td className="px-3 py-2 text-gray-500">{t.category}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] rounded-full px-2 py-0.5 ${STATUS_STYLE[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs max-w-md truncate">{bodyOf(t).slice(0, 80)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal cipta template */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-lg mx-auto my-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Cipta Template Baru</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400">✕</button>
            </div>

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
              <label className="text-xs text-gray-500">Isi mesej (body) — guna {"{{nama}}"} untuk pemboleh ubah</label>
              <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} placeholder="Hai {{nama}}, promo ceri sekarang RM45! …" className="w-full border rounded-lg px-3 py-2 text-sm" />
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

            {/* Preview ringkas */}
            <div className="bg-emerald-50 rounded-lg p-3 text-sm border">
              <div className="text-[10px] text-gray-400 mb-1">📱 Preview</div>
              {headerType === "text" && headerText && <div className="font-semibold">{headerText}</div>}
              {headerType === "image" && <div className="text-xs text-gray-400 mb-1">🖼️ [gambar header]</div>}
              <div className="whitespace-pre-wrap">{previewBody || <span className="text-gray-300">…isi mesej…</span>}</div>
              {footerText && <div className="text-[11px] text-gray-400 mt-1">{footerText}</div>}
              {buttonText && <div className="text-xs text-blue-500 mt-1 text-center border-t pt-1">🔗 {buttonText}</div>}
            </div>

            <input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Footer (optional)" className="w-full border rounded-lg px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={buttonText} onChange={(e) => setButtonText(e.target.value)} placeholder="Teks butang (optional)" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="URL butang" className="border rounded-lg px-3 py-2 text-sm" />
            </div>

            {createMsg && <div className="text-sm text-gray-700">{createMsg}</div>}
            <button onClick={submitCreate} disabled={creating} className="w-full bg-emerald-500 text-white rounded-lg py-2.5 font-medium disabled:opacity-50">
              {creating ? "Menghantar…" : "Hantar untuk audit Meta"}
            </button>
            <p className="text-[11px] text-gray-400">Selepas hantar, Meta akan audit (biasanya beberapa minit–jam). Status akan jadi APPROVED/REJECTED dalam senarai.</p>
          </div>
        </div>
      )}
    </div>
  );
}

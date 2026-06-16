"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
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

  const count = (s: string) => templates.filter((t) => t.status === s).length;
  const bodyOf = (t: Template) => t.components.find((c) => c.type === "BODY")?.text ?? "";

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
        <a
          href="https://business.facebook.com/wa/manage/message-templates/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          + Cipta di WhatsApp Manager ↗
        </a>
      </div>

      <div className="text-xs text-gray-500 bg-blue-50 rounded-lg p-3">
        💡 Template baru dicipta di <b>Meta WhatsApp Manager</b> (rasmi, sokong gambar/butang) → Meta audit → bila
        diluluskan, ia terus muncul di sini & boleh guna dalam Blast/Inbox.
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
              {templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                    Tiada template.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

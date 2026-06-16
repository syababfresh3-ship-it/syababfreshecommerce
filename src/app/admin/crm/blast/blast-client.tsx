"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Template {
  name: string;
  language: string;
  category: string;
  components: Array<{ type: string; text?: string; format?: string }>;
}
interface Blast {
  id: string;
  name: string;
  template_name: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  created_at: string;
}

export function BlastClient() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [headerImage, setHeaderImage] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState<"contacts" | "customers">("contacts");
  const [tag, setTag] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [blasts, setBlasts] = useState<Blast[]>([]);

  const loadBlasts = useCallback(async () => {
    const res = await fetch("/api/whatsapp/blast");
    const j = await res.json();
    if (j.blasts) setBlasts(j.blasts);
  }, []);

  useEffect(() => {
    fetch("/api/whatsapp/templates")
      .then((r) => r.json())
      .then((j) => j.templates && setTemplates(j.templates));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBlasts();
  }, [loadBlasts]);

  // Kira bilangan penerima
  const computeCount = useCallback(async () => {
    if (source === "contacts") {
      let q = supabase.from("wa_contacts").select("*", { count: "exact", head: true }).eq("opt_out", false);
      if (tag.trim()) q = q.contains("tags", [tag.trim()]);
      const { count: c } = await q;
      setCount(c ?? 0);
    } else {
      const { count: c } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("phone", "is", null)
        .eq("is_admin", false);
      setCount(c ?? 0);
    }
  }, [supabase, source, tag]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    computeCount();
  }, [computeCount]);

  function pickTemplate(t: Template) {
    setTpl(t);
    const bodyText = t.components.find((c) => c.type === "BODY")?.text ?? "";
    const names = Array.from(bodyText.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map((m) => m[1]);
    const obj: Record<string, string> = {};
    names.forEach((n) => (obj[n] = ""));
    setParams(obj);
    setHeaderImage("");
  }

  const needsHeaderImage = tpl?.components.some((c) => c.type === "HEADER" && c.format === "IMAGE") ?? false;

  async function send(test: boolean) {
    if (!tpl) {
      setMsg("Pilih template dulu.");
      return;
    }
    if (test && !testNumber.trim()) {
      setMsg("Masukkan nombor test.");
      return;
    }
    if (needsHeaderImage && !headerImage.trim()) {
      setMsg("Template ini ada gambar header — masukkan URL gambar dulu.");
      return;
    }
    if (!test) {
      const ok = window.confirm(
        `Hantar blast "${tpl.name}" ke ${count ?? "?"} penerima (${source})? Tindakan ini menghantar mesej sebenar.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setMsg(test ? "Menghantar test…" : "Menghantar blast… (jangan tutup halaman)");
    const res = await fetch("/api/whatsapp/blast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        templateName: tpl.name,
        templateLang: tpl.language,
        params,
        audience: { source, tag: tag.trim() || undefined },
        test,
        testNumber: test ? testNumber.trim() : undefined,
        headerImage: needsHeaderImage ? headerImage.trim() : undefined,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg("❌ " + (j.error || "Gagal."));
      return;
    }
    if (test) {
      setMsg(j.failed ? `❌ Test gagal: ${j.error || "tidak diketahui"}` : "✅ Test berjaya — sampai ke telefon!");
    } else {
      setMsg(`✅ Blast siap — ${j.sent} berjaya, ${j.failed} gagal (dari ${j.total}).`);
      loadBlasts();
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">Blast WhatsApp (rasmi)</h1>

      <div className="bg-white rounded-lg border p-4 space-y-4">
        {/* Nama kempen */}
        <div>
          <label className="text-sm text-gray-600">Nama kempen</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth: Promo Ceri Uzbek Jun"
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>

        {/* Template */}
        <div>
          <label className="text-sm text-gray-600">Template diluluskan</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            value={tpl?.name ?? ""}
            onChange={(e) => {
              const t = templates.find((x) => x.name === e.target.value);
              if (t) pickTemplate(t);
            }}
          >
            <option value="">— pilih template —</option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
        </div>

        {/* Params */}
        {tpl && Object.keys(params).length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500">
              Isi nilai param. <b>nama</b> boleh dibiar kosong — auto-isi nama penerima.
            </div>
            {Object.keys(params).map((k) => (
              <div key={k}>
                <label className="text-xs text-gray-500">{k}</label>
                <input
                  value={params[k]}
                  onChange={(e) => setParams((p) => ({ ...p, [k]: e.target.value }))}
                  placeholder={k === "nama" || k === "name" ? "(auto nama penerima)" : k}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* Gambar header (template promo dgn IMAGE header) */}
        {tpl && needsHeaderImage && (
          <div>
            <label className="text-sm text-gray-600">🖼️ Gambar header (URL) — template ini perlukan gambar</label>
            <input
              value={headerImage}
              onChange={(e) => setHeaderImage(e.target.value)}
              placeholder="https://… (URL gambar public, cth Cloudinary)"
              className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
        )}

        {/* Audiens */}
        <div>
          <label className="text-sm text-gray-600">Audiens</label>
          <div className="flex gap-3 mt-1 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={source === "contacts"} onChange={() => setSource("contacts")} />
              Dah mesej kami (contacts)
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={source === "customers"} onChange={() => setSource("customers")} />
              Customer berdaftar
            </label>
          </div>
          {source === "contacts" && (
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="tapis ikut tag (kosong = semua)"
              className="w-full border rounded-lg px-3 py-1.5 text-sm mt-2"
            />
          )}
          <div className="text-sm text-emerald-600 mt-2">
            📊 Anggaran penerima: <b>{count ?? "…"}</b> (opt-out dikecualikan)
          </div>
        </div>

        {/* Test */}
        <div className="border-t pt-3">
          <label className="text-sm text-gray-600">Test dulu (hantar ke 1 nombor)</label>
          <div className="flex gap-2 mt-1">
            <input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="cth 60123456789"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={() => send(true)}
              disabled={busy}
              className="bg-gray-100 hover:bg-gray-200 rounded-lg px-4 text-sm disabled:opacity-50"
            >
              Hantar Test
            </button>
          </div>
        </div>

        {/* Hantar */}
        <div className="border-t pt-3">
          <button
            onClick={() => send(false)}
            disabled={busy || !tpl}
            className="w-full bg-emerald-500 text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
          >
            {busy ? "Memproses…" : `🚀 Hantar Blast ke ${count ?? "?"} penerima`}
          </button>
          {msg && <div className="text-sm mt-2 text-gray-700">{msg}</div>}
        </div>
      </div>

      {/* Sejarah kempen */}
      <div className="bg-white rounded-lg border p-4">
        <div className="text-sm font-semibold text-gray-800 mb-2">Sejarah kempen</div>
        {blasts.length === 0 && <div className="text-sm text-gray-400">Belum ada kempen.</div>}
        <div className="space-y-1">
          {blasts.map((b) => (
            <div key={b.id} className="flex justify-between text-sm border-b py-1.5">
              <span className="text-gray-700">{b.name}</span>
              <span className="text-gray-500">
                {b.sent}/{b.total} ✓ {b.failed > 0 && <span className="text-red-500">{b.failed} ✗</span>} · {b.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

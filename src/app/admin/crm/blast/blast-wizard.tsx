"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Template {
  name: string;
  language: string;
  category: string;
  components: Array<{ type: string; text?: string; format?: string }>;
}
interface PastBlast { id: string; name: string; total: number }
type AudType = "contacts" | "csv" | "paste" | "past";
interface CsvRow { phone: string; name?: string; vars: Record<string, string> }

// Parse CSV ringkas: kesan lajur phone + nama; lajur lain → merge fields.
// Kalau baris pertama nampak macam nombor (bukan header), anggap tiada header.
function parseCSV(text: string): { cols: string[]; rows: CsvRow[] } {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { cols: [], rows: [] };
  const split = (l: string) => l.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  const first = split(lines[0]);
  const noHeader = /^\+?\d[\d\s-]{6,}$/.test(first[0] ?? "");
  const header = noHeader ? first.map((_, i) => (i === 0 ? "phone" : `col${i}`)) : first;
  const lower = header.map((h) => h.toLowerCase());
  const phoneIdx = Math.max(0, lower.findIndex((h) => /phone|tel|^no|nombor|hp|wa/.test(h)));
  const nameIdx = lower.findIndex((h) => /nama|name/.test(h));
  const dataLines = noHeader ? lines : lines.slice(1);
  const rows: CsvRow[] = [];
  for (const l of dataLines) {
    const cells = split(l);
    const phone = cells[phoneIdx];
    if (!phone) continue;
    const vars: Record<string, string> = {};
    header.forEach((h, idx) => { if (idx !== phoneIdx && idx !== nameIdx && cells[idx]) vars[h] = cells[idx]; });
    rows.push({ phone, name: nameIdx >= 0 ? cells[nameIdx] : undefined, vars });
  }
  return { cols: header, rows };
}

const stepLabels = ["Recipients", "Template & mesej", "Review & send"];

export function BlastWizard() {
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");

  // Audience
  const [audType, setAudType] = useState<AudType>("contacts");
  const [tagList, setTagList] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recentDays, setRecentDays] = useState("");
  const [previewContacts, setPreviewContacts] = useState<{ wa_id: string; name: string | null; tags: string[] }[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewCapped, setPreviewCapped] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [pasteText, setPasteText] = useState("");
  const [csv, setCsv] = useState<{ cols: string[]; rows: CsvRow[]; fileName: string } | null>(null);
  const [excludeBlasted, setExcludeBlasted] = useState(false); // jangan hantar pada yang dah pernah di-blast
  const [excludeBlastedDays, setExcludeBlastedDays] = useState(""); // cooldown: kosong = selamanya, N = N hari terakhir sahaja
  const [pastList, setPastList] = useState<PastBlast[]>([]);
  const [pastId, setPastId] = useState("");

  // Template
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [headerImage, setHeaderImage] = useState("");

  // Send
  const [testNumber, setTestNumber] = useState("");
  const [waNumbers, setWaNumbers] = useState<{ phone_number_id: string; display_name: string; is_default: boolean }[]>([]);
  const [fromNumber, setFromNumber] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/whatsapp/blast").then((r) => r.json()).then((j) =>
      setPastList((j.blasts ?? []).map((b: { id: string; name: string; total: number }) => ({ id: b.id, name: b.name, total: b.total }))),
    );
    supabase.from("crm_tags").select("name").order("name").then(({ data }: { data: { name: string }[] | null }) => setTagList((data ?? []).map((t) => t.name)));
    supabase.from("wa_numbers").select("phone_number_id, display_name, is_default").eq("is_active", true).order("created_at")
      .then(({ data }: { data: { phone_number_id: string; display_name: string; is_default: boolean }[] | null }) => {
        setWaNumbers(data ?? []);
        const def = (data ?? []).find((n) => n.is_default) ?? (data ?? [])[0];
        if (def) setFromNumber(def.phone_number_id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Template per-WABA: muat semula senarai template ikut nombor 'hantar dari'.
  // Nombor #2 (Syabab Fresh ll) ada set template tersendiri di WABA-nya.
  useEffect(() => {
    const url = fromNumber
      ? `/api/whatsapp/templates?phoneId=${encodeURIComponent(fromNumber)}`
      : "/api/whatsapp/templates";
    fetch(url).then((r) => r.json()).then((j) => setTemplates(j.templates ?? []));
    setTpl(null); // reset pilihan — template beza antara WABA
  }, [fromNumber]);

  const toggleTag = (t: string) => setSelectedTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  const toggleExclude = (wa: string) => setExcluded((p) => { const n = new Set(p); if (n.has(wa)) n.delete(wa); else n.add(wa); return n; });

  const pasteNumbers = useMemo(
    () => pasteText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
    [pasteText],
  );

  // Preview 'contacts' — guna endpoint preview (resolver SAMA dgn hantar sebenar).
  useEffect(() => {
    if (audType !== "contacts") return;
    let cancelled = false;
    setPreviewLoading(true);
    fetch("/api/whatsapp/blast/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "contacts", tags: selectedTags, op: "any", recentDays: parseInt(recentDays, 10) || undefined, excludeBlasted, excludeBlastedDays: parseInt(excludeBlastedDays, 10) || undefined }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setPreviewContacts(j.contacts ?? []);
        setPreviewCount(j.count ?? 0);
        setPreviewCapped(!!j.capped);
        setExcluded(new Set()); // reset bila spec berubah
      })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [audType, selectedTags, recentDays, excludeBlasted, excludeBlastedDays]);

  const shownPreview = contactSearch.trim()
    ? previewContacts.filter((c) => (c.name ?? "").toLowerCase().includes(contactSearch.toLowerCase()) || c.wa_id.includes(contactSearch.replace(/\D/g, "")))
    : previewContacts.slice(0, 200);

  const count =
    audType === "contacts" ? Math.max(0, previewCount - excluded.size)
    : audType === "csv" ? csv?.rows.length ?? 0
    : audType === "paste" ? pasteNumbers.length
    : pastList.find((p) => p.id === pastId)?.total ?? 0;

  function buildAudience() {
    if (audType === "contacts") return { source: "contacts", tags: selectedTags, op: "any", recentDays: parseInt(recentDays, 10) || undefined, excludeWaIds: [...excluded], excludeBlasted, excludeBlastedDays: parseInt(excludeBlastedDays, 10) || undefined };
    if (audType === "csv") return { source: "csv", rows: csv?.rows ?? [] };
    if (audType === "paste") return { source: "paste", numbers: pasteNumbers };
    return { source: "past", pastBlastId: pastId };
  }

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
  const csvCols = csv?.cols ?? [];

  async function onCsvFile(file: File) {
    const text = await file.text();
    const parsed = parseCSV(text);
    setCsv({ ...parsed, fileName: file.name });
  }

  // Validasi setiap langkah
  const step1Ok = name.trim().length > 0 && count > 0;
  const step2Ok = !!tpl && (!needsHeaderImage || headerImage.trim().length > 0);

  async function send(test: boolean) {
    if (test && !testNumber.trim()) { setMsg("Masukkan nombor test."); return; }
    setBusy(true);
    setMsg(test ? "Menghantar test…" : "Menghantar blast… (jangan tutup halaman)");
    const res = await fetch("/api/whatsapp/blast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        templateName: tpl!.name,
        templateLang: tpl!.language,
        params,
        audience: buildAudience(),
        test,
        testNumber: test ? testNumber.trim() : undefined,
        headerImage: needsHeaderImage ? headerImage.trim() : undefined,
        phoneNumberId: fromNumber || undefined,
        scheduledAt: !test && scheduleMode === "later" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg("❌ " + (j.error || "Gagal.")); return; }
    if (test) { setMsg(j.failed ? `❌ Test gagal: ${j.error || "?"}` : "✅ Test sampai ke telefon!"); return; }
    if (j.scheduled) setMsg(`✅ Dijadualkan untuk ${new Date(j.scheduledAt).toLocaleString("ms-MY")} — drainer akan hantar bila tiba masa.`);
    else setMsg(`✅ Blast dimulakan — ${j.sent} dihantar, ${j.queued} dalam baris gilir (cron sambung).`);
    setDone(true);
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300";
  const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-5";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <Link href="/admin/crm/blast" className="text-sm text-gray-400 hover:text-gray-700">← Blaster</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">New Campaign</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {stepLabels.map((l, i) => {
          const n = i + 1;
          const active = step === n, doneStep = step > n;
          return (
            <div key={l} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${active ? "bg-emerald-500 text-white" : doneStep ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>{doneStep ? "✓" : n}</div>
              <span className={`text-xs font-semibold ${active ? "text-gray-900" : "text-gray-400"}`}>{l}</span>
              {n < 3 && <div className="flex-1 h-px bg-gray-100" />}
            </div>
          );
        })}
      </div>

      {/* STEP 1 — Recipients */}
      {step === 1 && (
        <div className={`${card} space-y-4`}>
          <div>
            <label className="text-sm font-semibold text-gray-600">Nama campaign</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Promo Ceri Uzbek Jun" className={`${inputCls} mt-1`} />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-2">Pilih audiens</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["contacts", "🔍 Filter contacts", "tag / aktif terkini"],
                ["csv", "📄 Upload CSV", "fail + merge fields"],
                ["paste", "📋 Paste numbers", "tampal senarai nombor"],
                ["past", "♻️ Past audience", "guna semula campaign"],
              ] as const).map(([t, label, sub]) => (
                <button key={t} type="button" onClick={() => setAudType(t)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${audType === t ? "border-emerald-400 bg-emerald-50" : "border-gray-100 hover:border-gray-200"}`}>
                  <p className="text-sm font-bold text-gray-800">{label}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Input ikut jenis audiens */}
          {audType === "contacts" && (
            <div className="space-y-3">
              {/* Chips tag (multi-select / union) */}
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setSelectedTags([])}
                  className={`text-xs font-semibold rounded-full px-3 py-1 ${selectedTags.length === 0 ? "bg-emerald-500 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>Semua</button>
                {tagList.map((t) => (
                  <button key={t} type="button" onClick={() => toggleTag(t)}
                    className={`text-xs font-semibold rounded-full px-3 py-1 ${selectedTags.includes(t) ? "bg-emerald-500 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>{t}</button>
                ))}
              </div>
              <input value={recentDays} onChange={(e) => setRecentDays(e.target.value.replace(/\D/g, ""))} placeholder="aktif dalam X hari (kosong = semua)" className={inputCls} />

              {/* Exclude yang dah pernah di-blast — elak hantar sama berulang (jimat kos) */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input type="checkbox" checked={excludeBlasted} onChange={(e) => setExcludeBlasted(e.target.checked)} />
                  <span>Buang yang <b>dah pernah di-blast</b> <span className="text-[11px] text-gray-400">(hantar pada yang baru sahaja)</span></span>
                </label>
                {excludeBlasted && (
                  <div className="flex items-center gap-2 pl-6">
                    <input value={excludeBlastedDays} onChange={(e) => setExcludeBlastedDays(e.target.value.replace(/\D/g, ""))}
                      placeholder="∞" className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center" />
                    <span className="text-[11px] text-gray-500">
                      kosong = <b>selamanya</b> · isi <b>X hari</b> = cooldown (lepas X hari, boleh blast balik)
                    </span>
                  </div>
                )}
              </div>

              {/* Preview + search + untick individu */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-2.5 py-2 border-b border-gray-100 flex items-center gap-2">
                  <input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="🔍 cari nama / no. untuk buang…" className="flex-1 text-sm focus:outline-none" />
                  <span className="text-[11px] text-gray-400">{previewLoading ? "…" : `${count}/${previewCount}`}</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                  {previewLoading ? (
                    <div className="p-4 text-center text-xs text-gray-400">Memuatkan…</div>
                  ) : shownPreview.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-400">{previewCount === 0 ? "Tiada kontak sepadan." : "Tiada padanan carian."}</div>
                  ) : shownPreview.map((c) => {
                    const inc = !excluded.has(c.wa_id);
                    return (
                      <label key={c.wa_id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={inc} onChange={() => toggleExclude(c.wa_id)} />
                        <span className={`flex-1 truncate ${inc ? "text-gray-800" : "text-gray-300 line-through"}`}>{c.name || c.wa_id}</span>
                        {c.tags.length > 0 && <span className="text-[10px] text-violet-400 shrink-0">{c.tags.join(", ")}</span>}
                      </label>
                    );
                  })}
                </div>
                {previewCapped && <div className="px-3 py-1.5 text-[10px] text-amber-500 text-center border-t border-gray-100">Papar 2000 pertama — guna search untuk cari nombor lain.</div>}
              </div>
            </div>
          )}
          {audType === "paste" && (
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5}
              placeholder="60123456789, 60198765432 … (satu baris atau dipisah koma)" className={`${inputCls} resize-none font-mono`} />
          )}
          {audType === "csv" && (
            <div className="space-y-2">
              <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvFile(f); }}
                className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm" />
              {csv && (
                <div className="text-xs text-gray-500">
                  <b>{csv.fileName}</b> · {csv.rows.length} baris · merge fields: {csvCols.filter((c) => !/phone|tel|^no|nombor|hp|wa|nama|name/i.test(c)).join(", ") || "tiada"}
                </div>
              )}
              <p className="text-[11px] text-gray-400">Lajur phone dikesan automatik. Lajur lain (cth kuantiti, produk) boleh diguna sebagai merge field dalam template.</p>
            </div>
          )}
          {audType === "past" && (
            <select value={pastId} onChange={(e) => setPastId(e.target.value)} className={inputCls}>
              <option value="">— pilih campaign lalu —</option>
              {pastList.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.total})</option>)}
            </select>
          )}

          <div className="text-sm text-emerald-600 font-semibold">📊 Penerima: {count} <span className="text-gray-400 font-normal">(opt-out dikecualikan masa hantar)</span></div>

          <div className="flex justify-end">
            <button disabled={!step1Ok} onClick={() => setStep(2)} className="bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      {/* STEP 2 — Template */}
      {step === 2 && (
        <div className={`${card} space-y-4`}>
          {waNumbers.length > 1 && (
            <div>
              <label className="text-sm font-semibold text-gray-600">Hantar dari nombor</label>
              <select className={`${inputCls} mt-1`} value={fromNumber} onChange={(e) => setFromNumber(e.target.value)}>
                {waNumbers.map((n) => <option key={n.phone_number_id} value={n.phone_number_id}>{n.display_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-gray-600">Template diluluskan</label>
            <select className={`${inputCls} mt-1`} value={tpl?.name ?? ""} onChange={(e) => { const t = templates.find((x) => x.name === e.target.value); if (t) pickTemplate(t); }}>
              <option value="">— pilih template —</option>
              {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.category})</option>)}
            </select>
            {templates.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Tiada template diluluskan untuk nombor ini. Cipta &amp; luluskan template di WhatsApp Manager untuk WABA nombor ini dulu.
              </p>
            )}
          </div>
          {tpl && Object.keys(params).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500"><b>nama</b> boleh kosong (auto nama penerima). {audType === "csv" && "Param yang sepadan nama lajur CSV akan diisi per-penerima."}</div>
              {Object.keys(params).map((k) => (
                <div key={k}>
                  <label className="text-xs text-gray-500">{k}{audType === "csv" && csvCols.includes(k) && <span className="text-emerald-500"> · auto dari CSV</span>}</label>
                  <input value={params[k]} onChange={(e) => setParams((p) => ({ ...p, [k]: e.target.value }))}
                    placeholder={k === "nama" || k === "name" ? "(auto nama penerima)" : k} className={inputCls} />
                </div>
              ))}
            </div>
          )}
          {tpl && needsHeaderImage && (
            <div>
              <label className="text-sm font-semibold text-gray-600">🖼️ Gambar header (URL)</label>
              <input value={headerImage} onChange={(e) => setHeaderImage(e.target.value)} placeholder="https://… (URL public)" className={`${inputCls} mt-1`} />
            </div>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 px-4 py-2.5">← Back</button>
            <button disabled={!step2Ok} onClick={() => setStep(3)} className="bg-gray-900 text-white rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}

      {/* STEP 3 — Review & send */}
      {step === 3 && (
        <div className={`${card} space-y-4`}>
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Campaign</span><span className="font-bold text-gray-800">{name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Template</span><span className="font-semibold">{tpl?.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Audiens</span><span className="font-semibold">{audType} · {count} penerima</span></div>
          </div>

          {!done && (
            <div className="border border-gray-100 rounded-xl p-3">
              <label className="text-xs font-semibold text-gray-500">Test dulu (1 nombor)</label>
              <div className="flex gap-2 mt-1">
                <input value={testNumber} onChange={(e) => setTestNumber(e.target.value)} placeholder="60123456789" className={inputCls} />
                <button onClick={() => send(true)} disabled={busy} className="bg-gray-100 hover:bg-gray-200 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">Test</button>
              </div>
            </div>
          )}

          {!done && (
            <div className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex gap-2">
                {(["now", "later"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setScheduleMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 ${scheduleMode === m ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-gray-100 text-gray-500"}`}>
                    {m === "now" ? "🚀 Hantar sekarang" : "🗓️ Jadual"}
                  </button>
                ))}
              </div>
              {scheduleMode === "later" && (
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
              )}
            </div>
          )}

          {done ? (
            <Link href="/admin/crm/blast" className="block text-center bg-emerald-500 text-white rounded-xl py-3 font-bold">→ Lihat progress di Blaster</Link>
          ) : (
            <button
              onClick={() => {
                if (scheduleMode === "later" && !scheduledAt) { setMsg("Pilih tarikh & masa jadual."); return; }
                const verb = scheduleMode === "later" ? "Jadualkan" : "Hantar";
                if (window.confirm(`${verb} blast "${name}" ke ${count} penerima? Mesej sebenar.`)) send(false);
              }}
              disabled={busy} className="w-full bg-emerald-500 text-white rounded-xl py-3 font-bold disabled:opacity-50">
              {busy ? "Memproses…" : scheduleMode === "later" ? `🗓️ Jadualkan ke ${count} penerima` : `🚀 Hantar ke ${count} penerima`}
            </button>
          )}

          {msg && <div className="text-sm text-gray-700">{msg}</div>}
          {!done && <button onClick={() => setStep(2)} className="text-sm text-gray-500">← Back</button>}
        </div>
      )}
    </div>
  );
}

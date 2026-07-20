"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Power, Cpu, MessageSquareText, BookOpen, Check, Loader2, BarChart3, FlaskConical } from "lucide-react";
import { AI_MODELS } from "@/lib/ai/models";

interface Initial {
  enabled: boolean;
  mode: string;
  model: string;
  knowledge: string;
  persona: string;
  followupEnabled: boolean;
  followupDelay: string;
  followupMessage: string;
}

const MODES: { key: string; label: string; desc: string }[] = [
  { key: "auto", label: "Auto", desc: "AI balas customer terus (untuk convo yang ditogol ON)." },
  { key: "faq", label: "FAQ", desc: "AI balas soalan biasa; di luar skop → serah team." },
  { key: "draft", label: "Draft", desc: "AI sedia draf; team sahkan & hantar (UI draf akan datang)." },
];

async function saveSetting(key: string, value: string): Promise<boolean> {
  const res = await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  return res.ok;
}

export function AiClient({ initial }: { initial: Initial }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [mode, setMode] = useState(initial.mode);
  const [model, setModel] = useState(initial.model);
  const [knowledge, setKnowledge] = useState(initial.knowledge);
  const [savingK, setSavingK] = useState(false);
  const [savedK, setSavedK] = useState(false);
  const [persona, setPersona] = useState(initial.persona);
  const [savingP, setSavingP] = useState(false);
  const [savedP, setSavedP] = useState(false);
  const [busy, setBusy] = useState("");
  // Auto follow-up (Senario A)
  const [fuEnabled, setFuEnabled] = useState(initial.followupEnabled);
  const [fuDelay, setFuDelay] = useState(initial.followupDelay);
  const [fuMsg, setFuMsg] = useState(initial.followupMessage);
  const [savingFu, setSavingFu] = useState(false);
  const [savedFu, setSavedFu] = useState(false);

  async function toggleFollowup() {
    const next = !fuEnabled;
    setFuEnabled(next);
    setBusy("fu");
    const ok = await saveSetting("auto_followup_enabled", next ? "true" : "false");
    if (!ok) setFuEnabled(!next);
    setBusy("");
  }
  async function saveFollowup() {
    setSavingFu(true);
    setSavedFu(false);
    const ok1 = await saveSetting("auto_followup_delay_hours", String(Number(fuDelay) || 4));
    const ok2 = await saveSetting("auto_followup_message", fuMsg);
    setSavingFu(false);
    if (ok1 && ok2) { setSavedFu(true); setTimeout(() => setSavedFu(false), 2000); }
  }

  async function toggleMaster() {
    const next = !enabled;
    setEnabled(next);
    setBusy("master");
    const ok = await saveSetting("ai_chatbot_enabled", next ? "true" : "false");
    if (!ok) setEnabled(!next);
    setBusy("");
  }
  async function pickModel(key: string) {
    setModel(key);
    setBusy("model");
    await saveSetting("ai_chatbot_model", key);
    setBusy("");
  }
  async function pickMode(key: string) {
    setMode(key);
    setBusy("mode");
    await saveSetting("ai_chatbot_mode", key);
    setBusy("");
  }
  async function saveKnowledge() {
    setSavingK(true);
    setSavedK(false);
    const ok = await saveSetting("ai_chatbot_knowledge", knowledge);
    setSavingK(false);
    if (ok) {
      setSavedK(true);
      setTimeout(() => setSavedK(false), 2000);
    }
  }
  async function savePersona() {
    setSavingP(true);
    setSavedP(false);
    const ok = await saveSetting("ai_chatbot_persona", persona);
    setSavingP(false);
    if (ok) {
      setSavedP(true);
      setTimeout(() => setSavedP(false), 2000);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-gray-700" />
          <h1 className="text-xl font-semibold text-gray-800">AI Chatbot</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/crm/ai/playground" className="text-sm text-gray-500 flex items-center gap-1">
            <FlaskConical className="h-3.5 w-3.5" /> Playground
          </Link>
          <Link href="/admin/crm/ai/analytics" className="text-sm text-gray-500 flex items-center gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </Link>
        </div>
      </div>
      <p className="text-sm text-gray-500">
        Auto-balas customer dalam Inbox WhatsApp. AI hanya balas untuk conversation yang ditogol ON
        (toggle &quot;AI auto-reply&quot; dalam inbox) — switch di bawah ialah suis induk.
      </p>

      {/* Master switch */}
      <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Power className={`h-5 w-5 mt-0.5 ${enabled ? "text-gray-800" : "text-gray-300"}`} />
          <div>
            <div className="font-medium text-gray-800">Suis induk</div>
            <div className="text-xs text-gray-500">
              {enabled ? "AI aktif — balas convo yang ditogol ON, dalam window 24j." : "AI dimatikan sepenuhnya."}
            </div>
          </div>
        </div>
        <button
          onClick={toggleMaster}
          disabled={busy === "master"}
          className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-gray-800" : "bg-gray-300"}`}
          aria-pressed={enabled}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      {/* Model */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-gray-500" />
          <div className="font-medium text-gray-800">Model</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(AI_MODELS).map((m) => (
            <button
              key={m.key}
              onClick={() => pickModel(m.key)}
              className={`rounded-lg border p-3 text-left ${model === m.key ? "border-gray-800 bg-gray-50" : "border-gray-200"}`}
            >
              <div className="text-sm font-medium text-gray-800 flex items-center gap-1">
                {m.label}
                {model === m.key && <Check className="h-3.5 w-3.5" />}
              </div>
              <div className="text-[11px] text-gray-400">
                ${m.inPer1M}/1M in · ${m.outPer1M}/1M out
              </div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">Model kedua jadi sandaran automatik kalau yang dipilih gagal.</p>
      </div>

      {/* Mode */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-gray-500" />
          <div className="font-medium text-gray-800">Mod balasan</div>
        </div>
        <div className="space-y-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => pickMode(m.key)}
              className={`w-full rounded-lg border p-3 text-left flex items-start gap-3 ${mode === m.key ? "border-gray-800 bg-gray-50" : "border-gray-200"}`}
            >
              <span className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${mode === m.key ? "border-gray-800" : "border-gray-300"}`}>
                {mode === m.key && <span className="h-2 w-2 rounded-full bg-gray-800" />}
              </span>
              <span>
                <span className="text-sm font-medium text-gray-800">{m.label}</span>
                <span className="block text-xs text-gray-500">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Persona / Identiti AI */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-gray-500" />
          <div className="font-medium text-gray-800">Persona &amp; identiti AI</div>
        </div>
        <p className="text-xs text-gray-500">
          Watak, nama &amp; gaya AI (cth &quot;Kak Syabab — jurujual peribadi premium, mesra, kenal pelanggan&quot;).
          Logik closing, format WhatsApp &amp; peraturan keselamatan kekal automatik — ini cuma untuk watak/nada.
        </p>
        <textarea
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          rows={8}
          placeholder={"Cth:\nNama: Kak Syabab\nGaya: Professional, warm, personal — macam personal shopper yang kenal pelanggan betul-betul.\nPangkat: Jurujual peribadi, bukan sekadar chatbot.\n\nSiapa pelanggan: golongan berduit, umur 29–60, hargakan masa lebih dari harga, ramai repeat customer."}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={savePersona}
            disabled={savingP}
            className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {savingP ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Simpan
          </button>
          {savedP && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Disimpan</span>}
        </div>
      </div>

      {/* Knowledge */}
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-500" />
          <div className="font-medium text-gray-800">Pengetahuan tambahan</div>
        </div>
        <p className="text-xs text-gray-500">
          Nota khusus untuk AI (cth promosi semasa, polisi terbaru). FAQ asas (penghantaran, bayaran)
          &amp; harga produk LIVE dah disertakan automatik — tak perlu tulis di sini.
        </p>
        <textarea
          value={knowledge}
          onChange={(e) => setKnowledge(e.target.value)}
          rows={5}
          placeholder="Cth: Promosi Jun — beli 2 durian free 1 mangga. Hari operasi Isnin–Sabtu 9am–6pm."
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={saveKnowledge}
            disabled={savingK}
            className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {savingK ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Simpan
          </button>
          {savedK && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Disimpan</span>}
        </div>
      </div>

      {/* ── Auto Follow-up (Senario A) ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-gray-700" />
            <div>
              <p className="text-sm font-bold text-gray-900">Auto Follow-up</p>
              <p className="text-[11px] text-gray-400">Nudge customer yang dah reply tapi senyap & belum beli (chat masih terbuka).</p>
            </div>
          </div>
          <button
            onClick={toggleFollowup}
            disabled={busy === "fu"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${fuEnabled ? "bg-emerald-500" : "bg-gray-300"} ${busy === "fu" ? "opacity-50" : ""}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fuEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600">Hantar selepas</label>
          <input
            type="number" min={1} max={23}
            value={fuDelay}
            onChange={(e) => setFuDelay(e.target.value)}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-gray-500">jam senyap (mesti &lt; 24 jam)</span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Ayat follow-up <span className="text-gray-400 font-normal">(guna <code>{"{name}"}</code> untuk nama)</span></label>
          <textarea
            value={fuMsg}
            onChange={(e) => setFuMsg(e.target.value)}
            rows={3}
            placeholder="Hi *{name}*! 👋 Masih berminat? Saya sedia bantu kalau ada soalan 🌿"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={saveFollowup}
            disabled={savingFu}
            className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {savingFu ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Simpan
          </button>
          {savedFu && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Disimpan</span>}
        </div>

        <p className="text-[11px] text-gray-400">
          Selamat: hanya hantar dalam window terbuka (free-form sah), sekali per perbualan,
          hormati opt-out, dan skip kalau customer dah buat order.
        </p>
      </div>

      <p className="text-[11px] text-gray-400">
        Guard automatik: AI hanya balas dalam window 24j, bukan customer opt-out, dan akan berhenti +
        serah ke team kalau customer minta bercakap dengan manusia.
      </p>
    </div>
  );
}

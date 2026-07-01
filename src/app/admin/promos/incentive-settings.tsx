"use client";

// Tetapan insentif — Welcome Voucher + Kad Setia. Simpan ke app_settings.
import { useState } from "react";
import { Gift, Award, Check, Loader2 } from "lucide-react";

interface Initial {
  wvEnabled: boolean; wvValue: string; wvMin: string;
  ksEnabled: boolean; ksTarget: string; ksReward: string;
}

async function saveSetting(key: string, value: string): Promise<boolean> {
  const res = await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  return res.ok;
}

function Toggle({ on, onClick, busy }: { on: boolean; onClick: () => void; busy: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${on ? "bg-emerald-500" : "bg-gray-300"} ${busy ? "opacity-50" : ""}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export function IncentiveSettings({ initial }: { initial: Initial }) {
  const [wvEnabled, setWvEnabled] = useState(initial.wvEnabled);
  const [wvValue, setWvValue] = useState(initial.wvValue);
  const [wvMin, setWvMin] = useState(initial.wvMin);
  const [ksEnabled, setKsEnabled] = useState(initial.ksEnabled);
  const [ksTarget, setKsTarget] = useState(initial.ksTarget);
  const [ksReward, setKsReward] = useState(initial.ksReward);
  const [busy, setBusy] = useState("");
  const [saved, setSaved] = useState("");

  async function toggle(key: string, next: boolean, set: (b: boolean) => void) {
    set(next); setBusy(key);
    const ok = await saveSetting(key, next ? "true" : "false");
    if (!ok) set(!next);
    setBusy("");
  }
  async function saveGroup(which: "wv" | "ks") {
    setBusy(which);
    if (which === "wv") {
      await saveSetting("welcome_voucher_value", String(Number(wvValue) || 5));
      await saveSetting("welcome_voucher_min", String(Number(wvMin) || 30));
    } else {
      await saveSetting("kad_setia_target", String(Number(ksTarget) || 9));
      await saveSetting("kad_setia_reward", String(Number(ksReward) || 15.9));
    }
    setBusy(""); setSaved(which); setTimeout(() => setSaved(""), 2000);
  }

  const inputCls = "w-24 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm";

  return (
    <div className="grid md:grid-cols-2 gap-3 mb-4">
      {/* Welcome Voucher */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#FDECEC] grid place-items-center"><Gift className="h-4 w-4 text-[#E11D2A]" /></div>
            <div>
              <p className="text-sm font-bold text-gray-900">Welcome Voucher</p>
              <p className="text-[11px] text-gray-400">Voucher untuk member baru (order pertama)</p>
            </div>
          </div>
          <Toggle on={wvEnabled} busy={busy === "welcome_voucher_enabled"} onClick={() => toggle("welcome_voucher_enabled", !wvEnabled, setWvEnabled)} />
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs font-semibold text-gray-600">Nilai (RM)
            <input type="number" min={1} value={wvValue} onChange={(e) => setWvValue(e.target.value)} className={`${inputCls} block mt-1`} />
          </label>
          <label className="text-xs font-semibold text-gray-600">Min belian (RM)
            <input type="number" min={0} value={wvMin} onChange={(e) => setWvMin(e.target.value)} className={`${inputCls} block mt-1`} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => saveGroup("wv")} disabled={busy === "wv"} className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
            {busy === "wv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Simpan
          </button>
          {saved === "wv" && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Disimpan</span>}
        </div>
        <p className="text-[11px] text-gray-400">Berkuat kuasa untuk voucher BARU. Yang dah diterbitkan kekal nilai lama.</p>
      </div>

      {/* Kad Setia */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-50 grid place-items-center"><Award className="h-4 w-4 text-amber-600" /></div>
            <div>
              <p className="text-sm font-bold text-gray-900">Kad Setia</p>
              <p className="text-[11px] text-gray-400">Beli N kali → voucher ganjaran</p>
            </div>
          </div>
          <Toggle on={ksEnabled} busy={busy === "kad_setia_enabled"} onClick={() => toggle("kad_setia_enabled", !ksEnabled, setKsEnabled)} />
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs font-semibold text-gray-600">Target (kali)
            <input type="number" min={2} max={20} value={ksTarget} onChange={(e) => setKsTarget(e.target.value)} className={`${inputCls} block mt-1`} />
          </label>
          <label className="text-xs font-semibold text-gray-600">Ganjaran (RM)
            <input type="number" min={1} step="0.01" value={ksReward} onChange={(e) => setKsReward(e.target.value)} className={`${inputCls} block mt-1`} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => saveGroup("ks")} disabled={busy === "ks"} className="bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
            {busy === "ks" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Simpan
          </button>
          {saved === "ks" && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Disimpan</span>}
        </div>
        <p className="text-[11px] text-gray-400">1 stamp/pembelian (dikira masa delivered). Capai target → auto voucher.</p>
      </div>
    </div>
  );
}

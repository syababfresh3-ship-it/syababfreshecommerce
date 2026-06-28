"use client";

// Redesign v2 — kad semak poskod (guna zon sebenar via /api/delivery/check).
import { useState } from "react";
import { MapPin } from "lucide-react";

interface Result {
  covered: boolean;
  fee?: number;
  area?: string;
  city?: string;
  state?: string;
}

export function SfPostcode() {
  const [pc, setPc] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    if (!/^\d{5}$/.test(pc)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/delivery/check?postcode=${pc}`).then((r) => r.json());
      setRes(r);
    } catch {
      setRes(null);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-[#FDECEC] grid place-items-center shrink-0">
          <MapPin className="h-5 w-5 text-[#E11D2A]" />
        </div>
        <div>
          <div className="text-[14px] font-extrabold text-gray-900 leading-tight">Semak Kawasan Penghantaran</div>
          <div className="text-[12px] font-medium text-gray-500">Masukkan poskod untuk lihat kos & slot</div>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={pc}
          onChange={(e) => setPc(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="cth: 47500"
          inputMode="numeric"
          className="flex-1 rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-3 text-[14px] font-medium text-gray-900 outline-none focus:border-[#E11D2A]"
        />
        <button
          onClick={check}
          disabled={busy || pc.length !== 5}
          className="rounded-xl bg-[#E11D2A] text-white font-bold px-6 text-[14px] disabled:opacity-50 shadow-[0_6px_16px_rgba(225,29,42,0.32)] active:scale-95 transition"
        >
          {busy ? "..." : "Semak"}
        </button>
      </div>
      {res && (
        res.covered ? (
          <div className="mt-3 rounded-xl bg-emerald-50 text-emerald-700 text-[12.5px] font-semibold px-3.5 py-2.5">
            ✅ {res.area || res.city || "Kawasan anda"} diliputi · penghantaran RM{Number(res.fee ?? 15).toFixed(2)} (hari sama)
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-[#FDECEC] text-[#E11D2A] text-[12.5px] font-semibold px-3.5 py-2.5">
            😔 Luar Klang Valley — kurier sejuk (Ninja Van Cold) 1–3 hari, kos ikut berat
          </div>
        )
      )}
    </div>
  );
}

"use client";

// Redesign v2 — Anggaran penghantaran di halaman produk (Sprint 3C). Nasihat
// sahaja: poskod tetap WAJIB & disahkan di Checkout/server. Kunci localStorage
// `sf_postcode` DIKONGSI dengan Troli/Checkout supaya pelanggan tak taip semula.
// Kos guna calcDeliveryFee (formula sama dengan troli/checkout) dengan harga
// produk × kuantiti sebagai subtotal; `frequency` zon dipapar sebagai anggaran
// tempoh bila ada (cth "Harian", "1-3 Hari Bekerja").
import { useCallback, useEffect, useState } from "react";
import { Truck, Check, AlertTriangle, Loader2, MapPin } from "lucide-react";
import { calcDeliveryFee } from "@/lib/delivery-fee";
import { FREE_DELIVERY_OFF, freeDeliveryActive } from "@/lib/shipping";

const PC_KEY = "sf_postcode"; // sama dengan sf-cart / checkout

type PcRes = {
  covered: boolean;
  fee?: number;
  area?: string;
  city?: string;
  state?: string;
  frequency?: string | null;
  error?: string;
};

function readSavedPostcode(): string {
  try {
    const v = localStorage.getItem(PC_KEY);
    return v && /^\d{5}$/.test(v) ? v : "";
  } catch {
    return "";
  }
}

export function SfDeliveryEstimate({
  subtotal,
  shippable,
  productName,
}: {
  subtotal: number; // harga unit × kuantiti (untuk peraturan percuma)
  shippable: boolean; // products.is_shippable — boleh dipos luar Lembah Klang
  productName: string;
}) {
  const [pc, setPc] = useState("");
  const [res, setRes] = useState<PcRes | null>(null);
  const [checkedPc, setCheckedPc] = useState("");
  const [busy, setBusy] = useState(false);
  const [freeMin, setFreeMin] = useState<number | null>(null); // null = belum dimuat

  const check = useCallback(
    async (code: string, needSettings: boolean) => {
      if (!/^\d{5}$/.test(code)) {
        setRes({ covered: false, error: "Poskod tidak sah — 5 digit" });
        return;
      }
      setBusy(true);
      try {
        const [r, s] = await Promise.all([
          fetch(`/api/delivery/check?postcode=${code}`).then((x) => x.json() as Promise<PcRes>),
          needSettings
            ? fetch("/api/settings/delivery").then((x) => x.json()).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (s?.free_delivery_min != null) setFreeMin(Number(s.free_delivery_min));
        setRes(r);
        setCheckedPc(code);
        if (!r.error) {
          try { localStorage.setItem(PC_KEY, code); } catch {}
        }
      } catch {
        setRes({ covered: false, error: "Gagal semak. Cuba lagi." });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Poskod tersimpan (dari troli/checkout/PDP lain) → semak automatik.
  useEffect(() => {
    const saved = readSavedPostcode();
    if (!saved) return;
    setPc(saved);
    check(saved, true);
  }, [check]);

  const ok = !!res && !res.error;
  const isKV = ok && res.covered === true;
  const knownArea = ok && !!res.area;
  const fee = isKV
    ? calcDeliveryFee({ subtotal, baseFee: Number(res?.fee ?? 0), freeMin: freeMin ?? FREE_DELIVERY_OFF })
    : 0;
  const freeActive = freeMin != null && freeDeliveryActive(freeMin);
  const place = res?.area && res?.city && res.city !== res.area ? `${res.area}, ${res.city}` : res?.area ?? res?.city ?? "";

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3" data-testid="delivery-estimate">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          check(pc, freeMin == null);
        }}
      >
        <label htmlFor="pdp-postcode" className="flex items-center gap-1.5 text-[12.5px] font-bold text-gray-900 shrink-0">
          <Truck className="h-4 w-4 text-gray-700" aria-hidden />
          Hantar ke poskod
        </label>
        <input
          id="pdp-postcode"
          name="postcode"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          autoComplete="postal-code"
          value={pc}
          onChange={(e) => setPc(e.target.value.replace(/\D/g, "").slice(0, 5))}
          placeholder="cth: 40150"
          aria-label="Poskod"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-[#F4F6F5] px-2.5 py-1.5 text-[13px] font-semibold text-gray-900 tracking-wide focus:outline-none focus:ring-2 focus:ring-gray-800"
        />
        <button
          type="submit"
          disabled={busy || pc.length !== 5}
          className="h-8 px-3 rounded-lg bg-gray-900 text-white text-[12px] font-bold disabled:opacity-40 grid place-items-center"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Menyemak" /> : "Semak"}
        </button>
      </form>

      {res?.error && <p className="mt-2 text-[12px] font-semibold text-gray-700">{res.error}</p>}

      {isKV && (
        <div className="mt-2 text-[12.5px] text-gray-700">
          <p className="flex items-start gap-1.5 font-semibold text-gray-900">
            <Check className="h-4 w-4 shrink-0 text-gray-700" aria-hidden />
            <span>
              Hantar ke {place || checkedPc} — {fee === 0 ? "Percuma" : `RM${fee.toFixed(2)}`}
              {res?.frequency ? ` · ${res.frequency}` : ""}
            </span>
          </p>
          {fee > 0 && freeActive && (
            <p className="mt-0.5 pl-[22px] text-[12px] text-gray-500">Percuma untuk pesanan RM{freeMin}+</p>
          )}
        </div>
      )}

      {ok && !isKV && (
        <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-gray-700">
          {shippable ? (
            <>
              <MapPin className="h-4 w-4 shrink-0 text-gray-700" aria-hidden />
              <span>
                {knownArea ? `${place}${res?.state ? `, ${res.state}` : ""} — ` : `Poskod ${checkedPc} — `}
                luar Lembah Klang · kurier {res?.frequency ? res.frequency.toLowerCase() : "1–3 hari"}, kos ikut berat (disahkan team)
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0 text-gray-700" aria-hidden />
              <span>
                Maaf, {productName} hanya dihantar dalam Lembah Klang.
                {knownArea ? ` Poskod ${checkedPc} (${place}) di luar kawasan.` : ` Poskod ${checkedPc} tiada dalam kawasan kami.`}
              </span>
            </>
          )}
        </p>
      )}

      {!res && !busy && (
        <p className="mt-2 text-[11.5px] text-gray-400">Semak kos & tempoh penghantaran ke kawasan anda.</p>
      )}
    </div>
  );
}

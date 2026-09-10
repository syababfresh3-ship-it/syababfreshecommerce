"use client";

// Bar kemajuan penghantaran percuma ("RM x lagi untuk penghantaran percuma").
// Sembunyi bila percuma dimatikan (sentinel FREE_DELIVERY_OFF) atau had sudah dicapai.
// Monokrom: teks kelabu, bar gray-800 atas trek gray-200, ikon line lucide.
import { Truck } from "lucide-react";
import { freeDeliveryActive } from "@/lib/shipping";

export function SfFreeDeliveryBar({
  subtotal,
  freeMin,
  className = "",
}: {
  subtotal: number;
  freeMin: number;
  className?: string;
}) {
  if (!freeDeliveryActive(freeMin) || subtotal >= freeMin) return null;
  const remaining = freeMin - subtotal;
  const pct = Math.max(0, Math.min(100, Math.round((subtotal / freeMin) * 100)));

  return (
    <div className={className} data-testid="free-delivery-bar">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-700">
        <Truck className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        <span>RM{remaining.toFixed(2)} lagi untuk penghantaran percuma</span>
      </p>
      <div
        className="mt-1.5 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden"
        role="progressbar"
        aria-label="Kemajuan ke penghantaran percuma"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full bg-gray-800 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

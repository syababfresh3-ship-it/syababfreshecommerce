"use client";

// Redesign v2 — butang Salin (pautan jejak / no. tracking).
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function SfCopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    }).catch(() => {});
  }

  return (
    <button
      onClick={copy}
      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-bold text-gray-600 active:scale-95 transition"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Disalin" : label}
    </button>
  );
}

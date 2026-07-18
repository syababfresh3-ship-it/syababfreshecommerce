"use client";

// Waitlist "Bagitahu bila ada" — muncul HANYA bila produk/variant habis stok.
// Guest isi nombor; member log masuk auto-guna nombor profil (satu tap).
import { useEffect, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { HoneypotField } from "@/components/honeypot-field";

export function SfWaitlist({ productId }: { productId: string }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState(""); // honeypot anti-bot
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Member login → prefill nombor & nama dari profil (kurangkan friction).
  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.auth.getUser() as Promise<any>).then(async (res) => {
      const user = res.data?.user;
      if (!user) return;
      const { data } = await supabase.from("profiles").select("phone, full_name").eq("id", user.id).maybeSingle();
      if (data?.phone) setPhone(data.phone);
      if (data?.full_name) setName(data.full_name);
    });
  }, []);

  // Dah pernah daftar untuk produk ni dalam sesi browser — jangan tanya lagi.
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(`wl_${productId}`)) setDone(true);
  }, [productId]);

  async function submit() {
    if (!phone.trim()) {
      toast.error("Isi no. telefon dulu");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/store/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, phone: phone.trim(), name: name.trim(), website }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(j.error ?? "Gagal daftar. Cuba lagi.");
        return;
      }
      localStorage.setItem(`wl_${productId}`, "1");
      setDone(true);
      toast.success("Siap! Kami maklum bila stok masuk 🍒");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-3">
        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-[12.5px] font-semibold text-emerald-700">
          Anda dalam senarai — kami maklum bila stok masuk
        </span>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-gray-900 py-3 text-[13.5px] font-bold text-gray-900 active:scale-[0.98] transition"
      >
        <Bell className="h-4 w-4" />
        Bagitahu saya bila ada semula
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 p-3.5 space-y-2.5">
      <HoneypotField value={website} onChange={setWebsite} />
      <p className="text-[12.5px] font-bold text-gray-900">Kami WhatsApp anda bila stok masuk:</p>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="No. telefon (cth 0123456789)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama (pilihan)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 text-white py-2.5 text-[13px] font-bold disabled:opacity-50"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Daftar
      </button>
    </div>
  );
}

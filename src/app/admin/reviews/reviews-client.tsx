"use client";

// Admin Ulasan — pantau ulasan produk yang masuk & buang ulasan tak sesuai
// (spam / kesat). Padam guna service role sebab RLS hanya benarkan penulis
// padam ulasan sendiri.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Star, Trash2 } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  products?: { name: string; slug: string; image_url: string | null } | null;
  profiles?: { full_name: string | null } | null;
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= n ? "fill-gray-800 text-gray-800" : "text-gray-300"}
        />
      ))}
    </span>
  );
}

export function ReviewsClient() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/reviews");
    const j = await res.json();
    setReviews(j.reviews ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => (filter === 0 ? reviews : reviews.filter((r) => r.rating === filter)),
    [reviews, filter],
  );

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";
  const lowCount = reviews.filter((r) => r.rating <= 2).length;

  async function remove(r: Review) {
    if (!window.confirm(`Padam ulasan ${r.rating}★ untuk "${r.products?.name ?? "produk"}"?\n\nTindakan ini kekal.`)) return;
    setDeleting(r.id);
    const res = await fetch(`/api/admin/reviews?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
    setDeleting(null);
    if (res.ok) setReviews((prev) => prev.filter((x) => x.id !== r.id));
    else window.alert("Gagal padam ulasan.");
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Star size={20} /> Ulasan Produk
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Pantau ulasan customer &amp; buang ulasan tak sesuai — rating ini juga jadi bintang dalam carian Google
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400">Jumlah ulasan</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{reviews.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400">Purata rating</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{avg}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400">Rating rendah (1–2★)</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{lowCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([0, 5, 4, 3, 2, 1] as const).map((n) => (
          <button
            key={n}
            onClick={() => setFilter(n)}
            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border ${
              filter === n
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {n === 0 ? "Semua" : `${n}★`}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuatkan…</div>
        ) : shown.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {reviews.length === 0
              ? "Belum ada ulasan. Customer boleh tulis ulasan di halaman produk selepas order delivered."
              : "Tiada ulasan untuk tapisan ini."}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {shown.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                {r.products?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.products.image_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gray-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {r.products?.name ?? "(produk dipadam)"}
                    </p>
                    <Stars n={r.rating} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {r.profiles?.full_name || "Tanpa nama"} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("ms-MY", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </p>
                  {r.comment && (
                    <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap break-words">{r.comment}</p>
                  )}
                </div>
                <button
                  onClick={() => remove(r)}
                  disabled={deleting === r.id}
                  title="Padam ulasan"
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                >
                  {deleting === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Padam
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Kos WhatsApp SEBENAR dari Meta (Graph API `pricing_analytics`). Server-only —
// guna WHATSAPP_TOKEN + WHATSAPP_WABA_ID (sama seperti whatsapp-cloud.ts).
//
// Meta beri kos ikut HARI + KATEGORI (MARKETING/UTILITY/SERVICE/AUTHENTICATION),
// mata wang WABA (MYR). PENTING: bukan per-campaign — Meta tak beritahu mesej
// itu milik blast yang mana. Jadi ia sesuai untuk JUMLAH kos sebenar dalam
// tempoh, bukan pecahan per-kempen (itu kekal anggaran di crm_blast_roas).

const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaWaCost {
  currency: string;
  start: number; // epoch saat
  end: number;
  total: number;
  marketing: number;
  utility: number;
  service: number;
  authentication: number;
  volume: number;
}

export async function fetchMetaWaCost(startSec: number, endSec: number): Promise<MetaWaCost> {
  const token = process.env.WHATSAPP_TOKEN;
  const waba = process.env.WHATSAPP_WABA_ID;
  if (!token || !waba) throw new Error("WHATSAPP_TOKEN / WHATSAPP_WABA_ID tidak ditetapkan dalam env.");

  const params = new URLSearchParams({
    start: String(startSec),
    end: String(endSec),
    granularity: "DAILY",
    metric_types: JSON.stringify(["COST", "VOLUME"]),
    dimensions: JSON.stringify(["PRICING_CATEGORY", "PRICING_TYPE"]),
  });

  const res = await fetch(`${GRAPH}/${waba}/pricing_analytics?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store", // kos berubah tiap hari — jangan cache
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Meta pricing_analytics gagal (${res.status})`);

  const agg = { total: 0, marketing: 0, utility: 0, service: 0, authentication: 0, volume: 0 };
  for (const series of json.data ?? []) {
    for (const p of series.data_points ?? []) {
      const c = Number(p.cost) || 0;
      const v = Number(p.volume) || 0;
      agg.total += c;
      agg.volume += v;
      switch (p.pricing_category) {
        case "MARKETING": agg.marketing += c; break;
        case "UTILITY": agg.utility += c; break;
        case "SERVICE": agg.service += c; break;
        case "AUTHENTICATION": agg.authentication += c; break;
      }
    }
  }
  return { currency: "MYR", start: startSec, end: endSec, ...agg };
}

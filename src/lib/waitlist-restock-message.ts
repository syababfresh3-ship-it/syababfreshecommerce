// ============================================================
// waitlist-restock-message — helper TULEN (tiada import server/env) untuk notis
// restock: teks e-mel lalai BM, render placeholder, & auto-map param template WA.
// Dikongsi oleh sheet admin (client) DAN lib/waitlist-restock.ts (server) supaya
// preview di sheet = apa yang dihantar.
// ============================================================

// Teks e-mel lalai. {nama} diganti nama penerima masa hantar (server).
// Nama produk & pautan diletak literal supaya staf boleh edit terus.
export function buildDefaultRestockMessage(productName: string, productUrl: string): string {
  return [
    `Salam {nama}! Khabar baik — ${productName} dah ada stok semula di SyababFresh.`,
    ``,
    `Stok terhad, dapatkan sebelum habis lagi:`,
    productUrl,
    ``,
    `Terima kasih kerana menunggu.`,
  ].join("\n");
}

// Ganti {nama} {produk} {link}. Nama kosong → "pelanggan" (selari drainer Blaster).
export function renderRestockMessage(
  tpl: string,
  vars: { nama?: string | null; produk?: string; link?: string },
): string {
  return tpl.replace(/\{(nama|produk|link)\}/g, (_, k: "nama" | "produk" | "link") => {
    const v = vars[k];
    if (v && String(v).trim()) return String(v);
    return k === "nama" ? "pelanggan" : "";
  });
}

// Nama param template WA ({{nama}}, {{1}} …) dari teks BODY — regex sama dgn wizard.
export function extractTemplateParams(bodyText: string): string[] {
  return Array.from(bodyText.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)).map((m) => m[1]);
}

// Klasifikasi kunci param. Keutamaan: link > produk > nama (cth "group_link" →
// link, "nama_produk" → produk, "customer_name" → nama).
export type ParamKind = "link" | "product" | "name" | "other";
export function classifyParamKey(key: string): ParamKind {
  if (/link|url|pautan/i.test(key)) return "link";
  if (/produk|product|item|barang/i.test(key)) return "product";
  if (/nama|name/i.test(key)) return "name";
  return "other";
}

// Auto-map param template ke nilai restock. Kunci nama → "" (diisi per penerima
// oleh vars/drainer). Kunci tak dikenali → "" (admin isi di sheet).
export function autoMapTemplateParams(
  keys: string[],
  ctx: { productName: string; productUrl: string },
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const kind = classifyParamKey(k);
    out[k] = kind === "product" ? ctx.productName : kind === "link" ? ctx.productUrl : "";
  }
  return out;
}

// Preview badan template dengan param diganti (untuk sheet). Nama → contoh.
export function previewTemplateBody(bodyText: string, params: Record<string, string>, sampleName = "Aisyah"): string {
  return bodyText.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k: string) => {
    const v = params[k]?.trim();
    if (v) return v;
    return classifyParamKey(k) === "name" ? sampleName : `{{${k}}}`;
  });
}

// ============================================================
// blast-params — isi parameter template WhatsApp untuk SEORANG penerima.
// Dikongsi drainer (blast sebenar) & POST blast (test), supaya tingkah laku sama.
//
// Peraturan:
//  1. vars CSV penerima menimpa params kempen (ikut kunci).
//  2. Token {nama} / {{nama}} / {name} / {lajur_csv} dalam mana-mana nilai diganti
//     nama penerima / nilai lajur CSV — cara guna nama dalam template POSITIONAL ({{1}}).
//  3. Nilai KOSONG untuk kunci nama / name / "1" (param pertama template positional)
//     → nama penerima, fallback "pelanggan". Meta tolak param kosong:
//     (#131008) Required parameter is missing — punca 239 gagal pada 18 Nov 2026.
// ============================================================

const NAME_KEYS = new Set(["nama", "name", "1"]);

export function fillTemplateParams(
  base: Record<string, string> | null | undefined,
  recipient: { name?: string | null; vars?: Record<string, string> | null },
  fallbackName = "pelanggan",
): Record<string, string> {
  const name = String(recipient.name ?? "").trim() || fallbackName;
  const vars = recipient.vars ?? {};
  const out: Record<string, string> = { ...(base ?? {}), ...vars };
  const tokens = new Map<string, string>(
    Object.entries({ nama: name, name, ...vars }).map(([k, v]) => [k.toLowerCase(), String(v ?? "")]),
  );
  for (const k of Object.keys(out)) {
    let v = String(out[k] ?? "");
    v = v.replace(/\{\{?\s*([a-z0-9_]+)\s*\}\}?/gi, (m, t: string) => {
      const hit = tokens.get(t.toLowerCase());
      return hit != null && hit.trim() ? hit : m;
    });
    if (!v.trim() && NAME_KEYS.has(k)) v = name;
    out[k] = v;
  }
  // Hantar HANYA kunci yang template ada (params kempen dijana dari placeholder template).
  // Lajur CSV tambahan (cth "gred") kekal sebagai token sahaja — kalau dihantar sebagai param lebih,
  // Meta tolak (#132000 bilangan param tak padan).
  const keys = Object.keys(base ?? {});
  return Object.fromEntries(keys.map((k) => [k, out[k] ?? ""]));
}

/** Kunci param yang masih kosong selepas diisi (selain kunci nama yang auto). */
export function emptyParamKeys(params: Record<string, string>): string[] {
  return Object.keys(params).filter((k) => !String(params[k] ?? "").trim() && !NAME_KEYS.has(k));
}

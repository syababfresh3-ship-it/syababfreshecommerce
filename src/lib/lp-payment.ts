// ============================================================
// lp-payment — kaedah bayaran yang dibenarkan untuk satu landing page.
//
// `payment_methods.is_active` bersifat SEJAGAT. `landing_pages.payment_methods`
// (migration 132) membenarkan satu LP mempunyai senarainya sendiri — cth buka
// COD untuk satu LP sahaja tanpa membukanya di seluruh kedai.
//
//   null / kosong → ikut tetapan sejagat (is_active), sama seperti dahulu
//   ada isi       → TEPAT senarai itu, mengatasi is_active
//
// Dipakai oleh /api/lp/payment-methods (paparan borang) DAN
// /api/lp/[slug]/order (pengesahan pelayan). Dua-dua guna fungsi yang sama
// supaya apa yang dipapar dan apa yang diterima tidak boleh terpisah.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface LpPaymentMethod {
  id: string;
  label: string;
  sublabel: string | null;
}

// Kolum belum wujud (migration 132 belum dijalankan) → anggap tiada senarai khas.
const MISSING = new Set(['42703', 'PGRST204', 'PGRST205', '42P01']);

export function isMissingColumn(err: { code?: string } | null | undefined): boolean {
  return !!err?.code && MISSING.has(err.code);
}

// Senarai khas LP (null = ikut sejagat). Tidak pernah melontar.
export async function lpPaymentOverride(sb: SB, slug: string): Promise<string[] | null> {
  const { data, error } = await sb
    .from('landing_pages')
    .select('payment_methods')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  const list = (data as { payment_methods?: unknown }).payment_methods;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.filter((v): v is string => typeof v === 'string' && !!v.trim());
}

// Kaedah yang boleh dipapar/diterima untuk LP ini, ikut susunan paparan.
export async function lpPaymentMethods(sb: SB, slug: string | null): Promise<LpPaymentMethod[]> {
  const { data: all } = await sb
    .from('payment_methods')
    .select('id, label, sublabel, is_active, sort_order')
    .order('sort_order');
  const rows = (all ?? []) as { id: string; label: string; sublabel: string | null; is_active: boolean }[];

  const override = slug ? await lpPaymentOverride(sb, slug) : null;
  if (!override) {
    return rows.filter(r => r.is_active).map(({ id, label, sublabel }) => ({ id, label, sublabel }));
  }
  // Susunan ikut senarai LP; id yang tiada dalam payment_methods diabaikan.
  const byId = new Map(rows.map(r => [r.id, r]));
  return override
    .map(id => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map(({ id, label, sublabel }) => ({ id, label, sublabel }));
}

// COD dari LP perlu kelulusan admin dahulu (elak order palsu — lihat migration 132).
export function lpOrderNeedsApproval(paymentMethod: string): boolean {
  return paymentMethod === 'cod';
}

// Bersihkan senarai kaedah bayaran dari borang admin: buang yang tidak wujud
// dalam katalog, buang pendua, kekalkan susunan. Array kosong → null (ikut
// tetapan sejagat). Dipakai oleh POST/PATCH /api/admin/landing-pages.
export async function sanitizePaymentMethodIds(sb: SB, value: unknown): Promise<string[] | null> {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const wanted = value.filter((v): v is string => typeof v === 'string' && !!v.trim()).map(v => v.trim());
  if (wanted.length === 0) return null;
  const { data } = await sb.from('payment_methods').select('id');
  const known = new Set(((data ?? []) as { id: string }[]).map(r => r.id));
  const out: string[] = [];
  for (const id of wanted) if (known.has(id) && !out.includes(id)) out.push(id);
  return out.length > 0 ? out : null;
}

// ============================================================
// blast-audience — resolver tunggal untuk audience Blaster.
// Spec deklaratif → senarai penerima. SATU sumber kebenaran: POST (hantar) &
// /api/whatsapp/blast/preview (count + senarai) guna fungsi yang SAMA → preview
// sentiasa padan dengan hantar sebenar. Tambah penapis masa depan = sambung di sini.
// ============================================================
import { formatWaPhone } from "@/lib/whatsapp-cloud";

export interface AudienceSpec {
  source?: string; // contacts | customers | paste | csv | past
  tag?: string; // legacy: tag tunggal (kekal serasi)
  tags?: string[]; // multi-tag
  op?: "any" | "all"; // operator tag (default any = union)
  recentDays?: number;
  numbers?: string[];
  rows?: { phone: string; name?: string; vars?: Record<string, string> }[];
  pastBlastId?: string;
  excludeWaIds?: string[];
  excludeBlasted?: boolean; // buang sesiapa yang pernah di-blast (mana-mana kempen)
  excludeBlastedDays?: number; // had: hanya yang di-blast dalam N hari (kosong = semua sejarah)
}

export interface Recipient {
  wa_id: string;
  name: string | null;
  vars?: Record<string, string>;
  tags?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

// Supabase cap 1000 baris/query — WAJIB paginate, kalau tak audiens senyap-senyap
// terpotong pada 1000 pertama (contacts sebenar 12k+). Order stabil disediakan caller.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  const CHUNK = 1000;
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await buildQuery(from, from + CHUNK - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < CHUNK) break;
  }
  return out;
}

export async function resolveAudience(sb: SB, spec: AudienceSpec): Promise<Recipient[]> {
  let recipients: Recipient[] = [];
  const tags = spec.tags && spec.tags.length ? spec.tags : spec.tag ? [spec.tag] : [];

  if (spec.source === "contacts") {
    const data = await fetchAll<{ wa_id: string; name: string | null; tags: string[] | null }>((from, to) => {
      let q = sb.from("wa_contacts").select("wa_id, name, tags, last_inbound_at").eq("opt_out", false);
      if (tags.length) q = spec.op === "all" ? q.contains("tags", tags) : q.overlaps("tags", tags);
      if (spec.recentDays && spec.recentDays > 0) {
        q = q.gte("last_inbound_at", new Date(Date.now() - spec.recentDays * 86_400_000).toISOString());
      }
      return q.order("id", { ascending: true }).range(from, to);
    });
    recipients = data.map((c) => ({ wa_id: c.wa_id, name: c.name, tags: c.tags ?? [] }));
  } else if (spec.source === "customers") {
    const profs = await fetchAll<{ full_name: string | null; phone: string }>((from, to) =>
      sb.from("profiles").select("full_name, phone").not("phone", "is", null).eq("is_admin", false)
        .order("id", { ascending: true }).range(from, to)
    );
    recipients = profs.map((p) => ({ wa_id: formatWaPhone(p.phone), name: p.full_name ?? null }));
  } else if (spec.source === "paste") {
    recipients = (spec.numbers ?? []).map((n) => ({ wa_id: formatWaPhone(n), name: null }));
  } else if (spec.source === "csv") {
    recipients = (spec.rows ?? []).map((r) => ({ wa_id: formatWaPhone(r.phone), name: r.name ?? null, vars: r.vars }));
  } else if (spec.source === "past") {
    if (!spec.pastBlastId) return [];
    const data = await fetchAll<{ wa_id: string; name: string | null }>((from, to) =>
      sb.from("crm_blast_recipients").select("wa_id, name").eq("blast_id", spec.pastBlastId)
        .order("id", { ascending: true }).range(from, to)
    );
    recipients = data.map((c) => ({ wa_id: c.wa_id, name: c.name }));
  } else {
    return [];
  }

  // Buang nombor tak sah + dedupe.
  const seen = new Set<string>();
  recipients = recipients.filter((r) => r.wa_id && r.wa_id.replace(/\D/g, "").length >= 8 && !seen.has(r.wa_id) && seen.add(r.wa_id));

  // Buang individu (excludeWaIds).
  if (spec.excludeWaIds && spec.excludeWaIds.length) {
    const ex = new Set(spec.excludeWaIds.map((w) => formatWaPhone(w)));
    recipients = recipients.filter((r) => !ex.has(r.wa_id));
  }

  // Suppression: opt_out kontak + senarai crm_suppressions.
  if (recipients.length) {
    const [opted, supp] = await Promise.all([
      fetchAll<{ wa_id: string }>((from, to) =>
        sb.from("wa_contacts").select("wa_id").eq("opt_out", true).order("id", { ascending: true }).range(from, to)),
      fetchAll<{ wa_id: string }>((from, to) =>
        sb.from("crm_suppressions").select("wa_id").order("wa_id", { ascending: true }).range(from, to)),
    ]);
    const blocked = new Set([...opted, ...supp].map((o) => o.wa_id));
    recipients = recipients.filter((r) => !blocked.has(r.wa_id));
  }

  // Exclude yang dah pernah di-blast (elak hantar sama berulang).
  // excludeBlastedDays → had ke N hari terakhir sahaja (kosong = semua sejarah).
  if (spec.excludeBlasted && recipients.length) {
    const since = spec.excludeBlastedDays && spec.excludeBlastedDays > 0
      ? new Date(Date.now() - spec.excludeBlastedDays * 86_400_000).toISOString()
      : null;
    const rows = await fetchAll<{ wa_id: string }>((from, to) => {
      let q = sb.from("crm_blast_recipients").select("wa_id").order("id", { ascending: true }).range(from, to);
      if (since) q = q.gte("created_at", since);
      return q;
    });
    const blasted = new Set(rows.map((r) => r.wa_id));
    recipients = recipients.filter((r) => !blasted.has(r.wa_id));
  }

  return recipients;
}

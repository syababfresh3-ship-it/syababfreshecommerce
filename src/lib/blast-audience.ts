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
}

export interface Recipient {
  wa_id: string;
  name: string | null;
  vars?: Record<string, string>;
  tags?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function resolveAudience(sb: SB, spec: AudienceSpec): Promise<Recipient[]> {
  let recipients: Recipient[] = [];
  const tags = spec.tags && spec.tags.length ? spec.tags : spec.tag ? [spec.tag] : [];

  if (spec.source === "contacts") {
    let q = sb.from("wa_contacts").select("wa_id, name, tags, last_inbound_at").eq("opt_out", false);
    if (tags.length) q = spec.op === "all" ? q.contains("tags", tags) : q.overlaps("tags", tags);
    if (spec.recentDays && spec.recentDays > 0) {
      q = q.gte("last_inbound_at", new Date(Date.now() - spec.recentDays * 86_400_000).toISOString());
    }
    const { data } = await q;
    recipients = (data ?? []).map((c: { wa_id: string; name: string | null; tags: string[] | null }) => ({
      wa_id: c.wa_id, name: c.name, tags: c.tags ?? [],
    }));
  } else if (spec.source === "customers") {
    const { data: profs } = await sb.from("profiles").select("full_name, phone").not("phone", "is", null).eq("is_admin", false);
    recipients = (profs ?? []).map((p: { full_name: string | null; phone: string }) => ({ wa_id: formatWaPhone(p.phone), name: p.full_name ?? null }));
  } else if (spec.source === "paste") {
    recipients = (spec.numbers ?? []).map((n) => ({ wa_id: formatWaPhone(n), name: null }));
  } else if (spec.source === "csv") {
    recipients = (spec.rows ?? []).map((r) => ({ wa_id: formatWaPhone(r.phone), name: r.name ?? null, vars: r.vars }));
  } else if (spec.source === "past") {
    if (!spec.pastBlastId) return [];
    const { data } = await sb.from("crm_blast_recipients").select("wa_id, name").eq("blast_id", spec.pastBlastId);
    recipients = (data ?? []).map((c: { wa_id: string; name: string | null }) => ({ wa_id: c.wa_id, name: c.name }));
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
    const [{ data: opted }, { data: supp }] = await Promise.all([
      sb.from("wa_contacts").select("wa_id").eq("opt_out", true),
      sb.from("crm_suppressions").select("wa_id"),
    ]);
    const blocked = new Set([...(opted ?? []), ...(supp ?? [])].map((o: { wa_id: string }) => o.wa_id));
    recipients = recipients.filter((r) => !blocked.has(r.wa_id));
  }

  return recipients;
}

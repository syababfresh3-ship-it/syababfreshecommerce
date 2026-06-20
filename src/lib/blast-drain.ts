// ============================================================
// blast-drain — proses kempen Blaster secara async (queue).
// Penerima 'pending' di-claim secara batch (atomik, SKIP LOCKED) → hantar template
// Cloud API → kemas status. Time-boxed: berhenti bila habis bajet masa; baki di-drain
// pusingan seterusnya (cron) atau reclaim kalau tersangkut.
// Dipanggil oleh: /api/cron/blast-drain (cron) & POST blast (send-now kick).
// ============================================================
import { sendTemplate } from "@/lib/whatsapp-cloud";
import { getSender } from "@/lib/wa-numbers";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ClaimRow { id: string; wa_id: string; name: string | null; vars: Record<string, string> | null }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function finalize(sb: SB, blastId: string) {
  const { data: rows } = await sb.from("crm_blast_recipients").select("status").eq("blast_id", blastId);
  const list = (rows ?? []) as { status: string }[];
  const left = list.filter((r) => r.status === "pending" || r.status === "sending").length;
  if (left > 0) return; // belum habis
  const sent = list.filter((r) => ["sent", "delivered", "read"].includes(r.status)).length;
  const failed = list.filter((r) => r.status === "failed").length;
  await sb.from("crm_blasts").update({ status: "sent", sent, failed }).eq("id", blastId);
}

export async function drainBlasts(sb: SB, opts: { budgetMs: number; blastId?: string }) {
  const deadline = Date.now() + opts.budgetMs;

  // Suppression terkini — hormati opt-out yang berlaku SELEPAS penerima di-queue
  // (penting untuk kempen berjadual). Dimuat sekali per pusingan drain.
  const [{ data: opted }, { data: supp }] = await Promise.all([
    sb.from("wa_contacts").select("wa_id").eq("opt_out", true),
    sb.from("crm_suppressions").select("wa_id"),
  ]);
  const blocked = new Set([...(opted ?? []), ...(supp ?? [])].map((o: { wa_id: string }) => o.wa_id));

  let q = sb
    .from("crm_blasts")
    .select("id, template_name, template_lang, params, header_image, status, scheduled_at, phone_number_id")
    .in("status", ["scheduled", "sending"])
    .order("scheduled_at", { ascending: true, nullsFirst: true });
  if (opts.blastId) q = q.eq("id", opts.blastId);
  const { data: blasts } = await q;

  const nowMs = Date.now();
  const due = (blasts ?? []).filter(
    (b: { scheduled_at: string | null }) => !b.scheduled_at || new Date(b.scheduled_at).getTime() <= nowMs,
  );

  let sentNow = 0;
  for (const b of due) {
    if (Date.now() > deadline) break;
    if (b.status === "scheduled") await sb.from("crm_blasts").update({ status: "sending" }).eq("id", b.id);

    // Multi-number: hantar dari nombor kempen (lalai = env default).
    const sender = await getSender(sb, b.phone_number_id);

    while (Date.now() <= deadline) {
      const { data: batch } = await sb.rpc("crm_blast_claim", { p_blast_id: b.id, p_limit: 40 });
      const rows = (batch ?? []) as ClaimRow[];
      if (rows.length === 0) { await finalize(sb, b.id); break; }

      for (const r of rows) {
        if (Date.now() > deadline) break; // baki kekal 'sending' → reclaim pusingan depan
        if (blocked.has(r.wa_id)) {
          await sb.from("crm_blast_recipients").update({ status: "failed", error: "opt_out", failed_at: new Date().toISOString() }).eq("id", r.id);
          continue;
        }
        const p: Record<string, string> = { ...(b.params ?? {}), ...(r.vars ?? {}) };
        for (const k of ["nama", "name"]) {
          if (k in p && (!p[k] || !String(p[k]).trim())) p[k] = r.name || "pelanggan";
        }
        const res = await sendTemplate(r.wa_id, b.template_name, b.template_lang || "ms", p, b.header_image || undefined, sender);
        await sb.from("crm_blast_recipients").update({
          status: res.ok ? "sent" : "failed",
          error: res.ok ? null : res.error,
          wa_message_id: res.id ?? null,
          sent_at: res.ok ? new Date().toISOString() : null,
          failed_at: res.ok ? null : new Date().toISOString(),
        }).eq("id", r.id);
        if (res.ok) sentNow++;
        await sleep(120); // ~8/saat — elak rate limit
      }
    }
  }
  return { sent: sentNow };
}

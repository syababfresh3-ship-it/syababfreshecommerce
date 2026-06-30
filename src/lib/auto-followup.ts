// ============================================================
// Auto follow-up (Senario A) — nudge customer yang chat TERBUKA (window 24j),
// senyap >= delay, needs_reply (kita tak balas), BELUM beli, tak opt-out.
// Free-form sah sebab window terbuka. Off-by-default. Sekali per stall.
// ============================================================
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp-cloud";
import { getSender } from "@/lib/wa-numbers";
import { renderTemplate } from "@/lib/wa-templates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, any, any>;

const PER_TICK = 20;
const SLEEP_MS = 120;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runAutoFollowup(sb: SB, opts: { budgetMs: number }) {
  const deadline = Date.now() + opts.budgetMs;

  // 1) Settings (off-by-default)
  const { data: rows } = await sb
    .from("app_settings")
    .select("key, value")
    .in("key", ["auto_followup_enabled", "auto_followup_delay_hours", "auto_followup_message", "auto_followup_daily_cap"]);
  const s: Record<string, string> = {};
  for (const r of rows ?? []) s[(r as { key: string }).key] = (r as { value: string }).value;
  if (s.auto_followup_enabled !== "true") return { skipped: "disabled", sent: 0, scanned: 0 };

  const delayHours = Number(s.auto_followup_delay_hours ?? "4") || 4;
  const message = s.auto_followup_message?.trim() || "Hi *{name}*! 👋 Masih berminat? Saya sedia bantu kalau ada soalan 🌿";
  const dailyCap = Number(s.auto_followup_daily_cap ?? "100") || 100;

  // 2) Suppression set (opt-out + crm_suppressions) — mirror blast-drain.
  const [{ data: opted }, { data: supp }] = await Promise.all([
    sb.from("wa_contacts").select("wa_id").eq("opt_out", true),
    sb.from("crm_suppressions").select("wa_id"),
  ]);
  const blocked = new Set([...(opted ?? []), ...(supp ?? [])].map((o: { wa_id: string }) => o.wa_id));

  // Cap harian: kira nudge yang dah dihantar hari ni (UTC).
  const startOfDay = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").toISOString();
  const { count: sentToday } = await sb
    .from("wa_conversations")
    .select("id", { count: "exact", head: true })
    .gte("auto_followup_sent_at", startOfDay);
  let remaining = Math.max(0, dailyCap - (sentToday ?? 0));
  if (remaining <= 0) return { skipped: "daily_cap", sent: 0, scanned: 0 };

  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - delayHours * 3600_000).toISOString();
  const sinceIso = new Date(Date.now() - 24 * 3600_000).toISOString();

  // 3) Calon: window terbuka + senyap + needs_reply + belum di-nudge + tak opt-out.
  const { data: convs } = await sb
    .from("wa_conversations")
    .select("id, contact_id, phone_number_id, wa_contacts!inner(wa_id, name, opt_out)")
    .gt("window_expires_at", nowIso)
    .lte("last_message_at", cutoffIso)
    .eq("needs_reply", true)
    .is("auto_followup_sent_at", null)
    .eq("wa_contacts.opt_out", false)
    .order("last_message_at", { ascending: true })
    .limit(PER_TICK);

  let sent = 0;
  const scanned = convs?.length ?? 0;

  for (const c of convs ?? []) {
    if (Date.now() > deadline || remaining <= 0) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contact = (c as any).wa_contacts as { wa_id: string; name: string | null; opt_out: boolean };
    if (!contact?.wa_id || blocked.has(contact.wa_id)) continue;

    // 4) Belum beli?
    const { data: hasOrder } = await sb.rpc("wa_has_recent_order", { p_wa_id: contact.wa_id, p_since: sinceIso });
    if (hasOrder === true) continue;

    // 5) Hantar nudge free-form (window terbuka)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sender = await getSender(sb, (c as any).phone_number_id);
    const body = renderTemplate(message, { name: contact.name || "pelanggan" });
    const res = await sendText(contact.wa_id, body, sender);
    if (!res.ok) continue;

    // 6) Log + tanda
    const now = new Date().toISOString();
    await sb.from("wa_messages").insert({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conversation_id: (c as any).id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contact_id: (c as any).contact_id,
      wa_message_id: res.id,
      direction: "out",
      type: "text",
      body,
      status: "sent",
      created_at: now,
    });
    await sb.from("wa_conversations").update({
      auto_followup_sent_at: now,
      last_message_at: now,
      last_message_preview: body,
      needs_reply: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).eq("id", (c as any).id);

    sent++; remaining--;
    await sleep(SLEEP_MS);
  }

  return { sent, scanned };
}

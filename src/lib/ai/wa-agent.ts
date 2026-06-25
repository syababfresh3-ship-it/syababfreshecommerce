// ============================================================
// lib/ai/wa-agent — otak chatbot WhatsApp: guard → AI → hantar/draft/escalate.
// maybeAiReply() dipanggil dari webhook (best-effort). SEMUA guard mesti lulus
// sebelum AI balas. OFF secara lalai (master switch + toggle per-customer).
// ============================================================
import { runAiChat, type ChatTurn } from "./chat";
import { buildWaSystemPrompt } from "./wa-knowledge";
import { WA_TOOLS, makeWaToolRunner } from "./wa-tools";
import { getSender } from "@/lib/wa-numbers";
import { sendText } from "@/lib/whatsapp-cloud";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

interface AiSettings {
  enabled: boolean;
  mode: string; // auto | draft | faq
  model: string; // gpt-4o-mini | claude-haiku
  knowledge: string;
}

async function readAiSettings(sb: SB): Promise<AiSettings> {
  const { data } = await sb
    .from("app_settings")
    .select("key, value")
    .in("key", ["ai_chatbot_enabled", "ai_chatbot_mode", "ai_chatbot_model", "ai_chatbot_knowledge"]);
  const m: Record<string, string> = {};
  for (const r of data ?? []) m[r.key] = r.value;
  return {
    enabled: m.ai_chatbot_enabled === "true",
    mode: m.ai_chatbot_mode || "auto",
    model: m.ai_chatbot_model || "gpt-4o-mini",
    knowledge: m.ai_chatbot_knowledge || "",
  };
}

// Customer minta bercakap dengan manusia → handoff (jangan biar AI teruskan).
const HUMAN_PATTERNS: RegExp[] = [
  /\bcakap\s+(dengan\s+)?(orang|manusia|admin|staff|cs|ejen|customer\s*service)/i,
  /\bnak\s+(orang|manusia|admin|cs|ejen)\b/i,
  /\b(real\s+person|human|agent|customer\s*service)\b/i,
  /\bspeak\s+to\s+(a\s+)?(human|agent|person|someone)\b/i,
];
function wantsHuman(t: string): boolean {
  return HUMAN_PATTERNS.some((re) => re.test(t));
}

interface LogRow {
  conversationId: string;
  contactId: string;
  model: string | null;
  outcome: string;
  preview: string;
  usage: { in: number; out: number };
  cost: number;
}
async function logAi(sb: SB, row: LogRow): Promise<void> {
  await sb
    .from("wa_ai_log")
    .insert({
      conversation_id: row.conversationId,
      contact_id: row.contactId,
      model: row.model,
      tokens_in: row.usage.in,
      tokens_out: row.usage.out,
      cost_usd: row.cost,
      outcome: row.outcome,
      inbound_preview: row.preview.slice(0, 300),
    })
    .then(
      () => {},
      () => {},
    );
}

// Serah ke manusia: matikan AI untuk convo ini + naikkan untuk team.
async function handoff(
  sb: SB,
  convId: string,
  contactId: string,
  outcome: "escalated" | "unanswered",
  text: string,
  result: { modelKey: string; usage: { in: number; out: number }; costUsd: number } | null,
): Promise<void> {
  await sb.from("wa_conversations").update({ ai_enabled: false, needs_reply: true }).eq("id", convId);
  await logAi(sb, {
    conversationId: convId,
    contactId,
    model: result?.modelKey ?? null,
    outcome,
    preview: text,
    usage: result?.usage ?? { in: 0, out: 0 },
    cost: result?.costUsd ?? 0,
  });
}

export interface MaybeAiReplyArgs {
  conversationId: string;
  contactId: string;
  inboundText: string | null;
  messageType: string;
  phoneNumberId?: string | null;
}

// Titik masuk dari webhook. Best-effort: pemanggil bungkus dengan try/catch.
export async function maybeAiReply(sb: SB, args: MaybeAiReplyArgs): Promise<void> {
  const text = (args.inboundText ?? "").trim();
  if (!text || args.messageType !== "text") return; // hanya mesej teks

  // GUARD 1 — master switch
  const s = await readAiSettings(sb);
  if (!s.enabled) return; // OFF → kelakuan asal (tiada apa berlaku)

  // GUARD 2 — conversation + toggle per-customer
  const { data: conv } = await sb
    .from("wa_conversations")
    .select(
      "id, ai_enabled, window_expires_at, phone_number_id, wa_contacts(wa_id, phone, name, opt_out, profile_id)",
    )
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv || !conv.ai_enabled) return; // toggle OFF
  const contact = conv.wa_contacts as {
    wa_id: string;
    phone: string | null;
    name: string | null;
    opt_out: boolean | null;
    profile_id: string | null;
  } | null;
  if (!contact?.wa_id || contact.opt_out) return; // tiada wa_id / opt-out

  // GUARD 3 — dalam tetingkap 24j (luar window: tak boleh hantar teks bebas)
  if (!conv.window_expires_at || new Date(conv.window_expires_at).getTime() <= Date.now()) return;

  // GUARD 4 — suppression list
  const { data: supp } = await sb.from("crm_suppressions").select("wa_id").eq("wa_id", contact.wa_id).maybeSingle();
  if (supp) return;

  // GUARD 5 — minta manusia → handoff (AI berhenti untuk convo ini)
  if (wantsHuman(text)) {
    await handoff(sb, conv.id, args.contactId, "escalated", text, null);
    return;
  }

  // Sejarah perbualan (10 mesej teks terakhir) — buang mesej semasa supaya tak ulang.
  const { data: rows } = await sb
    .from("wa_messages")
    .select("direction, body, type, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(13);
  const hist = (rows ?? [])
    .filter((r: { type: string; body: string | null }) => r.type === "text" && r.body)
    .reverse() as Array<{ direction: string; body: string }>;
  if (hist.length && hist[hist.length - 1].direction === "in" && hist[hist.length - 1].body.trim() === text) {
    hist.pop();
  }
  const history: ChatTurn[] = hist.slice(-10).map((r) => ({
    role: r.direction === "in" ? "user" : "assistant",
    content: r.body,
  }));

  // Jalankan AI (fallback model dikendali dalam runAiChat)
  const runTool = makeWaToolRunner(sb, {
    profileId: contact.profile_id,
    phone: contact.phone,
    waId: contact.wa_id,
    contactId: args.contactId,
    conversationId: conv.id,
    name: contact.name,
  });
  let result;
  try {
    result = await runAiChat({
      modelKey: s.model,
      system: buildWaSystemPrompt(s.knowledge),
      history,
      userMessage: text,
      tools: WA_TOOLS,
      runTool,
      maxTokens: 500,
    });
  } catch {
    await logAi(sb, {
      conversationId: conv.id,
      contactId: args.contactId,
      model: s.model,
      outcome: "error",
      preview: text,
      usage: { in: 0, out: 0 },
      cost: 0,
    });
    return;
  }

  const reply = (result.text || "").trim();
  if (!reply) {
    // AI tak dapat jawab → serah ke manusia (soalan tak terjawab)
    await handoff(sb, conv.id, args.contactId, "unanswered", text, result);
    return;
  }

  // Mod draft: UI draf = F4. Untuk F2 jangan hantar — cuma tag untuk team + log.
  if (s.mode === "draft") {
    await sb.from("wa_conversations").update({ needs_reply: true }).eq("id", conv.id);
    await logAi(sb, {
      conversationId: conv.id,
      contactId: args.contactId,
      model: result.modelKey,
      outcome: "replied",
      preview: text,
      usage: result.usage,
      cost: result.costUsd,
    });
    return;
  }

  // Mod auto / faq → hantar terus dari nombor yang customer hubungi.
  const sender = await getSender(sb, conv.phone_number_id);
  const send = await sendText(contact.wa_id, reply, sender);
  if (!send.ok) {
    await logAi(sb, {
      conversationId: conv.id,
      contactId: args.contactId,
      model: result.modelKey,
      outcome: "error",
      preview: text,
      usage: result.usage,
      cost: result.costUsd,
    });
    return;
  }

  const now = new Date().toISOString();
  await sb.from("wa_messages").insert({
    conversation_id: conv.id,
    contact_id: args.contactId,
    wa_message_id: send.id,
    direction: "out",
    type: "text",
    body: reply,
    status: "sent",
    ai_generated: true,
    ai_status: "sent",
    created_at: now,
  });
  await sb
    .from("wa_conversations")
    .update({ last_message_at: now, last_message_preview: reply, needs_reply: false })
    .eq("id", conv.id);
  await logAi(sb, {
    conversationId: conv.id,
    contactId: args.contactId,
    model: result.modelKey,
    outcome: "replied",
    preview: text,
    usage: result.usage,
    cost: result.costUsd,
  });
}

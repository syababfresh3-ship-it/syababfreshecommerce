// ============================================================
// wa-numbers — resolver nombor WhatsApp (multi-number).
// getSender: tukar conversation.phone_number_id → { phoneId, token } untuk
// hantar dari nombor yang BETUL. Lalai (null/tak dikenali) → guna env default.
// ============================================================
import type { SendOpts } from "@/lib/whatsapp-cloud";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

// Resolve pengirim untuk satu phone_number_id. Kembali {} bermakna guna env default
// (postMessage akan fallback ke WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).
export async function getSender(sb: SB, phoneNumberId?: string | null): Promise<SendOpts> {
  if (!phoneNumberId) return {};
  const { data } = await sb
    .from("wa_numbers")
    .select("phone_number_id, token, is_active")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (!data || data.is_active === false) return {}; // tak dikenali / nyahaktif → env default
  return { phoneId: data.phone_number_id as string, token: (data.token as string | null) || undefined };
}

// Cari pemilik (salesperson) bagi satu nombor — untuk auto-assign conversation.
export async function getNumberOwner(sb: SB, phoneNumberId?: string | null): Promise<string | null> {
  if (!phoneNumberId) return null;
  const { data } = await sb.from("wa_numbers").select("owner").eq("phone_number_id", phoneNumberId).maybeSingle();
  return (data?.owner as string | null) ?? null;
}

// ============================================================
// api/whatsapp/payment-link — jana link bayar CHIP + hantar via WhatsApp.
// Untuk close deal terus dalam chat (CRM). Admin only.
// Bayar → CHIP panggil /api/whatsapp/payment-callback → lead jadi Won.
// Guna semula corak CHIP sedia ada (checkout/chip). Additive.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp-cloud";
import { getSender } from "@/lib/wa-numbers";

const CHIP_API_URL = "https://gate.chip-in.asia/api/v1";

function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && !explicit.includes("localhost")) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return explicit ?? "https://shop.syababfresh.my";
}

export async function POST(req: NextRequest) {
  if (!process.env.CHIP_SECRET_KEY || !process.env.CHIP_BRAND_ID) {
    return NextResponse.json({ error: "CHIP belum dikonfigurasi." }, { status: 503 });
  }
  // Admin auth
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { contactId, amount, description } = (await req.json().catch(() => ({}))) as {
    contactId?: string;
    amount?: number;
    description?: string;
  };
  if (!contactId || !amount || amount <= 0) {
    return NextResponse.json({ error: "contactId & amount (>0) diperlukan." }, { status: 400 });
  }

  // Contact + lead + email
  const { data: contact } = await sb
    .from("wa_contacts")
    .select("id, wa_id, name, phone, profile_id, profiles(email, full_name)")
    .eq("id", contactId)
    .single();
  if (!contact) return NextResponse.json({ error: "Contact tidak dijumpai." }, { status: 404 });

  const { data: lead } = await sb.from("crm_leads").select("id").eq("contact_id", contactId).maybeSingle();
  const prof = contact.profiles as unknown as { email?: string; full_name?: string } | null;
  const email = prof?.email || `${contact.wa_id}@wa.syababfresh.my`;
  const fullName = prof?.full_name || contact.name || "Pelanggan";
  const desc = description?.trim() || "Pembayaran SyababFresh";

  // Cipta purchase CHIP
  const body = {
    client: { email, full_name: fullName },
    purchase: {
      currency: "MYR",
      products: [{ name: desc, price: Math.round(amount * 100), quantity: 1 }],
      notes: `CRM lead ${lead?.id ?? contactId}`,
    },
    brand_id: process.env.CHIP_BRAND_ID,
    reference: lead?.id ? `crmlead:${lead.id}` : `crmcontact:${contactId}`,
    success_callback: `${appUrl()}/api/whatsapp/payment-callback`,
    send_receipt: false,
  };

  const chipRes = await fetch(`${CHIP_API_URL}/purchases/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!chipRes.ok) {
    return NextResponse.json({ error: "CHIP gateway error", detail: chipRes.status }, { status: 502 });
  }
  const chip = await chipRes.json();
  if (!chip.checkout_url) return NextResponse.json({ error: "Tiada checkout_url dari CHIP." }, { status: 502 });

  // Simpan nilai lead (jangkaan) + purchase ref
  if (lead?.id) {
    await sb.from("crm_leads").update({ value: amount }).eq("id", lead.id);
  }

  // Hantar link via WhatsApp (dalam window 24j) — dari nombor yang customer
  // hubungi (window ada pada nombor itu, bukan env default).
  const msg = `Hai ${fullName}! 👋\n\nUntuk *${desc}* — jumlah *RM${amount.toFixed(2)}*.\n\nKlik untuk bayar selamat:\n${chip.checkout_url}\n\nTerima kasih! 🥭`;
  const { data: conv } = await sb
    .from("wa_conversations")
    .select("id, phone_number_id")
    .eq("contact_id", contactId)
    .maybeSingle();
  const sender = await getSender(sb, (conv as { phone_number_id?: string | null } | null)?.phone_number_id);
  const send = await sendText(contact.wa_id, msg, sender);

  // Log mesej keluar
  if (conv) {
    await sb.from("wa_messages").insert({
      conversation_id: conv.id,
      contact_id: contactId,
      wa_message_id: send.id,
      direction: "out",
      type: "text",
      body: msg,
      status: send.ok ? "sent" : "failed",
      sent_by: user.id,
    });
    await sb.from("wa_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: `💳 Link bayar RM${amount.toFixed(2)}` }).eq("id", conv.id);
  }

  if (!send.ok) {
    return NextResponse.json({ ok: false, checkoutUrl: chip.checkout_url, error: `Link dicipta tapi hantar WA gagal: ${send.error}` });
  }
  return NextResponse.json({ ok: true, checkoutUrl: chip.checkout_url });
}

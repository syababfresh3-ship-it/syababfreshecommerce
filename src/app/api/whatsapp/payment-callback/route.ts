// ============================================================
// api/whatsapp/payment-callback — CHIP panggil bila link bayar CRM dibayar.
// Verify status terus dari CHIP API (selamat), pastu tandakan lead Won.
// BERASINGAN dari /api/webhook/chip (order biasa) — tak disentuh.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CHIP_API_URL = "https://gate.chip-in.asia/api/v1";

export async function POST(req: NextRequest) {
  let evt: { id?: string };
  try {
    evt = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: true });
  }
  const purchaseId = evt?.id;
  if (!purchaseId || !process.env.CHIP_SECRET_KEY) return NextResponse.json({ ok: true });

  try {
    // Verify terus dari CHIP (jangan percaya body bulat-bulat)
    const res = await fetch(`${CHIP_API_URL}/purchases/${purchaseId}/`, {
      headers: { Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}` },
    });
    if (!res.ok) return NextResponse.json({ ok: true });
    const p = await res.json();
    if (p.status !== "paid") return NextResponse.json({ ok: true });

    const ref: string = p.reference || "";
    const sb = createAdminClient();
    let leadId: string | undefined;
    if (ref.startsWith("crmlead:")) {
      leadId = ref.slice("crmlead:".length);
    } else if (ref.startsWith("crmcontact:")) {
      const contactId = ref.slice("crmcontact:".length);
      const { data } = await sb.from("crm_leads").select("id").eq("contact_id", contactId).maybeSingle();
      leadId = data?.id;
    }
    if (leadId) {
      await sb.from("crm_leads").update({ stage: "won", won_at: new Date().toISOString() }).eq("id", leadId);
    }
  } catch (e) {
    console.error("[wa payment-callback]", e);
  }
  return NextResponse.json({ ok: true });
}

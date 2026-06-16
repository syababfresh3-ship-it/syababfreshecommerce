// ============================================================
// api/whatsapp/order-paylink — admin bina order (produk) untuk customer CRM,
// cipta order SEBENAR (lp_guest_orders) + CHIP pay link, hantar via WhatsApp.
// Bayar → /api/webhook/chip (flow order sedia ada) → masuk fulfillment.
// Link ke crm_lead (order_id + value). Additive — guna corak LP order.
// ============================================================
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp-cloud";

const CHIP_API_URL = "https://gate.chip-in.asia/api/v1";

function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && !explicit.includes("localhost")) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return explicit ?? "https://shop.syababfresh.my";
}

interface Item {
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
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
  const { data: prof } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!prof?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as {
    contactId?: string;
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    postcode?: string;
    notes?: string;
    delivery_fee?: number;
    discount?: number;
    items?: Item[];
  };

  if (!b.contactId) return NextResponse.json({ error: "contactId diperlukan." }, { status: 400 });
  if (!b.name?.trim()) return NextResponse.json({ error: "Nama diperlukan." }, { status: 400 });
  if (!b.phone?.trim()) return NextResponse.json({ error: "Telefon diperlukan." }, { status: 400 });
  if (!b.address?.trim()) return NextResponse.json({ error: "Alamat diperlukan." }, { status: 400 });
  if (!/^\d{5}$/.test(String(b.postcode ?? "").trim())) return NextResponse.json({ error: "Poskod 5 digit diperlukan." }, { status: 400 });
  if (!Array.isArray(b.items) || b.items.length === 0) return NextResponse.json({ error: "Sekurang-kurangnya 1 item." }, { status: 400 });

  const items = b.items;
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
  const deliveryFee = Number(b.delivery_fee ?? 0);
  const discount = Math.max(0, Number(b.discount ?? 0));
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const first = items[0];

  // Cipta order (lp_guest_orders) — status pending sehingga dibayar
  const { data: orderNumber } = await sb.rpc("generate_lp_order_number");
  const { data: order, error } = await sb
    .from("lp_guest_orders")
    .insert({
      order_number: orderNumber,
      page_id: null,
      name: b.name.trim(),
      phone: b.phone.trim(),
      email: b.email?.trim() || null,
      address: b.address.trim(),
      postcode: b.postcode?.trim() || null,
      notes: b.notes?.trim() || null,
      product_id: first.product_id,
      variant_id: first.variant_id,
      product_name: first.product_name,
      variant_name: first.variant_name,
      quantity: first.quantity,
      unit_price: first.unit_price,
      delivery_fee: deliveryFee,
      discount,
      total,
      payment_method: "fpx",
      source: "crm",
      items,
      status: "pending",
    })
    .select("id, order_number, total")
    .single();
  if (error || !order) return NextResponse.json({ error: error?.message || "Gagal cipta order." }, { status: 500 });

  // CHIP purchase → checkout_url (success_callback = webhook order sedia ada)
  // Ada diskaun → satu baris = total (elak baris negatif). Tiada → itemize.
  const products = discount > 0
    ? [{ name: `Pesanan ${order.order_number}`, price: Math.round(total * 100), quantity: 1 }]
    : items.map((i) => ({
        name: `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""}`,
        price: Math.round(Number(i.unit_price) * 100),
        quantity: i.quantity,
      }));
  if (discount === 0 && deliveryFee > 0) products.push({ name: "Kos Penghantaran", price: Math.round(deliveryFee * 100), quantity: 1 });

  const chipRes = await fetch(`${CHIP_API_URL}/purchases/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CHIP_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      client: { email: b.email?.trim() || `crm+${order.order_number}@syababfresh.my`, full_name: b.name.trim(), phone: b.phone.trim() },
      purchase: { currency: "MYR", products, notes: order.order_number },
      brand_id: process.env.CHIP_BRAND_ID,
      reference: order.id,
      success_callback: `${appUrl()}/api/webhook/chip`,
      send_receipt: false,
    }),
  });
  if (!chipRes.ok) return NextResponse.json({ error: "CHIP gateway error", detail: chipRes.status }, { status: 502 });
  const chip = await chipRes.json();
  if (!chip.checkout_url) return NextResponse.json({ error: "Tiada checkout_url." }, { status: 502 });
  if (chip.id) await sb.from("lp_guest_orders").update({ payment_ref: chip.id }).eq("id", order.id);

  // Kemas crm_lead — nilai deal + jadi "hangat" (order dibina, tunggu bayar)
  const { data: lead } = await sb.from("crm_leads").select("id").eq("contact_id", b.contactId).maybeSingle();
  if (lead?.id) await sb.from("crm_leads").update({ value: total, stage: "hangat" }).eq("id", lead.id);

  // Hantar pay link via WhatsApp
  const { data: contact } = await sb.from("wa_contacts").select("wa_id").eq("id", b.contactId).single();
  let sendOk = false;
  if (contact) {
    const lines = items.map((i) => `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""} x${i.quantity}`).join("\n");
    const msg = `Hai ${b.name.trim()}! 🥭\n\nPesanan anda *${order.order_number}*:\n${lines}\n${deliveryFee > 0 ? `Penghantaran: RM${deliveryFee.toFixed(2)}\n` : ""}${discount > 0 ? `Diskaun: -RM${discount.toFixed(2)}\n` : ""}*Jumlah: RM${total.toFixed(2)}*\n\nKlik untuk bayar selamat:\n${chip.checkout_url}\n\nTerima kasih! 🙏`;
    const send = await sendText(contact.wa_id, msg);
    sendOk = send.ok;
    const { data: conv } = await sb.from("wa_conversations").select("id").eq("contact_id", b.contactId).maybeSingle();
    if (conv) {
      await sb.from("wa_messages").insert({
        conversation_id: conv.id, contact_id: b.contactId, wa_message_id: send.id,
        direction: "out", type: "text", body: msg, status: send.ok ? "sent" : "failed", sent_by: user.id,
      });
      await sb.from("wa_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: `🛒 Order ${order.order_number} — RM${total.toFixed(2)}` }).eq("id", conv.id);
    }
  }

  return NextResponse.json({ ok: true, order_number: order.order_number, total, checkoutUrl: chip.checkout_url, sentWhatsApp: sendOk });
}

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
import { sendCapiPurchaseWhatsApp } from "@/lib/meta-capi";

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
    paymentMethod?: "paylink" | "cod";
    deliveryMethod?: "delivery" | "pickup";
    staff_name?: string;
  };

  const isCod = b.paymentMethod === "cod";
  const isPickup = b.deliveryMethod === "pickup";

  if (!b.contactId) return NextResponse.json({ error: "contactId diperlukan." }, { status: 400 });
  if (!b.name?.trim()) return NextResponse.json({ error: "Nama diperlukan." }, { status: 400 });
  if (!b.phone?.trim()) return NextResponse.json({ error: "Telefon diperlukan." }, { status: 400 });
  if (!isPickup) {
    if (!b.address?.trim()) return NextResponse.json({ error: "Alamat diperlukan (untuk delivery)." }, { status: 400 });
    if (!/^\d{5}$/.test(String(b.postcode ?? "").trim())) return NextResponse.json({ error: "Poskod 5 digit diperlukan." }, { status: 400 });
  }
  if (!Array.isArray(b.items) || b.items.length === 0) return NextResponse.json({ error: "Sekurang-kurangnya 1 item." }, { status: 400 });

  const items = b.items;
  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
  const deliveryFee = Number(b.delivery_fee ?? 0);
  const discount = Math.max(0, Number(b.discount ?? 0));
  const total = Math.max(0, subtotal + deliveryFee - discount);
  const first = items[0];

  // Snapshot CTWA click id contact (kalau ada) untuk attribution conversion Meta.
  const { data: ctwaContact } = await sb
    .from("wa_contacts").select("ctwa_clid").eq("id", b.contactId).maybeSingle();
  const ctwaClid = (ctwaContact as { ctwa_clid?: string | null } | null)?.ctwa_clid ?? null;

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
      address: isPickup ? (b.address?.trim() || "Pickup (ambil sendiri)") : b.address!.trim(),
      postcode: isPickup ? null : (b.postcode?.trim() || null),
      delivery_method: isPickup ? "pickup" : "delivery",
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
      payment_method: isCod ? "cod" : "fpx",
      source: b.staff_name?.trim() ? `whatsapp-${b.staff_name.trim()}` : "crm",
      items,
      status: isCod ? "confirmed" : "pending",
      ctwa_clid: ctwaClid,
    })
    .select("id, order_number, total, ctwa_clid, phone")
    .single();
  if (error || !order) return NextResponse.json({ error: error?.message || "Gagal cipta order." }, { status: 500 });

  // Kemas crm_lead — nilai deal + jadi "hangat"
  const { data: lead } = await sb.from("crm_leads").select("id").eq("contact_id", b.contactId).maybeSingle();
  if (lead?.id) await sb.from("crm_leads").update({ value: total, stage: "hangat" }).eq("id", lead.id);

  const lines = items.map((i) => `• ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""} x${i.quantity}`).join("\n");
  const totalsBlock = `${deliveryFee > 0 ? `Penghantaran: RM${deliveryFee.toFixed(2)}\n` : ""}${discount > 0 ? `Diskaun: -RM${discount.toFixed(2)}\n` : ""}*Jumlah: RM${total.toFixed(2)}*`;

  let checkoutUrl: string | null = null;
  let msg: string;

  if (isCod) {
    // COD / pickup — tiada pay link, hantar pengesahan
    const method = isPickup ? "🏪 Pickup (ambil sendiri)" : "🚚 COD (bayar masa terima)";
    msg = `Hai ${b.name.trim()}! 🥭\n\nPesanan anda *${order.order_number}* telah direkod:\n${lines}\n${totalsBlock}\n\n${method}\n\nTerima kasih! Kami akan ${isPickup ? "maklumkan bila sedia untuk diambil" : "hubungi untuk penghantaran"}. 🙏`;
    // COD disahkan serta-merta — kalau dari iklan CTWA, hantar Purchase ke Meta.
    if (order.ctwa_clid) {
      void sendCapiPurchaseWhatsApp({
        orderId: order.id,
        orderNumber: order.order_number,
        total,
        phone: order.phone ?? b.phone!.trim(),
        ctwa_clid: order.ctwa_clid,
      }).catch(() => {});
    }
  } else {
    // Pay link — CHIP purchase (success_callback = webhook order sedia ada)
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
    checkoutUrl = chip.checkout_url;
    if (chip.id) await sb.from("lp_guest_orders").update({ payment_ref: chip.id }).eq("id", order.id);
    msg = `Hai ${b.name.trim()}! 🥭\n\nPesanan anda *${order.order_number}*:\n${lines}\n${totalsBlock}\n\nKlik untuk bayar selamat:\n${checkoutUrl}\n\nTerima kasih! 🙏`;
  }

  // Hantar WhatsApp + log
  const { data: contact } = await sb.from("wa_contacts").select("wa_id").eq("id", b.contactId).single();
  let sendOk = false;
  if (contact) {
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

  return NextResponse.json({ ok: true, order_number: order.order_number, total, checkoutUrl, cod: isCod, sentWhatsApp: sendOk });
}

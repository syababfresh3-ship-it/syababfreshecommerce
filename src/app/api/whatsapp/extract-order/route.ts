// ============================================================
// api/whatsapp/extract-order — AI baca chat customer → cabut details order
// (nama, alamat, poskod, produk+qty) untuk auto-isi order-builder. Admin only.
// Guna Anthropic (sama key macam support bot). Padan produk ikut katalog yg
// dihantar client (guna product_id/variant_id tepat).
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Variant { id: string; name: string; price: number }
interface Product { id: string; name: string; price: number; product_variants: Variant[] }

export async function POST(req: NextRequest) {
  // Auth admin
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { contactId, products } = (await req.json().catch(() => ({}))) as { contactId?: string; products?: Product[] };
  if (!contactId) return NextResponse.json({ error: "contactId diperlukan." }, { status: 400 });
  if (!Array.isArray(products) || products.length === 0) return NextResponse.json({ error: "Katalog produk diperlukan." }, { status: 400 });

  // Chat + kontak
  const { data: contact } = await sb.from("wa_contacts").select("name, phone, wa_id").eq("id", contactId).single();
  const { data: conv } = await sb.from("wa_conversations").select("id").eq("contact_id", contactId).maybeSingle();
  let chat = "";
  if (conv) {
    const { data: msgs } = await sb
      .from("wa_messages")
      .select("direction, body, type")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(50);
    chat = (msgs ?? [])
      .filter((m) => m.body)
      .map((m) => `${m.direction === "in" ? "Customer" : "Admin"}: ${m.body}`)
      .join("\n");
  }
  if (!chat.trim()) return NextResponse.json({ error: "Tiada chat untuk dibaca." }, { status: 400 });

  // Katalog ringkas
  const catalog = products
    .map((p) => {
      const vars = p.product_variants?.length
        ? p.product_variants.map((v) => `  - variant_id=${v.id} | ${v.name} | RM${v.price}`).join("\n")
        : `  - (tiada variant) | RM${p.price}`;
      return `product_id=${p.id} | ${p.name}\n${vars}`;
    })
    .join("\n");

  const system =
    "Anda pembantu yang cabut maklumat order dari perbualan WhatsApp customer SyababFresh. " +
    "Pulangkan JSON SAHAJA (tiada teks lain). Guna product_id & variant_id TEPAT dari katalog sahaja — " +
    "jangan reka. Kalau sesuatu detail tak disebut, biar string kosong atau array kosong.";

  const prompt = `KATALOG PRODUK:
${catalog}

KONTAK: nama=${contact?.name || ""}, phone=${contact?.phone || contact?.wa_id || ""}

PERBUALAN:
${chat}

Pulangkan JSON dgn struktur ini:
{"name":"","phone":"","email":"","address":"","postcode":"","items":[{"product_id":"","variant_id":null,"quantity":1}]}
- product_id & variant_id mesti dari katalog (variant_id null jika produk tiada variant).
- quantity = nombor.
- address = alamat penuh kalau ada; postcode = 5 digit kalau ada.`;

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr) as {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      postcode?: string;
      items?: { product_id?: string; variant_id?: string | null; quantity?: number }[];
    };

    // Padan ke katalog → bina item dgn nama + harga
    const items = (parsed.items ?? [])
      .map((it) => {
        const p = products.find((x) => x.id === it.product_id);
        if (!p) return null;
        const v = it.variant_id ? p.product_variants?.find((x) => x.id === it.variant_id) : null;
        return {
          product_id: p.id,
          variant_id: v?.id ?? null,
          product_name: p.name,
          variant_name: v?.name ?? null,
          quantity: Math.max(1, Number(it.quantity) || 1),
          unit_price: v?.price ?? p.price,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      name: parsed.name || contact?.name || "",
      phone: parsed.phone || contact?.phone || contact?.wa_id || "",
      email: parsed.email || "",
      address: parsed.address || "",
      postcode: parsed.postcode || "",
      items,
    });
  } catch (e) {
    console.error("[extract-order]", e);
    return NextResponse.json({ error: "AI gagal baca chat. Cuba lagi." }, { status: 502 });
  }
}

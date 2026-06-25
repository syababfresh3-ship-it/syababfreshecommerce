// ============================================================
// lib/ai/wa-tools — tool khusus chatbot WhatsApp (neutral) + runner.
// search_products (harga LIVE) + get_order_by_phone (order customer ikut nombor).
// Read-only; tool TIDAK terima order_id dari model (guna konteks contact sahaja).
// ============================================================
import type { AiToolDef, RunTool } from "./tools";
import { sendAdminPush } from "@/lib/push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export const WA_TOOLS: AiToolDef[] = [
  {
    name: "search_products",
    description:
      "Cari produk SyababFresh yang aktif untuk jawab soalan harga/produk atau cadang produk. Pulang nama, harga, unit, info ringkas. Kosongkan query untuk produk popular.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: 'Kata kunci produk, cth "durian", "mangga". Kosong = senarai popular.' },
      },
      required: [],
    },
  },
  {
    name: "get_order_by_phone",
    description:
      "Semak order & tracking terkini customer ini (terikat pada nombor WhatsApp mereka). Tiada parameter — sentiasa rujuk customer semasa.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "remember_about_customer",
    description:
      "Simpan fakta PENTING & kekal tentang customer ini supaya anda ingat masa depan (nama panggilan, budget, kesukaan buah, pantang/alahan, alamat tetap, dll). Guna bila customer kongsi maklumat berguna. JANGAN simpan benda remeh atau sementara.",
    parameters: {
      type: "object",
      properties: {
        facts: {
          type: "object",
          description:
            'Pasangan kunci-nilai, cth {"nama_panggilan":"Kak Mah","budget":"sekitar RM100","suka":"durian musang king, cherry","alahan":"tiada"}. Hantar hanya fakta baru/dikemas.',
          additionalProperties: { type: "string" },
        },
      },
      required: ["facts"],
    },
  },
  {
    name: "flag_ready_order",
    description:
      "Rekod order yang customer DAH SAHKAN supaya team boleh hantar pautan bayar / sahkan COD. Panggil HANYA selepas customer sahkan order lengkap (produk+kuantiti, nama, alamat+poskod atau pickup, kaedah bayar). Selepas panggil, beritahu customer team akan hantar pautan bayar sekejap lagi.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "Ringkasan order penuh: produk + kuantiti + harga, nama penuh, alamat + poskod (atau 'pickup'), kaedah bayar (pautan bayar/COD), dan anggaran jumlah RM.",
        },
      },
      required: ["summary"],
    },
  },
];

export interface WaToolCtx {
  profileId?: string | null;
  phone?: string | null;
  waId: string;
  contactId?: string | null;
  conversationId?: string | null;
  name?: string | null;
  dryRun?: boolean; // mod playground — jangan tulis/hantar apa-apa
}

export function makeWaToolRunner(sb: SB, ctx: WaToolCtx): RunTool {
  return async (name, input) => {
    if (name === "search_products") return searchProducts(sb, String(input.query ?? ""));
    if (name === "get_order_by_phone") return getOrderByPhone(sb, ctx);
    if (name === "remember_about_customer") return rememberAboutCustomer(sb, ctx, input.facts);
    if (name === "flag_ready_order") return flagReadyOrder(sb, ctx, String(input.summary ?? ""));
    return `Tool tidak dikenali: ${name}`;
  };
}

// Simpan fakta kekal tentang customer (merge ke wa_contacts.ai_memory).
async function rememberAboutCustomer(sb: SB, ctx: WaToolCtx, facts: unknown): Promise<string> {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) return "GAGAL: facts mesti objek kunci-nilai.";
  const incoming: Record<string, string> = {};
  for (const [k, v] of Object.entries(facts as Record<string, unknown>)) {
    const key = String(k).trim().slice(0, 60);
    const val = String(v ?? "").trim().slice(0, 300);
    if (key && val) incoming[key] = val;
  }
  if (Object.keys(incoming).length === 0) return "GAGAL: tiada fakta sah untuk disimpan.";
  if (ctx.dryRun) return `BERJAYA (mod ujian): diingat — ${JSON.stringify(incoming)}`;
  if (!ctx.contactId) return "GAGAL: tiada konteks contact.";

  const { data: c } = await sb.from("wa_contacts").select("ai_memory").eq("id", ctx.contactId).maybeSingle();
  const current = (c?.ai_memory && typeof c.ai_memory === "object" ? c.ai_memory : {}) as Record<string, string>;
  const merged = { ...current, ...incoming };
  // Had ~30 fakta supaya tak membengkak.
  const keys = Object.keys(merged);
  const trimmed = keys.length > 30 ? Object.fromEntries(Object.entries(merged).slice(-30)) : merged;
  await sb.from("wa_contacts").update({ ai_memory: trimmed }).eq("id", ctx.contactId);
  return `BERJAYA: diingat untuk masa depan — ${JSON.stringify(incoming)}`;
}

// Order dah disahkan customer → rekod ke notes contact + tag team + push.
// Team finalize guna butang "Buat Order + Pay Link" (atau extract-order).
async function flagReadyOrder(sb: SB, ctx: WaToolCtx, summary: string): Promise<string> {
  if (!summary.trim()) return "GAGAL: ringkasan order kosong. Kumpul & sahkan butiran order dahulu.";
  if (ctx.dryRun) {
    return "BERJAYA (mod ujian): order direkod & dihantar ke team. Beritahu customer CS akan sahkan & hantar pautan bayar sekejap lagi.";
  }
  if (!ctx.contactId) return "GAGAL: tiada konteks contact.";

  const stamp = `[Order via AI — perlu hantar pautan bayar]\n${summary.trim()}`;
  const { data: c } = await sb.from("wa_contacts").select("notes").eq("id", ctx.contactId).maybeSingle();
  const newNotes = c?.notes ? `${c.notes}\n\n${stamp}` : stamp;
  await sb.from("wa_contacts").update({ notes: newNotes }).eq("id", ctx.contactId);

  if (ctx.conversationId) {
    await sb.from("wa_conversations").update({ needs_reply: true }).eq("id", ctx.conversationId);
  }

  await sendAdminPush({
    title: `Order sedia — ${ctx.name || "Customer"}`,
    body: summary.trim().slice(0, 120),
    url: "/admin/crm/inbox",
    tag: "crm-order-lead",
  }).catch(() => {});

  return "BERJAYA: order direkod & dihantar ke team untuk hantar pautan bayar. Beritahu customer: terima kasih, CS akan sahkan & hantar pautan bayar sekejap lagi.";
}

async function searchProducts(sb: SB, query: string): Promise<string> {
  let q = sb.from("products").select("name, price, unit, description").eq("is_active", true).limit(8);
  if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
  else q = q.eq("is_featured", true);
  const { data, error } = await q;
  if (error) return `Ralat cari produk: ${error.message}`;
  if (!data?.length) return "Tiada produk dijumpai untuk carian itu.";
  return JSON.stringify(
    data.map((p: { name: string; price: number; unit: string; description: string | null }) => ({
      nama: p.name,
      harga: `RM${Number(p.price).toFixed(2)}/${p.unit}`,
      info: (p.description ?? "").slice(0, 160),
    })),
  );
}

async function getOrderByPhone(sb: SB, ctx: WaToolCtx): Promise<string> {
  const out: Array<{ order: string; status: string; tracking_no: string | null; tracking_url: string | null }> = [];

  // Order storefront — ikut profile (wa_contacts.profile_id = orders.user_id).
  if (ctx.profileId) {
    const { data: ords } = await sb
      .from("orders")
      .select("id, order_number, status, created_at")
      .eq("user_id", ctx.profileId)
      .order("created_at", { ascending: false })
      .limit(3);
    for (const o of ords ?? []) {
      const { data: ship } = await sb
        .from("order_shipments")
        .select("tracking_number, tracking_url")
        .eq("order_id", o.id)
        .is("refund_id", null)
        .maybeSingle();
      out.push({
        order: o.order_number,
        status: o.status,
        tracking_no: ship?.tracking_number ?? null,
        tracking_url: ship?.tracking_url ?? null,
      });
    }
  }

  // Order LP / Quick Order (lp_guest_orders.phone terus) — ikut nombor WA.
  const local = String(ctx.phone || ctx.waId).replace(/\D/g, "").slice(-8);
  if (local.length >= 7) {
    const { data: lps } = await sb
      .from("lp_guest_orders")
      .select("order_number, status, tracking_number, tracking_url, created_at")
      .ilike("phone", `%${local}%`)
      .order("created_at", { ascending: false })
      .limit(3);
    for (const l of lps ?? []) {
      out.push({
        order: l.order_number,
        status: l.status,
        tracking_no: l.tracking_number ?? null,
        tracking_url: l.tracking_url ?? null,
      });
    }
  }

  if (!out.length) return "Tiada order dijumpai untuk nombor ini. Minta customer sahkan no order kalau ada.";
  return JSON.stringify(out.slice(0, 5));
}

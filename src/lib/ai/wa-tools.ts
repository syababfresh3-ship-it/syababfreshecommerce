// ============================================================
// lib/ai/wa-tools — tool khusus chatbot WhatsApp (neutral) + runner.
// search_products (harga LIVE) + get_order_by_phone (order customer ikut nombor).
// Read-only; tool TIDAK terima order_id dari model (guna konteks contact sahaja).
// ============================================================
import type { AiToolDef, RunTool } from "./tools";

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
];

export interface WaToolCtx {
  profileId?: string | null;
  phone?: string | null;
  waId: string;
}

export function makeWaToolRunner(sb: SB, ctx: WaToolCtx): RunTool {
  return async (name, input) => {
    if (name === "search_products") return searchProducts(sb, String(input.query ?? ""));
    if (name === "get_order_by_phone") return getOrderByPhone(sb, ctx);
    return `Tool tidak dikenali: ${name}`;
  };
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

// ============================================================
// api/whatsapp/templates/insights — prestasi template dari Meta.
// Tarik Template Analytics API: sent / delivered / read (window 30 hari).
// Per-WABA (phoneId → waba_id). Admin only. Ringkas — tiada carta/kos.
// ============================================================
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates } from "@/lib/whatsapp-cloud";

const GRAPH = "https://graph.facebook.com/v21.0";

interface Metric { sent: number; delivered: number; read: number }

export async function GET(req: Request) {
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = process.env.WHATSAPP_TOKEN;
  let waba = process.env.WHATSAPP_WABA_ID;

  // Per-WABA: resolve dari nombor kalau diberi.
  const phoneId = new URL(req.url).searchParams.get("phoneId");
  if (phoneId) {
    const { data: num } = await sb.from("wa_numbers").select("waba_id").eq("phone_number_id", phoneId).maybeSingle();
    if (num?.waba_id) waba = num.waba_id as string;
  }
  if (!token || !waba) return NextResponse.json({ error: "WhatsApp belum dikonfigurasi." }, { status: 503 });

  // Senarai template (semua status) untuk dapat ID → nama.
  const list = await listTemplates(false, waba);
  if (!list.ok) return NextResponse.json({ error: list.error }, { status: 502 });
  const idToName = new Map<string, string>();
  for (const t of list.templates) if (t.id) idToName.set(t.id, t.name);
  const ids = [...idToName.keys()];
  if (ids.length === 0) return NextResponse.json({ insights: {}, days: 30 });

  // Window 30 hari (saat). Meta: end tak boleh masa depan.
  const end = Math.floor(Date.now() / 1000);
  const start = end - 30 * 24 * 3600;

  // template_analytics: max 10 template_ids / panggilan → batch.
  const byName: Record<string, Metric> = {};
  let enabled = true;
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const url =
      `${GRAPH}/${waba}/template_analytics` +
      `?start=${start}&end=${end}&granularity=DAILY` +
      `&metric_types=${encodeURIComponent(JSON.stringify(["SENT", "DELIVERED", "READ"]))}` +
      `&template_ids=${encodeURIComponent(JSON.stringify(batch))}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) {
      // Analytics belum di-enable untuk WABA ni (perlu accept terms di Meta).
      enabled = false;
      continue;
    }
    for (const block of (j.data ?? []) as Array<{ data_points?: Array<Record<string, number | string>> }>) {
      for (const p of block.data_points ?? []) {
        const tid = String(p.template_id ?? "");
        const name = idToName.get(tid);
        if (!name) continue;
        const m = (byName[name] ??= { sent: 0, delivered: 0, read: 0 });
        m.sent += Number(p.sent ?? 0);
        m.delivered += Number(p.delivered ?? 0);
        m.read += Number(p.read ?? 0);
      }
    }
  }

  return NextResponse.json({
    insights: byName,
    days: 30,
    enabled: enabled || Object.keys(byName).length > 0,
  });
}

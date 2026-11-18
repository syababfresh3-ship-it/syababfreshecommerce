// ============================================================
// api/cron/wa-gateway-health — pemeriksa gateway WhatsApp sendiri (wa.syababfresh.my).
// Dipanggil cron-job.org setiap 10 minit (Bearer CRON_SECRET). Melengkapi peristiwa `session`
// dari gateway: webhook tidak boleh memberitahu bila VPS/gateway mati sepenuhnya, cron ini boleh.
//   • gateway tidak dapat dihubungi → amaran 'unreachable' (id 'gateway')
//   • setiap session dalam MURPATI_SESSION_IDS: connected → ok (notis pulih jika sebelum ini bermasalah),
//     logged_out → 'logged_out', lain-lain (disconnected/pending/expired/tiada) → 'down'
// Dedup & saluran (emel + push) dalam lib/wa-gateway-alerts.
// ============================================================
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stampHeartbeat, stampHeartbeatError } from "@/lib/cron-heartbeat";
import { getConfiguredSessionIds } from "@/lib/murpati";
import { gatewayConfigured, gatewayListSessions } from "@/lib/wa-gateway";
import { reportGatewayState, type GatewayState } from "@/lib/wa-gateway-alerts";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sb = createAdminClient();
  if (!gatewayConfigured()) {
    await stampHeartbeat(sb, "wa-gateway-health");
    return NextResponse.json({ skipped: "gateway tidak dikonfigurasi" });
  }

  try {
    const res = await gatewayListSessions();
    const notified: string[] = [];
    if (!res.ok) {
      if (await reportGatewayState(sb, "gateway", "unreachable", { label: "Gateway WA", reason: res.error ?? null })) notified.push("gateway");
      await stampHeartbeat(sb, "wa-gateway-health");
      return NextResponse.json({ ok: false, error: res.error, notified });
    }
    if (await reportGatewayState(sb, "gateway", "ok", { label: "Gateway WA" })) notified.push("gateway");

    const byId = new Map(res.sessions.map((s) => [s.session_id, s]));
    const results: Record<string, string> = {};
    for (const id of getConfiguredSessionIds()) {
      const s = byId.get(id);
      const status = s?.status ?? "missing";
      const state: GatewayState = status === "connected" ? "ok" : status === "logged_out" ? "logged_out" : "down";
      results[id] = status;
      if (await reportGatewayState(sb, id, state, { label: s?.device_name ?? null, phone: s?.phone_number ?? null, reason: s ? `status: ${status}` : "session tiada dalam gateway (dipadam?)" })) notified.push(id);
    }
    await stampHeartbeat(sb, "wa-gateway-health");
    return NextResponse.json({ ok: true, sessions: results, notified });
  } catch (e) {
    await stampHeartbeatError(sb, "wa-gateway-health", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

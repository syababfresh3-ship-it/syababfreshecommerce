// ============================================================
// api/cron/external-sync — auto-sync pembeli channel luar (TikTok) dari ops.
// Jaga external_customers + tag wa_contacts sentiasa terkini (elak data Pembelian
// basi). Dipanggil cron-job.org harian. Bearer CRON_SECRET.
//
// Kenapa jawapan dihantar DULU (after): ops/api/sync sendiri ambil ~40 saat untuk
// 38k pelanggan (18MB), melebihi had 30s cron-job.org. Dulu job dilapor gagal,
// invocation tak sempat habis, heartbeat tak pernah dicop — job nampak "senyap"
// walaupun tiada ralat sebenar. Kini cron dapat 200 serta-merta dan kerja sebenar
// disambung dalam `after()`; heartbeat dicop bila ia betul-betul siap.
//
// ?dry=1 — jalankan bacaan sahaja (tiada tulisan) dan pulangkan kiraan.
// ============================================================
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncExternalCustomers } from "@/lib/external-sync";
import { stampHeartbeat, stampHeartbeatError } from "@/lib/cron-heartbeat";

// Elak dua run bertindih dalam instance yang sama (Fluid Compute guna semula instance).
let running = false;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sb = createAdminClient();
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  // Dry: tunggu dan pulangkan hasil — memang untuk diperiksa manusia.
  if (dry) {
    const r = await syncExternalCustomers(sb, { dry: true });
    return Response.json(r, { status: r.ok ? 200 : (r.status ?? 500) });
  }

  if (running) return Response.json({ ok: true, skipped: "sync sedang berjalan" });
  running = true;

  after(async () => {
    try {
      const r = await syncExternalCustomers(sb);
      if (r.ok) await stampHeartbeat(sb, "external-sync");
      else await stampHeartbeatError(sb, "external-sync", r.error);
    } catch (err) {
      await stampHeartbeatError(sb, "external-sync", (err as Error).message).catch(() => {});
    } finally {
      running = false;
    }
  });

  return Response.json({ ok: true, started: true });
}

// ============================================================
// api/cron/external-sync — auto-sync pembeli channel luar (TikTok) dari ops.
// Jaga external_customers + tag wa_contacts sentiasa terkini (elak data Pembelian
// basi). Dipanggil cron-job.org harian. Bearer CRON_SECRET.
// ============================================================
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

import { createAdminClient } from "@/lib/supabase/admin";
import { syncExternalCustomers } from "@/lib/external-sync";
import { stampHeartbeat, stampHeartbeatError } from "@/lib/cron-heartbeat";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sb = createAdminClient();
  const r = await syncExternalCustomers(sb);
  if (r.ok) await stampHeartbeat(sb, "external-sync");
  else await stampHeartbeatError(sb, "external-sync", r.error);
  return Response.json(r, { status: r.ok ? 200 : (r.status ?? 500) });
}

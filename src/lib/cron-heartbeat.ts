// ============================================================
// cron-heartbeat — stamp "cron ni hidup" ke cron_heartbeats (109).
// Best-effort: TAK PERNAH gagalkan cron sebenar (catch semua).
// Guna: await stampHeartbeat(sb, "auto-followup") di HUJUNG handler (selepas
// kerja siap); stampHeartbeatError bila handler catch ralat besar.
// Dashboard admin baca jadual ni → alert merah bila senyap > 3x jangkaan.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function stampHeartbeat(sb: SB, job: string): Promise<void> {
  try {
    await sb.from("cron_heartbeats").upsert(
      { job, last_ok_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "job" },
    );
  } catch {
    /* jangan sekali-kali ganggu cron sebenar */
  }
}

export async function stampHeartbeatError(sb: SB, job: string, err: unknown): Promise<void> {
  try {
    await sb.from("cron_heartbeats").upsert(
      {
        job,
        last_error: String((err as Error)?.message ?? err).slice(0, 500),
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "job" },
    );
  } catch {
    /* senyap */
  }
}

// ============================================================
// wa-optout — kenal pasti mesej customer yang minta berhenti terima blast.
//
// isOptOutReply   → auto-suppress (webhook). Ketat: SELURUH mesej mesti kata
//                   STOP selepas buang format WhatsApp (*bold*, _italic_),
//                   tanda baca & emoji. Cth "*STOP*", "Stop!", "STOP..." lulus.
// isPossibleOptOut → senarai "Mungkin minta STOP" untuk admin semak (tidak
//                   auto). Mesej pendek yang sebut stop/berhenti/unsub,
//                   cth "Stop hantar iklan", "boleh stop x ya?".
// ============================================================

const OPT_OUT_PHRASES = new Set([
  "stop",
  "unsubscribe",
  "unsub",
  "berhenti",
  "stop promosi",
  "berhenti promosi",
  "berhenti langgan",
  "stop promotions", // teks lalai butang "Marketing opt-out" Meta
]);

const POSSIBLE_OPT_OUT_MAX_LEN = 80;

/** Huruf kecil, buang format/tanda baca/emoji, rapatkan ruang. */
export function normalizeOptOutText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isOptOutReply(text: string | null | undefined): boolean {
  if (!text) return false;
  return OPT_OUT_PHRASES.has(normalizeOptOutText(text));
}

export function isPossibleOptOut(text: string | null | undefined): boolean {
  if (!text || text.length > POSSIBLE_OPT_OUT_MAX_LEN) return false;
  return /\b(stop|berhenti|unsub\w*)\b/.test(normalizeOptOutText(text));
}

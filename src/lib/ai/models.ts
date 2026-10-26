// ============================================================
// lib/ai/models — registry model + harga (untuk kira kos).
// Dua provider: OpenAI (gpt-4o-mini) + Anthropic (Claude Haiku 5.5 / Sonnet 5.5 / Haiku 4.5).
// Tambah model baru = tambah satu entri di sini sahaja.
// ============================================================

export type AiProviderName = "openai" | "anthropic";

export interface AiModelSpec {
  key: string; // kunci dalaman (disimpan dalam app_settings + wa_ai_log)
  provider: AiProviderName;
  apiModel: string; // nama model sebenar di API provider
  label: string;
  inPer1M: number; // USD / 1M token input
  outPer1M: number; // USD / 1M token output
}

export const AI_MODELS: Record<string, AiModelSpec> = {
  "gpt-4o-mini": {
    key: "gpt-4o-mini",
    provider: "openai",
    apiModel: "gpt-4o-mini",
    label: "GPT-4o mini",
    inPer1M: 0.15,
    outPer1M: 0.6,
  },
  "claude-haiku-5-5": {
    key: "claude-haiku-5-5",
    provider: "anthropic",
    apiModel: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    inPer1M: 0.1,
    outPer1M: 0.5,
  },
  "claude-sonnet-5-5": {
    key: "claude-sonnet-5-5",
    provider: "anthropic",
    apiModel: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    inPer1M: 2,
    outPer1M: 10,
  },
  "claude-haiku": {
    key: "claude-haiku",
    provider: "anthropic",
    apiModel: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    inPer1M: 1,
    outPer1M: 5,
  },
};

export const DEFAULT_MODEL_KEY = "gpt-4o-mini";
// Sandaran: Haiku 5.5 — lebih murah dari gpt-4o-mini (harga platform.claude.com/docs/en/about-claude/pricing, 26 Okt 2026).
export const FALLBACK_MODEL_KEY = "claude-haiku-5-5";

// Tukar nilai RM (anggaran) — untuk papar kos dalam analytics.
export const USD_TO_MYR = 4.7;

export function resolveModel(key?: string | null): AiModelSpec {
  return AI_MODELS[key ?? ""] ?? AI_MODELS[DEFAULT_MODEL_KEY];
}

// Harga cache prompt Anthropic (5 minit): baca = 10% harga input, tulis = 125% — pengganda standard semua model Claude.
export const CACHE_READ_MULT = 0.1;
export const CACHE_WRITE_MULT = 1.25;

export function costUsd(spec: AiModelSpec, tokensIn: number, tokensOut: number, cacheRead = 0, cacheCreate = 0): number {
  return (
    (tokensIn / 1e6) * spec.inPer1M +
    (tokensOut / 1e6) * spec.outPer1M +
    (cacheRead / 1e6) * spec.inPer1M * CACHE_READ_MULT +
    (cacheCreate / 1e6) * spec.inPer1M * CACHE_WRITE_MULT
  );
}

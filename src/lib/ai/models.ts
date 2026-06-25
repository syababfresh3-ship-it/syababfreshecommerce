// ============================================================
// lib/ai/models — registry model + harga (untuk kira kos).
// Dua provider: OpenAI (gpt-4o-mini) + Anthropic (claude-haiku-4-5).
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
  "claude-haiku": {
    key: "claude-haiku",
    provider: "anthropic",
    apiModel: "claude-haiku-4-5",
    label: "Claude Haiku",
    inPer1M: 1,
    outPer1M: 5,
  },
};

export const DEFAULT_MODEL_KEY = "gpt-4o-mini";
export const FALLBACK_MODEL_KEY = "claude-haiku";

// Tukar nilai RM (anggaran) — untuk papar kos dalam analytics.
export const USD_TO_MYR = 4.7;

export function resolveModel(key?: string | null): AiModelSpec {
  return AI_MODELS[key ?? ""] ?? AI_MODELS[DEFAULT_MODEL_KEY];
}

export function costUsd(spec: AiModelSpec, tokensIn: number, tokensOut: number): number {
  return (tokensIn / 1e6) * spec.inPer1M + (tokensOut / 1e6) * spec.outPer1M;
}

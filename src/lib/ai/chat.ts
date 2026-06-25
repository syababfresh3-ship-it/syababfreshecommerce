// ============================================================
// lib/ai/chat — orkestra: pilih model, dispatch ke provider, fallback ke model
// kedua bila gagal. Satu pintu masuk: runAiChat().
// ============================================================
import { AI_MODELS, FALLBACK_MODEL_KEY, costUsd, resolveModel, type AiModelSpec } from "./models";
import { runAnthropicChat } from "./providers/anthropic";
import { runOpenAiChat } from "./providers/openai";
import type { AiToolDef, RunTool } from "./tools";
import type { ChatTurn, ProviderRun } from "./types";

export type { ChatTurn };

const PROVIDERS: Record<string, ProviderRun> = {
  openai: runOpenAiChat,
  anthropic: runAnthropicChat,
};

export interface AiChatResult {
  text: string;
  usage: { in: number; out: number };
  modelKey: string;
  costUsd: number;
}

export interface RunAiChatOpts {
  modelKey?: string | null; // model lalai (dari app_settings)
  system: string;
  history?: ChatTurn[];
  userMessage: string;
  tools?: AiToolDef[];
  runTool?: RunTool;
  maxIters?: number;
  maxTokens?: number;
  fallback?: boolean; // default true → cuba model kedua bila yang pertama gagal
}

const noopTool: RunTool = async () => "";

export async function runAiChat(opts: RunAiChatOpts): Promise<AiChatResult> {
  const primary = resolveModel(opts.modelKey);
  const chain: AiModelSpec[] =
    opts.fallback === false
      ? [primary]
      : dedupe([primary, AI_MODELS[FALLBACK_MODEL_KEY]]);

  let lastErr: unknown;
  for (const spec of chain) {
    const run = PROVIDERS[spec.provider];
    if (!run) continue;
    try {
      const { text, usage } = await run({
        apiModel: spec.apiModel,
        system: opts.system,
        history: opts.history ?? [],
        userMessage: opts.userMessage,
        tools: opts.tools ?? [],
        runTool: opts.runTool ?? noopTool,
        maxIters: opts.maxIters ?? 6,
        maxTokens: opts.maxTokens ?? 600,
      });
      return { text, usage, modelKey: spec.key, costUsd: costUsd(spec, usage.in, usage.out) };
    } catch (e) {
      lastErr = e;
      // cuba model seterusnya dalam rantai fallback
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Semua model AI gagal.");
}

function dedupe(specs: AiModelSpec[]): AiModelSpec[] {
  const seen = new Set<string>();
  const out: AiModelSpec[] = [];
  for (const s of specs) {
    if (s && !seen.has(s.key)) {
      seen.add(s.key);
      out.push(s);
    }
  }
  return out;
}

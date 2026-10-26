// ============================================================
// lib/ai/types — jenis kongsi antara chat.ts + providers (elak import bulat).
// ============================================================
import type { AiToolDef, RunTool } from "./tools";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiUsage {
  in: number; // token input TIDAK dicache
  out: number; // token output (termasuk penaakulan/thinking model Claude 5.x)
  cacheRead?: number; // token prompt dibaca dari cache (Anthropic; 10% harga input)
  cacheCreate?: number; // token ditulis ke cache (Anthropic; 125% harga input)
}

// Setiap provider laksana tool-loop sendiri (native), terima toolDef neutral +
// runTool callback. Pulang teks akhir + jumlah token.
export interface ProviderRunArgs {
  apiModel: string;
  system: string;
  history: ChatTurn[];
  userMessage: string;
  tools: AiToolDef[];
  runTool: RunTool;
  maxIters: number;
  maxTokens: number;
}

export type ProviderRun = (args: ProviderRunArgs) => Promise<{ text: string; usage: AiUsage }>;

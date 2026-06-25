// ============================================================
// lib/ai/types — jenis kongsi antara chat.ts + providers (elak import bulat).
// ============================================================
import type { AiToolDef, RunTool } from "./tools";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiUsage {
  in: number;
  out: number;
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

// ============================================================
// lib/ai/tools — takrifan tool NEUTRAL (JSON schema) + adapter ke setiap SDK.
// Tool ditakrif sekali di sini; setiap provider menukar ke formatnya sendiri.
// Runner (apa tool sebenarnya buat) dibekalkan oleh pemanggil (cth wa-agent, F2).
// ============================================================

export interface AiToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// Pemanggil bekalkan: nama tool + input (dari model) → pulang teks hasil.
export type RunTool = (name: string, input: Record<string, unknown>) => Promise<string>;

// --- Adapter OpenAI (Chat Completions function calling) ---
export interface OpenAiToolShape {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}
export function toOpenAiTools(defs: AiToolDef[]): OpenAiToolShape[] {
  return defs.map((d) => ({
    type: "function",
    function: { name: d.name, description: d.description, parameters: d.parameters },
  }));
}

// --- Adapter Anthropic (Messages tool use) ---
export interface AnthropicToolShape {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
export function toAnthropicTools(defs: AiToolDef[]): AnthropicToolShape[] {
  return defs.map((d) => ({
    name: d.name,
    description: d.description,
    input_schema: d.parameters,
  }));
}

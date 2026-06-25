// AI Chatbot config — master switch + model + mod + knowledge. Dilindungi middleware /admin.
export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { AiClient } from "./ai-client";

export default async function CrmAiPage() {
  const sb = createAdminClient();
  const { data } = await sb
    .from("app_settings")
    .select("key, value")
    .in("key", ["ai_chatbot_enabled", "ai_chatbot_mode", "ai_chatbot_model", "ai_chatbot_knowledge"]);
  const s: Record<string, string> = {};
  for (const r of data ?? []) s[r.key] = r.value;

  return (
    <AiClient
      initial={{
        enabled: s.ai_chatbot_enabled === "true",
        mode: s.ai_chatbot_mode || "auto",
        model: s.ai_chatbot_model || "gpt-4o-mini",
        knowledge: s.ai_chatbot_knowledge || "",
      }}
    />
  );
}

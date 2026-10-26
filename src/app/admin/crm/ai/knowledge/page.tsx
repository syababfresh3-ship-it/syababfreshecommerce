// Pengetahuan buah untuk AI chatbot — senarai produk + status fakta (draf/disahkan) + FAQ umum.
// Senarai/jadual → lebar penuh (AGENTS.md). Dilindungi middleware /admin.
export const dynamic = "force-dynamic";

import { KnowledgeClient } from "./knowledge-client";

export default function CrmAiKnowledgePage() {
  return (
    <div className="p-4 md:p-6">
      <KnowledgeClient />
    </div>
  );
}

// Detail campaign Blaster — dilindungi middleware /admin.
export const dynamic = "force-dynamic";

import { CampaignDetail } from "./campaign-detail";

export default async function BlastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignDetail id={id} />;
}

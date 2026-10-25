import { PipelineClient } from './pipeline-client'

export const dynamic = 'force-dynamic'

// Pipeline Gift Kurma — papan/senarai deal (penuh, AGENTS.md). Khas gift kurma, bukan Orders kedai.
export default async function GiftPipelinePage({ searchParams }: { searchParams: Promise<{ deal?: string }> }) {
  const { deal } = await searchParams
  return (
    <div className="p-4 md:p-6">
      <PipelineClient initialDealId={deal ?? null} />
    </div>
  )
}

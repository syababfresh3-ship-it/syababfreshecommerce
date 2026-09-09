import { CommentsClient } from './comments-client'

export const dynamic = 'force-dynamic'

// Page tersendiri (sasaran push notification "Komen baru"). Senarai = lebar penuh (AGENTS.md).
// Moderasi yang sama juga ada sebagai tab "Komen" dalam /admin/landing-pages.
export default async function LpCommentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams
  return (
    <div className="p-4 md:p-6">
      <CommentsClient pageId={page ?? ''} />
    </div>
  )
}

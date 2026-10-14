import { CatalogClient } from './catalog-client'

export const dynamic = 'force-dynamic'

// Gift Studio — catalog manager (boxes, fillings, designs). List/grid → full width (AGENTS.md).
export default function GiftCatalogPage() {
  return (
    <div className="p-4 md:p-6">
      <CatalogClient />
    </div>
  )
}

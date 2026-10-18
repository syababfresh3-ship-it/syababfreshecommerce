import type { MetadataRoute } from 'next'
import { kurmaAbs } from '@/lib/kurma-host'

// Sitemap LP kurma — /kurma/sitemap.xml (subdomain: kurma.<domain>/sitemap.xml via proxy rewrite).
// URL ikut hos berkesan (subdomain bila aktif, selain itu shop/kurma/*). Studio & berjaya = noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: kurmaAbs('/'), changeFrequency: 'weekly', priority: 0.9 },
    { url: kurmaAbs('/korporat'), changeFrequency: 'weekly', priority: 0.8 },
    { url: kurmaAbs('/borong'), changeFrequency: 'weekly', priority: 0.8 },
    { url: kurmaAbs('/portfolio'), changeFrequency: 'monthly', priority: 0.6 },
  ]
}

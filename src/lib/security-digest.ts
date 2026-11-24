// ============================================================
// security-digest — bahan untuk ringkasan keselamatan mingguan (cron /api/cron/security-digest).
//  1) Suapan CVE Cloudflare Radar (RSS 2.0, 100 CVE terbaru dengan CVSS) ditapis ikut stack kita.
//  2) Laporan `npm audit` yang dihantar pelapor (GitHub Actions untuk storefront, cron VPS untuk gateway)
//     melalui POST /api/security/report → app_settings `security_audit:<sumber>`.
// Tulen kecuali fetch; dipakai oleh cron & endpoint.
// ============================================================

export const RADAR_CVE_FEED = 'https://radar.cloudflare.com/zero-wire/cves/feed'

/** Kata kunci stack SyababFresh — padanan tidak peka huruf besar pada tajuk/penerangan CVE. */
export const STACK_KEYWORDS = [
  'next.js', 'nextjs', 'node.js', 'nodejs', 'react', 'vercel', 'supabase', 'postgres', 'postgresql', 'fastify', 'caddy',
  'ubuntu', 'openssl', 'openssh', 'systemd', 'glibc', 'nginx', 'baileys', 'whatsapp', 'prisma', 'npm ', 'express',
  'jsonwebtoken', 'zod', 'sharp', 'libvips', 'imagemagick', 'tailwind', 'cloudflare', 'github actions', 'chromium',
]

export interface CveItem { id: string; title: string; link: string; pubDate: string; severity: string | null; cvss: number | null; summary: string }

const unescape = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
const strip = (s: string) => unescape(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i')); return m ? m[1] : '' }

/** Parser RSS ringan (tiada kebergantungan) — cukup untuk suapan Radar. */
export function parseCveFeed(xml: string): CveItem[] {
  const items: CveItem[] = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const it = m[1]
    const title = strip(tag(it, 'title'))
    const desc = strip(tag(it, 'description') || tag(it, 'content:encoded'))
    const cat = strip(tag(it, 'category'))
    const idm = `${title} ${desc}`.match(/CVE-\d{4}-\d{4,}/i)
    const cvssm = `${title} ${desc} ${cat}`.match(/CVSS(?:\s*v?\d(?:\.\d)?)?\s*:?\s*(\d{1,2}(?:\.\d)?)/i) ?? `${desc}`.match(/\b(\d{1,2}\.\d)\s*\((?:Critical|High|Medium|Low)\)/i)
    const sevm = `${cat} ${title} ${desc}`.match(/\b(Critical|High|Medium|Low)\b/i)
    items.push({
      id: idm ? idm[0].toUpperCase() : title.slice(0, 40),
      title, link: strip(tag(it, 'link')) || strip(tag(it, 'guid')), pubDate: strip(tag(it, 'pubDate')),
      severity: sevm ? sevm[1].toLowerCase() : null, cvss: cvssm ? Number(cvssm[1]) : null, summary: desc.slice(0, 240),
    })
  }
  return items
}

export function matchesStack(c: CveItem): string[] {
  const hay = `${c.title} ${c.summary}`.toLowerCase()
  return STACK_KEYWORDS.filter(k => hay.includes(k.toLowerCase()))
}

export async function fetchRelevantCves(minCvss = 7): Promise<{ ok: boolean; total: number; relevant: (CveItem & { hits: string[] })[]; error?: string }> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20_000)
  try {
    const res = await fetch(RADAR_CVE_FEED, { signal: ctl.signal, cache: 'no-store', headers: { 'user-agent': 'SyababFresh-security-digest/1.0' } })
    if (!res.ok) return { ok: false, total: 0, relevant: [], error: `HTTP ${res.status}` }
    const items = parseCveFeed(await res.text())
    const relevant = items
      .map(c => ({ ...c, hits: matchesStack(c) }))
      .filter(c => c.hits.length && (c.cvss == null || c.cvss >= minCvss || c.severity === 'critical' || c.severity === 'high'))
    return { ok: true, total: items.length, relevant }
  } catch (e) {
    return { ok: false, total: 0, relevant: [], error: e instanceof Error && e.name === 'AbortError' ? 'timeout' : String(e) }
  } finally { clearTimeout(t) }
}

// ── Laporan npm audit yang disimpan pelapor ──
export interface AuditReport {
  source: string
  at: string
  counts: { critical: number; high: number; moderate: number; low: number; info?: number; total: number }
  items: { name: string; severity: string; title: string; range?: string; fixAvailable?: boolean | string; url?: string }[]
  node?: string | null
  ref?: string | null
}
export const AUDIT_SOURCES = ['storefront', 'gateway'] as const
export const auditKey = (source: string) => `security_audit:${source.replace(/[^a-z0-9_-]/gi, '').slice(0, 30)}`

/** Normalkan output `npm audit --json` (v7+) kepada AuditReport ringkas. */
export function normalizeNpmAudit(source: string, raw: unknown, extra: { node?: string | null; ref?: string | null } = {}): AuditReport {
  const r = (raw ?? {}) as { metadata?: { vulnerabilities?: Record<string, number> }; vulnerabilities?: Record<string, { severity?: string; range?: string; fixAvailable?: unknown; via?: unknown[] }> }
  const m = r.metadata?.vulnerabilities ?? {}
  const items: AuditReport['items'] = []
  for (const [name, v] of Object.entries(r.vulnerabilities ?? {})) {
    if (!['critical', 'high'].includes(String(v.severity))) continue
    const via = (v.via ?? []).find(x => typeof x === 'object' && x) as { title?: string; url?: string } | undefined
    items.push({ name, severity: String(v.severity), title: via?.title ?? '', range: v.range, url: via?.url, fixAvailable: typeof v.fixAvailable === 'object' && v.fixAvailable ? 'major' : !!v.fixAvailable })
  }
  items.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1) || a.name.localeCompare(b.name))
  return {
    source, at: new Date().toISOString(),
    counts: { critical: m.critical ?? 0, high: m.high ?? 0, moderate: m.moderate ?? 0, low: m.low ?? 0, info: m.info ?? 0, total: m.total ?? 0 },
    items: items.slice(0, 25), node: extra.node ?? null, ref: extra.ref ?? null,
  }
}

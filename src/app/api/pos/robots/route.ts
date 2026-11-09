// robots.txt untuk hos POS (proxy rewrite /robots.txt → sini). Alat dalaman — jangan indeks.
export function GET() {
  return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}

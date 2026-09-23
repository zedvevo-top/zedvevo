export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).send(`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /library
Disallow: /upload
Disallow: /downloads
Disallow: /dashboard
Disallow: /profile

Sitemap: https://zedvevo.xyz/sitemap.xml
`);
}

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { slug, id } = req.query || {};
  const rawPath = req.url ? req.url.split('?')[0] : '';
  const pathParts = rawPath.split('/').filter(Boolean);
  const targetId = slug || id || (pathParts.length > 1 ? pathParts[pathParts.length - 1] : '');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dgugpfpotxwyoiycracf.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndWdwZnBvdHh3eW9peWNyYWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODA1NDUsImV4cCI6MjEwMTA1NjU0NX0.6g-0LXv-uKwe2IxKrxa8LMJBDbd6qNKSYeLa-4_87Sk';

  let video = null;

  if (targetId) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
      const query = isUuid
        ? `id=eq.${encodeURIComponent(targetId)}`
        : `or=(id.eq.${encodeURIComponent(targetId)},slug.eq.${encodeURIComponent(targetId)})`;

      const response = await fetch(`${supabaseUrl}/rest/v1/videos?${query}&select=*&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          video = data[0];
        }
      }
    } catch (e) {
      console.error('API video metadata fetch error:', e);
    }
  }

  let html = '';
  try {
    const distPath = path.join(process.cwd(), 'dist', 'index.html');
    if (fs.existsSync(distPath)) {
      html = fs.readFileSync(distPath, 'utf8');
    } else {
      const rootPath = path.join(process.cwd(), 'index.html');
      html = fs.readFileSync(rootPath, 'utf8');
    }
  } catch (e) {
    html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>ZedVevo</title></head><body><div id="root"></div></body></html>`;
  }

  if (video) {
    const artistName = video.artist_name || 'ZedVevo';
    const pageTitle = `${video.title || 'Video'} - ${artistName} (Official Video) | ZedVevo`;
    const pageDescription = video.description || `Watch "${video.title || 'Video'}" by ${artistName} on ZedVevo.`;
    const rawCover = video.thumbnail_url || video.cover_url || '';
    const host = req.headers ? (req.headers['x-forwarded-host'] || req.headers.host) : 'zedvevo.vercel.app';
    const proto = req.headers && req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] : 'https';
    const baseUrl = `${proto}://${host}`;

    let coverUrl = rawCover;
    if (!coverUrl) {
      coverUrl = `${baseUrl}/og-image.png`;
    } else if (!coverUrl.startsWith('http://') && !coverUrl.startsWith('https://')) {
      coverUrl = `${baseUrl}${coverUrl.startsWith('/') ? '' : '/'}${coverUrl}`;
    }

    const currentUrl = `${baseUrl}/video/${encodeURIComponent(targetId)}`;

    html = html
      .replace(/<title>.*?<\/title>/gi, `<title>${escapeHtml(pageTitle)}</title>`)
      .replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gi, `<meta name="description" content="${escapeHtml(pageDescription)}" />`)
      .replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`)
      .replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${escapeHtml(pageDescription)}" />`)
      .replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/gi, `<meta property="og:image" content="${escapeHtml(coverUrl)}" />`)
      .replace(/<meta\s+property="og:image:secure_url"\s+content=".*?"\s*\/?>/gi, `<meta property="og:image:secure_url" content="${escapeHtml(coverUrl)}" />`)
      .replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/gi, `<meta property="og:url" content="${escapeHtml(currentUrl)}" />`)
      .replace(/<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/gi, `<meta name="twitter:title" content="${escapeHtml(pageTitle)}" />`)
      .replace(/<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/gi, `<meta name="twitter:description" content="${escapeHtml(pageDescription)}" />`)
      .replace(/<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/gi, `<meta name="twitter:image" content="${escapeHtml(coverUrl)}" />`);

    if (!html.includes('og:image:width')) {
      html = html.replace('</head>', `<meta property="og:image:width" content="600" /><meta property="og:image:height" content="600" /><link rel="image_src" href="${escapeHtml(coverUrl)}" /></head>`);
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

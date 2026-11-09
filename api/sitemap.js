export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dgugpfpotxwyoiycracf.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndWdwZnBvdHh3eW9peWNyYWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODA1NDUsImV4cCI6MjEwMTA1NjU0NX0.6g-0LXv-uKwe2IxKrxa8LMJBDbd6qNKSYeLa-4_87Sk';

  let songs = [];
  let videos = [];
  let artists = [];

  try {
    // 1. Fetch songs
    const songRes = await fetch(`${supabaseUrl}/rest/v1/songs?select=id,slug,updated_at,created_at&limit=500`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (songRes.ok) songs = await songRes.json();
  } catch (e) {
    console.error('Sitemap fetch songs error:', e);
  }

  try {
    // 2. Fetch videos
    const videoRes = await fetch(`${supabaseUrl}/rest/v1/videos?select=id,slug,updated_at,created_at,title,description,thumbnail_url,video_url,duration&limit=500`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (videoRes.ok) videos = await videoRes.json();
  } catch (e) {
    console.error('Sitemap fetch videos error:', e);
  }

  try {
    // 3. Fetch artists
    const artistRes = await fetch(`${supabaseUrl}/rest/v1/artists?select=id,updated_at,created_at&limit=500`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (artistRes.ok) artists = await artistRes.json();
  } catch (e) {
    console.error('Sitemap fetch artists error:', e);
  }

  const baseUrl = 'https://zedvevo.xyz';
  const lastmod = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <!-- Static Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/music</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/videos</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/awards</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/trending</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/terms</loc>
    <lastmod>2026-01-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy</loc>
    <lastmod>2026-01-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

  // Append Songs
  songs.forEach(song => {
    const songId = song.slug || song.id;
    const date = (song.updated_at || song.created_at || new Date().toISOString()).split('T')[0];
    xml += `
  <url>
    <loc>${baseUrl}/song/${encodeURIComponent(songId)}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  // Append Videos (With Google Video Sitemap extensions if possible!)
  videos.forEach(video => {
    const videoId = video.slug || video.id;
    const date = (video.updated_at || video.created_at || new Date().toISOString()).split('T')[0];
    const duration = video.duration || 180;
    const thumbnail = video.thumbnail_url || `${baseUrl}/og-image.png`;
    const title = escapeXml(video.title || 'Zambian Music Video');
    const desc = escapeXml(video.description || `Watch official music video ${video.title} on ZedVevo.`);

    xml += `
  <url>
    <loc>${baseUrl}/watch/${encodeURIComponent(videoId)}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnail)}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${desc}</video:description>
      <video:content_loc>${escapeXml(video.video_url)}</video:content_loc>
      <video:player_loc>${baseUrl}/watch/${encodeURIComponent(videoId)}</video:player_loc>
      <video:duration>${duration}</video:duration>
      <video:publication_date>${date}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>`;
  });

  // Append Artists
  artists.forEach(artist => {
    const date = (artist.updated_at || artist.created_at || new Date().toISOString()).split('T')[0];
    xml += `
  <url>
    <loc>${baseUrl}/artist/${encodeURIComponent(artist.id)}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  });

  xml += `\n</urlset>`;

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

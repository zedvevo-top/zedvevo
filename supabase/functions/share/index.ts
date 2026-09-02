// Edge Function: share
// - GET /share?nominee=<id>  → returns HTML page with correct OG meta tags for social crawlers
// - GET /share?song=<id>     → returns HTML page with correct OG meta tags for social crawlers
// - GET /share?video=<id>    → returns HTML page with correct OG meta tags for social crawlers
// - POST { content_type, content_id } → increments share_count on songs or videos
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const DEFAULT_IMAGE = 'https://dgugpfpotxwyoiycracf.supabase.co/storage/v1/object/public/thumbnails/og-default.png';
const SITE_URL = 'https://zedvevo.com';
const SITE_NAME = 'ZedVevo';

function buildOgHtml(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
}): string {
  const { title, description, image, url, type = 'website' } = opts;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />

  <!-- Open Graph -->
  <meta property="og:site_name"   content="${esc(SITE_NAME)}" />
  <meta property="og:type"        content="${esc(type)}" />
  <meta property="og:title"       content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:image"       content="${esc(image)}" />
  <meta property="og:image:secure_url" content="${esc(image)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt"   content="${esc(title)}" />
  <meta property="og:url"         content="${esc(url)}" />

  <!-- Twitter / X -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:site"        content="@ZedVevo" />
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image"       content="${esc(image)}" />
  <meta name="twitter:url"         content="${esc(url)}" />

  <!-- Redirect real visitors immediately to the SPA -->
  <meta http-equiv="refresh" content="0; url=${esc(url)}" />
  <link rel="canonical" href="${esc(url)}" />
</head>
<body>
  <p>Redirecting… <a href="${esc(url)}">Click here if not redirected</a></p>
  <script>window.location.replace("${esc(url)}");</script>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase    = createClient(supabaseUrl, serviceKey);

  // ── GET: serve OG HTML for social crawlers ──────────────────────────────────
  if (req.method === 'GET') {
    const url  = new URL(req.url);
    const nomineeId = url.searchParams.get('nominee');
    const songId    = url.searchParams.get('song');
    const videoId   = url.searchParams.get('video');

    if (nomineeId) {
      const { data: nominee } = await supabase
        .from('nominees')
        .select('id, name, bio, photo_url, song_title, total_votes')
        .eq('id', nomineeId)
        .maybeSingle();

      if (!nominee) {
        return new Response('Not found', { status: 404 });
      }

      const title = `${nominee.name} — ZedVevo Awards Nominee`;
      const desc  = nominee.bio
        ? `${String(nominee.bio).slice(0, 140)}…`
        : `Vote for ${nominee.name} at the ZedVevo Awards! 🏆 Currently ${nominee.total_votes ?? 0} votes.`;
      const image = nominee.photo_url || DEFAULT_IMAGE;
      const pageUrl = `${SITE_URL}/nominee/${nominee.id}`;

      return new Response(buildOgHtml({ title, description: desc, image, url: pageUrl, type: 'profile' }), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (songId) {
      const { data: song } = await supabase
        .from('songs')
        .select('id, title, artist_name, cover_url')
        .eq('id', songId)
        .maybeSingle();

      if (!song) return new Response('Not found', { status: 404 });

      const title = `${song.title} — ${song.artist_name} on ZedVevo`;
      const desc  = `Listen to ${song.title} by ${song.artist_name} on ZedVevo — Zambian Music & Video.`;
      const image = song.cover_url || DEFAULT_IMAGE;
      const pageUrl = `${SITE_URL}/song/${song.id}`;

      return new Response(buildOgHtml({ title, description: desc, image, url: pageUrl, type: 'music.song' }), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (videoId) {
      const { data: video } = await supabase
        .from('videos')
        .select('id, title, artist_name, thumbnail_url')
        .eq('id', videoId)
        .maybeSingle();

      if (!video) return new Response('Not found', { status: 404 });

      const title = `${video.title} — ${video.artist_name} on ZedVevo`;
      const desc  = `Watch ${video.title} by ${video.artist_name} on ZedVevo — Zambian Music & Video.`;
      const image = video.thumbnail_url || DEFAULT_IMAGE;
      const pageUrl = `${SITE_URL}/video/${video.id}`;

      return new Response(buildOgHtml({ title, description: desc, image, url: pageUrl, type: 'video.other' }), {
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Missing query param: nominee, song, or video', { status: 400 });
  }

  // ── POST: increment share_count ─────────────────────────────────────────────
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: { content_type?: string; content_id?: string };
  try { payload = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { content_type, content_id } = payload;

  if (!content_id || !['song', 'video'].includes(content_type ?? '')) {
    return json({ error: 'content_type (song|video) and content_id are required' }, 400);
  }

  const table = content_type === 'song' ? 'songs' : 'videos';

  const { data: row, error: fetchErr } = await supabase
    .from(table)
    .select('id, share_count')
    .eq('id', content_id)
    .maybeSingle();

  if (fetchErr || !row) {
    console.error('[share] fetch error:', fetchErr?.message);
    return json({ error: 'Content not found' }, 404);
  }

  const { error: updateErr } = await supabase
    .from(table)
    .update({ share_count: (row.share_count ?? 0) + 1 })
    .eq('id', content_id);

  if (updateErr) {
    console.error('[share] update error:', updateErr.message);
    return json({ error: 'Failed to increment share count' }, 500);
  }

  console.log(`[share] ${table} ${content_id} share_count → ${(row.share_count ?? 0) + 1}`);
  return json({ shared: true, share_count: (row.share_count ?? 0) + 1 });
});

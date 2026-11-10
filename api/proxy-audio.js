import https from 'https';
import http from 'http';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const queryUrl = req.query?.url || (req.url ? new URL(req.url, 'http://localhost').searchParams.get('url') : null);

  if (!queryUrl) {
    return res.status(400).json({ error: 'Missing audio url query parameter' });
  }

  try {
    const parsed = new URL(queryUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    const client = parsed.protocol === 'https:' ? https : http;

    client.get(queryUrl, (streamRes) => {
      if (streamRes.statusCode >= 300 && streamRes.statusCode < 400 && streamRes.headers.location) {
        // Handle redirect
        client.get(streamRes.headers.location, (redirRes) => {
          res.writeHead(redirRes.statusCode || 200, {
            'Content-Type': redirRes.headers['content-type'] || 'audio/mpeg',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400',
          });
          redirRes.pipe(res);
        });
        return;
      }

      res.writeHead(streamRes.statusCode || 200, {
        'Content-Type': streamRes.headers['content-type'] || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      streamRes.pipe(res);
    }).on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

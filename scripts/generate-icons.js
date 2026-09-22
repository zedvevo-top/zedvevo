import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgSquare = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8" />
      <stop offset="45%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.25" />
    </filter>
  </defs>
  
  <!-- Background vibrant electric blue gradient -->
  <rect width="1024" height="1024" rx="180" fill="url(#bgGrad)" />

  <g transform="translate(14, 0)">
    <!-- White Circular Badge -->
    <circle cx="340" cy="512" r="195" fill="#ffffff" filter="url(#shadow)" />

    <!-- Stylized "Z" with circular nodes inside the white disc -->
    <!-- Nodes -->
    <circle cx="240" cy="420" r="32" fill="#2563eb" />
    <circle cx="440" cy="420" r="32" fill="#2563eb" />
    <circle cx="220" cy="604" r="32" fill="#2563eb" />
    <circle cx="440" cy="590" r="32" fill="#2563eb" />

    <!-- Connected Segments of the Z -->
    <!-- Top bar -->
    <line x1="240" y1="420" x2="440" y2="420" stroke="#2563eb" stroke-width="28" stroke-linecap="round" />
    <!-- Diagonal bar -->
    <line x1="440" y1="420" x2="220" y2="604" stroke="#2563eb" stroke-width="32" stroke-linecap="round" />
    <!-- Bottom bar -->
    <line x1="220" y1="604" x2="440" y2="590" stroke="#2563eb" stroke-width="28" stroke-linecap="round" />

    <!-- Bold white text "VEVO" -->
    <text x="500" y="585" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Montserrat', sans-serif" font-size="190" font-weight="900" fill="#ffffff" letter-spacing="-4">VEVO</text>
  </g>
</svg>
`;

const svgBanner = `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradWide" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a" />
      <stop offset="35%" stop-color="#1d4ed8" />
      <stop offset="75%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <filter id="shadowWide" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bgGradWide)" />

  <!-- Subtle glow shapes in background -->
  <circle cx="600" cy="315" r="400" fill="#60a5fa" opacity="0.12" filter="blur(80px)" />
  <circle cx="1050" cy="150" r="250" fill="#38bdf8" opacity="0.1" filter="blur(60px)" />

  <g transform="translate(170, 45)">
    <!-- White Circular Badge -->
    <circle cx="280" cy="270" r="160" fill="#ffffff" filter="url(#shadowWide)" />

    <!-- Stylized "Z" with circular nodes -->
    <circle cx="200" cy="195" r="26" fill="#2563eb" />
    <circle cx="360" cy="195" r="26" fill="#2563eb" />
    <circle cx="180" cy="345" r="26" fill="#2563eb" />
    <circle cx="360" cy="335" r="26" fill="#2563eb" />

    <line x1="200" y1="195" x2="360" y2="195" stroke="#2563eb" stroke-width="24" stroke-linecap="round" />
    <line x1="360" y1="195" x2="180" y2="345" stroke="#2563eb" stroke-width="28" stroke-linecap="round" />
    <line x1="180" y1="345" x2="360" y2="335" stroke="#2563eb" stroke-width="24" stroke-linecap="round" />

    <!-- Bold white text "VEVO" -->
    <text x="410" y="330" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Montserrat', sans-serif" font-size="150" font-weight="900" fill="#ffffff" letter-spacing="-3">VEVO</text>
  </g>

  <!-- Subtitle / Tagline -->
  <text x="600" y="530" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="600" fill="#93c5fd" letter-spacing="4">ZAMBIAN MUSIC • OFFICIAL VIDEOS • AWARDS</text>
</svg>
`;

async function run() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  console.log('Generating app icons matching uploaded logo...');

  // 1. 512x512 app-icon-512.png
  await sharp(Buffer.from(svgSquare))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'app-icon-512.png'));

  // 2. 192x192 app-icon.png
  await sharp(Buffer.from(svgSquare))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'app-icon.png'));

  // 3. 64x64 favicon.png
  await sharp(Buffer.from(svgSquare))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  // 4. logo.png
  await sharp(Buffer.from(svgSquare))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'logo.png'));

  // 5. OpenGraph 1200x630 og-image.png & og-image.jpg
  await sharp(Buffer.from(svgBanner))
    .resize(1200, 630)
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));

  await sharp(Buffer.from(svgBanner))
    .resize(1200, 630)
    .jpeg({ quality: 90 })
    .toFile(path.join(publicDir, 'og-image.jpg'));

  // Copy to dist if dist exists
  try {
    fs.copyFileSync(path.join(publicDir, 'app-icon.png'), path.join(distDir, 'app-icon.png'));
    fs.copyFileSync(path.join(publicDir, 'app-icon-512.png'), path.join(distDir, 'app-icon-512.png'));
    fs.copyFileSync(path.join(publicDir, 'favicon.png'), path.join(distDir, 'favicon.png'));
    fs.copyFileSync(path.join(publicDir, 'og-image.png'), path.join(distDir, 'og-image.png'));
    fs.copyFileSync(path.join(publicDir, 'og-image.jpg'), path.join(distDir, 'og-image.jpg'));
  } catch {}

  console.log('All icons generated successfully!');
}

run().catch(console.error);

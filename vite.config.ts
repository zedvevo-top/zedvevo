import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import fs from "fs";
import https from "https";

const SUPABASE_REST_URL = "https://dgugpfpotxwyoiycracf.supabase.co/rest/v1";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRndWdwZnBvdHh3eW9peWNyYWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODA1NDUsImV4cCI6MjEwMTA1NjU0NX0.6g-0LXv-uKwe2IxKrxa8LMJBDbd6qNKSYeLa-4_87Sk";

function fetchSupabaseRecord(endpoint: string): Promise<any> {
  return new Promise((resolve) => {
    const req = https.get(
      `${SUPABASE_REST_URL}/${endpoint}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(Array.isArray(parsed) ? parsed[0] || null : parsed);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(null);
    });
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
    {
      name: "serve-real-apk",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ? req.url.split("?")[0] : "";
          if (url === "/ZedVevo.apk" || url === "/app-release.apk" || url.endsWith(".apk")) {
            const apkFile = fs.existsSync(path.resolve(__dirname, "public/ZedVevo.apk"))
              ? path.resolve(__dirname, "public/ZedVevo.apk")
              : path.resolve(__dirname, "public/app-release.apk");

            if (fs.existsSync(apkFile)) {
              const stat = fs.statSync(apkFile);
              res.writeHead(200, {
                "Content-Type": "application/vnd.android.package-archive",
                "Content-Disposition": 'attachment; filename="ZedVevo.apk"',
                "Content-Length": stat.size,
                "Cache-Control": "no-cache, no-store, must-revalidate",
              });
              fs.createReadStream(apkFile).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
    {
      name: "dynamic-og-metadata",
      async transformIndexHtml(html, ctx) {
        const rawUrl = ctx.originalUrl || ctx.path || "";
        const cleanUrl = rawUrl.split("?")[0];

        // Song details injection
        const songMatch = cleanUrl.match(/\/(?:song|songs|shared\/song)\/([a-zA-Z0-9_-]+)/);
        if (songMatch && songMatch[1]) {
          const songId = songMatch[1];
          const song = await fetchSupabaseRecord(`songs?id=eq.${songId}&select=id,title,artist_name,cover_url,album`);
          if (song && song.title) {
            const artistName = song.artist_name || "ZedVevo Artist";
            const title = `${escapeHtml(song.title)} by ${escapeHtml(artistName)} — ZedVevo`;
            const desc = `Stream and download "${escapeHtml(song.title)}" by ${escapeHtml(artistName)} on ZedVevo.${song.album ? ` Album: ${escapeHtml(song.album)}` : ""}`;
            const img = song.cover_url || "/og-image.png";

            let transformed = html;
            transformed = transformed.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
            transformed = transformed.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${desc}" />`);
            transformed = transformed.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`);
            transformed = transformed.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${desc}" />`);
            transformed = transformed.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${img}" />`);
            transformed = transformed.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${title}" />`);
            transformed = transformed.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${desc}" />`);
            transformed = transformed.replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${img}" />`);
            return transformed;
          }
        }

        // Nominee details injection
        const nomineeMatch = cleanUrl.match(/\/(?:nominee|shared\/nominee)\/([a-zA-Z0-9_-]+)/);
        if (nomineeMatch && nomineeMatch[1]) {
          const nomineeId = nomineeMatch[1];
          const nominee = await fetchSupabaseRecord(`nominees?id=eq.${nomineeId}&select=id,name,song_title,photo_url,avatar_url`);
          if (nominee && nominee.name) {
            const title = `Vote for ${escapeHtml(nominee.name)} | ZedVevo Music Awards`;
            const desc = nominee.song_title
              ? `Vote for ${escapeHtml(nominee.name)} nominated for "${escapeHtml(nominee.song_title)}". Every vote counts!`
              : `Vote for ${escapeHtml(nominee.name)} in the ZedVevo Awards.`;
            const img = nominee.photo_url || nominee.avatar_url || "/og-image.png";

            let transformed = html;
            transformed = transformed.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
            transformed = transformed.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`);
            transformed = transformed.replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${desc}" />`);
            transformed = transformed.replace(/<meta property="og:image" content=".*?" \/>/, `<meta property="og:image" content="${img}" />`);
            transformed = transformed.replace(/<meta name="twitter:title" content=".*?" \/>/, `<meta name="twitter:title" content="${title}" />`);
            transformed = transformed.replace(/<meta name="twitter:description" content=".*?" \/>/, `<meta name="twitter:description" content="${desc}" />`);
            transformed = transformed.replace(/<meta name="twitter:image" content=".*?" \/>/, `<meta name="twitter:image" content="${img}" />`);
            return transformed;
          }
        }

        return html;
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Ensure only a single copy of React is ever bundled (prevents HMR useState=null)
    dedupe: ["react", "react-dom"],
  },
});

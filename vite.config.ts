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
  base: "/",
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
        const cleanPath = rawUrl.split("?")[0] || "";
        let queryId: string | null = null;
        try {
          const parsedUrl = new URL(rawUrl, "http://localhost");
          queryId = parsedUrl.searchParams.get("id") || parsedUrl.searchParams.get("nomineeId");
        } catch {
          // ignore url parse error
        }

        function replaceOrInsertMeta(h: string, attr: "name" | "property", key: string, content: string): string {
          const regex = new RegExp("<meta\\s+" + attr + "=\"" + key + "\"\\s+content=\"[^\"]*\"\\s*\\/?>", "i");
          const newTag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
          if (regex.test(h)) {
            return h.replace(regex, newTag);
          }
          return h.replace("</head>", `    ${newTag}\n  </head>`);
        }

        function applyMeta(h: string, {
          title,
          description,
          imageUrl,
          pageUrl,
          type = "website",
        }: {
          title: string;
          description: string;
          imageUrl: string;
          pageUrl: string;
          type?: string;
        }): string {
          let updated = h;
          updated = updated.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
          updated = replaceOrInsertMeta(updated, "name", "description", description);
          updated = replaceOrInsertMeta(updated, "property", "og:title", title);
          updated = replaceOrInsertMeta(updated, "property", "og:description", description);
          updated = replaceOrInsertMeta(updated, "property", "og:image", imageUrl);
          updated = replaceOrInsertMeta(updated, "property", "og:image:secure_url", imageUrl);
          updated = replaceOrInsertMeta(updated, "property", "og:url", pageUrl);
          updated = replaceOrInsertMeta(updated, "property", "og:type", type);
          updated = replaceOrInsertMeta(updated, "name", "twitter:card", "summary_large_image");
          updated = replaceOrInsertMeta(updated, "name", "twitter:title", title);
          updated = replaceOrInsertMeta(updated, "name", "twitter:description", description);
          updated = replaceOrInsertMeta(updated, "name", "twitter:image", imageUrl);
          return updated;
        }

        // 1. Video matching (paths /video/:id, /videos/:id, /shared/video/:id or /videos?id=..., /video?id=...)
        const videoPathMatch = cleanPath.match(/\/(?:video|videos|shared\/video)\/([a-zA-Z0-9_-]+)/);
        const videoId = videoPathMatch ? videoPathMatch[1] : (cleanPath.startsWith("/video") || cleanPath.startsWith("/videos") ? queryId : null);

        if (videoId) {
          const video = await fetchSupabaseRecord(`videos?id=eq.${videoId}&select=id,title,artist_name,featured_artists,thumbnail_url,genre`);
          if (video && video.title) {
            const artistName = video.artist_name || "ZedVevo Artist";
            const feats = video.featured_artists ? ` ft. ${video.featured_artists}` : "";
            const title = `${video.title} by ${artistName}${feats} — ZedVevo`;
            const desc = `Watch the official music video for "${video.title}" by ${artistName}${feats} on ZedVevo. Stream authentic Zambian music.`;
            const img = video.thumbnail_url || "https://www.zedvevo.xyz/og-image.png";
            const url = `https://www.zedvevo.xyz/video/${video.id}`;
            return applyMeta(html, { title, description: desc, imageUrl: img, pageUrl: url, type: "video.other" });
          }
        }

        // 2. Song matching (paths /song/:id, /songs/:id, /shared/song/:id or /music?id=..., /song?id=...)
        const songPathMatch = cleanPath.match(/\/(?:song|songs|shared\/song)\/([a-zA-Z0-9_-]+)/);
        const songId = songPathMatch ? songPathMatch[1] : (cleanPath.startsWith("/song") || cleanPath.startsWith("/songs") || cleanPath.startsWith("/music") ? queryId : null);

        if (songId) {
          const song = await fetchSupabaseRecord(`songs?id=eq.${songId}&select=id,title,artist_name,cover_url,album,genre`);
          if (song && song.title) {
            const artistName = song.artist_name || "ZedVevo Artist";
            const title = `${song.title} by ${artistName} — ZedVevo`;
            const desc = `Stream and download "${song.title}" by ${artistName} on ZedVevo.${song.album ? ` Album: ${song.album}.` : ""} Authentic Zambian Music.`;
            const img = song.cover_url || "https://www.zedvevo.xyz/og-image.png";
            const url = `https://www.zedvevo.xyz/song/${song.id}`;
            return applyMeta(html, { title, description: desc, imageUrl: img, pageUrl: url, type: "music.song" });
          }
        }

        // 3. Nominee matching (paths /nominee/:id, /nominees/:id, /shared/nominee/:id or /nominee?id=..., /nominees?id=..., /awards?nomineeId=...)
        const nomineePathMatch = cleanPath.match(/\/(?:nominee|nominees|shared\/nominee)\/([a-zA-Z0-9_-]+)/);
        const nomineeId = nomineePathMatch ? nomineePathMatch[1] : (cleanPath.startsWith("/nominee") || cleanPath.startsWith("/nominees") || cleanPath.startsWith("/awards") ? queryId : null);

        if (nomineeId) {
          const nominee = await fetchSupabaseRecord(`nominees?id=eq.${nomineeId}&select=id,name,song_title,photo_url`);
          if (nominee && nominee.name) {
            const title = `Vote for ${nominee.name} | ZedVevo Music Awards`;
            const desc = nominee.song_title
              ? `Vote for ${nominee.name} nominated for "${nominee.song_title}" on ZedVevo Awards. Support authentic Zambian talent!`
              : `Vote for ${nominee.name} in the ZedVevo Music Awards. Every vote counts!`;
            const img = nominee.photo_url || "https://www.zedvevo.xyz/og-image.png";
            const url = `https://www.zedvevo.xyz/nominee/${nominee.id}`;
            return applyMeta(html, { title, description: desc, imageUrl: img, pageUrl: url, type: "website" });
          }
        }

        // 4. Artist matching (paths /artist/:id, /artists/:id or /artist?id=...)
        const artistPathMatch = cleanPath.match(/\/(?:artist|artists)\/([a-zA-Z0-9_-]+)/);
        const artistId = artistPathMatch ? artistPathMatch[1] : (cleanPath.startsWith("/artist") || cleanPath.startsWith("/artists") ? queryId : null);

        if (artistId) {
          const artist = await fetchSupabaseRecord(`artists?id=eq.${artistId}&select=id,name,stage_name,bio,avatar_url,cover_url,genre`);
          if (artist && (artist.name || artist.stage_name)) {
            const displayName = artist.stage_name || artist.name;
            const title = `${displayName} — Stream Music & Videos on ZedVevo`;
            const desc = artist.bio
              ? `${artist.bio.slice(0, 160)}... Listen to ${displayName} on ZedVevo.`
              : `Listen to top songs, albums, and watch official music videos by ${displayName} on ZedVevo.`;
            const img = artist.avatar_url || artist.cover_url || "https://www.zedvevo.xyz/og-image.png";
            const url = `https://www.zedvevo.xyz/artist/${artist.id}`;
            return applyMeta(html, { title, description: desc, imageUrl: img, pageUrl: url, type: "profile" });
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

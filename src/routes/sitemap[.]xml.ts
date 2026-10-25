import { createFileRoute } from "@tanstack/react-router";

// Publiczne strony do zaindeksowania; adres bierzemy z żądania, więc działa na każdej domenie (także własnej).
const PAGES: { path: string; priority: string; changefreq: string }[] = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/features", priority: "0.8", changefreq: "weekly" },
  { path: "/pricing", priority: "0.8", changefreq: "monthly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const day = new Date().toISOString().slice(0, 10);
        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          PAGES.map(
            (p) =>
              `  <url><loc>${origin}${p.path}</loc><lastmod>${day}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
          ).join("\n") +
          `\n</urlset>\n`;
        return new Response(body, {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});
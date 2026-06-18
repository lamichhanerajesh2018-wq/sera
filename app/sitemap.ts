import type { MetadataRoute } from "next";
import { SEO_PAGES } from "@/lib/seo-pages";

// Public base URL. Set NEXT_PUBLIC_SITE_URL in production (e.g. https://sera.app).
// Falls back to localhost for local dev.
const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Only public, indexable pages. Private/auth-walled routes
  // (feed, inbox, chat, notifications, settings, admin, ask, profiles)
  // are intentionally excluded — Sera is an anonymous network.
  const routes: {
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/login", changeFrequency: "monthly", priority: 0.5 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.8 },
    { path: "/communities", changeFrequency: "daily", priority: 0.7 },
    { path: "/guidelines", changeFrequency: "monthly", priority: 0.4 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  ];

  // Programmatic SEO landing pages (lib/seo-pages.ts).
  const seoRoutes = SEO_PAGES.map((p) => ({
    path: `/${p.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...routes, ...seoRoutes].map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}

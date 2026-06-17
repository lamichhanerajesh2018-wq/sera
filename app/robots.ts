import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private / auth-walled / personal routes — keep out of search.
      disallow: [
        "/feed",
        "/inbox",
        "/chat",
        "/notifications",
        "/settings",
        "/admin",
        "/ask",
        "/u/",
        "/post/",
        "/api/",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

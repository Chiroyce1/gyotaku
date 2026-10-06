import type { MetadataRoute } from "next";
import { SLUGS } from "@/lib/platforms";
import { SITE_URL } from "@/lib/site";

// Built at deploy time, so lastModified is the date the site last changed.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...SLUGS.map((os) => ({
      url: `${SITE_URL}/${os}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

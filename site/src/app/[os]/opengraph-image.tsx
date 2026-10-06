import { OG_SIZE, ogCard } from "@/lib/og-card";
import { PLATFORMS, SLUGS, type Slug } from "@/lib/platforms";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "gyotaku: Ctrl F for your screenshots, on the search window over Hokusai's Great Wave.";

export function generateStaticParams() {
  return SLUGS.map((os) => ({ os }));
}

export default async function Image({ params }: { params: Promise<{ os: string }> }) {
  const p = PLATFORMS[(await params).os as Slug];
  return ogCard([`Search your screenshots on ${p.name === "macOS" ? "Mac" : p.name}.`, "Free, open source and fully offline."]);
}

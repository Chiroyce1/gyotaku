import { OG_SIZE, ogCard } from "@/lib/og-card";

export const alt =
  "gyotaku: Ctrl F for your screenshots. The search window on Hokusai's Great Wave, one screenshot lit where the word was found.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard(["Free, open source and fully offline.", "For macOS, Windows and Linux."]);
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { FISH_LINES, FOUND_LINE } from "@/components/Mark";

// The social card, built like the page's hero: the claim on the left, and on
// the right the search window floating on Hokusai's Great Wave, one result
// lit where the word sits. Rendered once at build time.

export const alt =
  "gyotaku: Ctrl F for your screenshots. The search window on Hokusai's Great Wave, one screenshot lit where the word was found.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0a0b";
const PANEL = "#121214";
const LINE = "rgba(255, 255, 255, 0.08)";
const INK = "#ededea";
const DIM = "#a1a19b";
const SHU = "#ff7438";
const SHU_SOFT = "rgba(255, 116, 56, 0.22)";

// Three screenshots in the window: the found one first, two receded.
const TILES = [
  { title: "Fern & Co", lines: ["Your invoice is ready", "Invoice #4021", "Amount due 2,340.00"], lit: 1 },
  { title: "Bank alerts", lines: ["Your OTP is 482913", "Do not share it"], lit: -1 },
  { title: "zsh", lines: ["error[E0425]", "cannot find value"], lit: -1 },
];

export default async function Image() {
  const dir = join(process.cwd(), "assets");
  const [regular, semibold, wave] = await Promise.all([
    readFile(join(dir, "fonts/Inter-400.ttf")),
    readFile(join(dir, "fonts/Inter-600.ttf")),
    readFile(join(dir, "og-wave.jpg")),
  ]);
  const waveSrc = `data:image/jpeg;base64,${wave.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BG, color: INK, fontFamily: "Inter" }}>
        {/* The claim */}
        <div style={{ width: 560, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em" }}>
            <svg width="44" height="44" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="14" fill="#141416" />
              {FISH_LINES.map((l) => (
                <rect key={`${l.x}-${l.y}`} x={l.x} y={l.y} width={l.w} height={4} rx={2} fill={INK} />
              ))}
              <rect x={FOUND_LINE.x} y={FOUND_LINE.y} width={FOUND_LINE.w} height={4} rx={2} fill={SHU} />
            </svg>
            gyotaku
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexWrap: "wrap", fontSize: 76, fontWeight: 600, lineHeight: 1.02, letterSpacing: "-0.04em" }}>
              <span>Ctrl F for your</span>
              <span style={{ background: SHU_SOFT, borderRadius: 10, padding: "0 10px", marginLeft: -10, marginTop: 6 }}>
                screenshots
              </span>
            </div>
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", fontSize: 26, color: DIM, lineHeight: 1.4 }}>
              <span>Free, open source and fully offline.</span>
              <span>For Linux and Windows.</span>
            </div>
          </div>
        </div>

        {/* The window on the wave */}
        <div style={{ flex: 1, display: "flex", position: "relative", margin: "40px 40px 40px 0", borderRadius: 28, overflow: "hidden" }}>
          <img src={waveSrc} width={600} height={550} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "30% 40%" }} />
          <div
            style={{
              position: "absolute",
              left: 44,
              top: 64,
              width: 560,
              display: "flex",
              flexDirection: "column",
              background: PANEL,
              borderRadius: 18,
              boxShadow: "0 30px 80px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, height: 64, padding: "0 24px", borderBottom: `1px solid ${LINE}`, fontSize: 26 }}>
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke={DIM} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5 14 14" />
              </svg>
              <span>invoice</span>
              <span style={{ marginLeft: "auto", fontSize: 18, color: DIM }}>1 of 8</span>
            </div>
            <div style={{ display: "flex", gap: 12, padding: 14 }}>
              {TILES.map((t, i) => (
                <div
                  key={t.title}
                  style={{
                    flex: 1,
                    height: 190,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 14,
                    borderRadius: 10,
                    background: i === 2 ? "#0f1115" : "#ffffff",
                    color: i === 2 ? "#e6e6e6" : "#1a1a1a",
                    fontSize: 14,
                    // Receded, not greyed: faint enough to read as stepping
                    // back into the window rather than as a grey block.
                    opacity: i === 0 ? 1 : 0.14,
                    boxShadow: i === 0 ? `0 0 0 3px ${PANEL}, 0 0 0 4.5px ${SHU}` : "none",
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</span>
                  {t.lines.map((line, j) => (
                    <span
                      key={line}
                      style={
                        j === t.lit
                          ? { alignSelf: "flex-start", background: "rgba(255,116,56,0.18)", boxShadow: `inset 0 0 0 1px ${SHU}`, borderRadius: 4, padding: "1px 5px", margin: "0 -5px" }
                          : {}
                      }
                    >
                      {line}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}

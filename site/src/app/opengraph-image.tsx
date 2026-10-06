import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { FISH_LINES, FOUND_LINE } from "@/components/Mark";

// The social card, built like the page's hero: the claim on the left, and on
// the right the search window floating on Hokusai's Great Wave, one result
// lit where the word sits. Rendered once at build time.
//
// Laid out on fixed numbers rather than flex guesses, since chat apps show
// it at under half size and any slip reads as sloppy: a 40px margin on
// every side, the frame a 560 x 550 box on the right, the window centred in
// it with 40px either side.

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

const MARGIN = 40;
const FRAME = { w: 560, h: size.height - 2 * MARGIN };
const WINDOW_W = FRAME.w - 2 * 40;
const HEADER_H = 64;
const PAD = 14;
const TILE_H = 196;
const WINDOW_H = HEADER_H + 1 + PAD * 2 + TILE_H;

// Two screenshots, wide enough to read at half size: the found one, and one
// that stepped back because it doesn't hold the word.
const TILES = [
  { title: "Fern & Co", lines: ["Your invoice is ready", "Invoice #4021", "Amount due 2,340.00"], lit: 1 },
  { title: "Bank alerts", lines: ["Your OTP is 482913", "Do not share it", "with anyone"], lit: -1 },
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
        {/* The claim: mark at the frame's top edge, subline at its bottom. */}
        <div
          style={{
            width: size.width - FRAME.w - MARGIN * 2,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            // 64 + 16 leaves 480px for the headline, enough for "Ctrl F for
            // your" on one line at 76px.
            padding: `${MARGIN}px 16px ${MARGIN - 6}px 64px`,
          }}
        >
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
              <span>For macOS, Windows and Linux.</span>
            </div>
          </div>
        </div>

        {/* The window on the wave, centred in its frame. */}
        <div
          style={{
            position: "absolute",
            right: MARGIN,
            top: MARGIN,
            width: FRAME.w,
            height: FRAME.h,
            display: "flex",
            borderRadius: 28,
            overflow: "hidden",
          }}
        >
          <img
            src={waveSrc}
            width={FRAME.w}
            height={FRAME.h}
            style={{ position: "absolute", left: 0, top: 0, width: FRAME.w, height: FRAME.h, objectFit: "cover", objectPosition: "30% 40%" }}
          />
          <div
            style={{
              position: "absolute",
              left: (FRAME.w - WINDOW_W) / 2,
              top: (FRAME.h - WINDOW_H) / 2,
              width: WINDOW_W,
              height: WINDOW_H,
              display: "flex",
              flexDirection: "column",
              background: PANEL,
              borderRadius: 18,
              boxShadow: "0 30px 80px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, height: HEADER_H, padding: "0 22px", borderBottom: `1px solid ${LINE}`, fontSize: 26 }}>
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke={DIM} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5 14 14" />
              </svg>
              <span>invoice</span>
              <span style={{ marginLeft: "auto", fontSize: 18, color: DIM }}>1 of 8</span>
            </div>
            <div style={{ display: "flex", gap: 12, padding: PAD }}>
              {TILES.map((t, i) => (
                <div
                  key={t.title}
                  style={{
                    flex: 1,
                    height: TILE_H,
                    display: "flex",
                    flexDirection: "column",
                    gap: 9,
                    padding: 16,
                    borderRadius: 10,
                    // The found one is the bright paper; the other steps back
                    // into the window as a dim card with faint text, never a
                    // faded white slab.
                    background: i === 0 ? "#ffffff" : "#19191c",
                    color: i === 0 ? "#1a1a1a" : "rgba(237, 237, 234, 0.28)",
                    fontSize: 16,
                    boxShadow: i === 0 ? `0 0 0 3px ${PANEL}, 0 0 0 4.5px ${SHU}` : `inset 0 0 0 1px ${LINE}`,
                  }}
                >
                  <span style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>{t.title}</span>
                  {t.lines.map((line, j) => (
                    <span
                      key={line}
                      style={
                        j === t.lit
                          ? { alignSelf: "flex-start", background: "rgba(255,116,56,0.18)", boxShadow: `inset 0 0 0 1px ${SHU}`, borderRadius: 4, padding: "1px 6px", margin: "0 -6px" }
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

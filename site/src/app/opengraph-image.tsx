import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { FISH_LINES, FOUND_LINE } from "@/components/Mark";

// The social card: the search window mid-search, every screenshot inked dark
// but the one with the word, which stays lit where the word sits. Rendered
// once at build time.

export const alt =
  "gyotaku: ctrl f for your screenshots. A search window where every screenshot is inked dark except the one holding the word.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0e0e10";
const PANEL = "#141416";
const INK = "#ecebe7";
const DIM = "#8f8e88";
const SHU = "#ff7438";
const SHU_SOFT = "rgba(255, 116, 56, 0.16)";
const PAPER = "#f3f0e8";

// Line widths for each screenshot, as fractions of the card, so the cards
// read as different documents: a receipt, a chat, a terminal, a note.
const CARDS: number[][] = [
  [0.42, 0.78, 0.64, 0.3, 0.7],
  [0.55, 0.38, 0.72, 0.5],
  [0.8, 0.6, 0.86, 0.44, 0.66],
  [0.36, 0.7, 0.52, 0.82],
  [], // the lit one, drawn separately
  [0.62, 0.48, 0.74, 0.34, 0.58],
  [0.7, 0.4, 0.66, 0.5],
  [0.46, 0.84, 0.58, 0.72, 0.38],
  [0.6, 0.76, 0.42, 0.68],
];
const LIT = 4;

const CARD_W = 196;
const CARD_H = 148;
const GAP = 16;

export default async function Image() {
  const fonts = join(process.cwd(), "assets/fonts");
  const [regular, medium] = await Promise.all([
    readFile(join(fonts, "IBMPlexSans-400.ttf")),
    readFile(join(fonts, "IBMPlexSans-500.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BG,
          color: INK,
          fontFamily: "Plex",
        }}
      >
        {/* The window, bleeding off the right and bottom edges. */}
        <div
          style={{
            position: "absolute",
            left: 612,
            top: 96,
            width: 700,
            height: 600,
            display: "flex",
            flexDirection: "column",
            background: PANEL,
            borderRadius: 28,
            border: "1.5px solid rgba(255,255,255,0.09)",
            boxShadow: "0 40px 80px -20px rgba(0,0,0,0.7)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 76,
              padding: "0 30px",
              borderBottom: "1.5px solid rgba(255,255,255,0.07)",
              fontSize: 30,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 16 16" style={{ marginRight: 18 }}>
              <circle cx="7" cy="7" r="4.5" fill="none" stroke={DIM} strokeWidth="1.6" />
              <path d="M10.5 10.5 14 14" stroke={DIM} strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>invoice</span>
            <div style={{ width: 3, height: 34, marginLeft: 4, background: SHU, borderRadius: 2 }} />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: GAP,
              padding: 24,
              width: 3 * CARD_W + 2 * GAP + 48,
            }}
          >
            {CARDS.map((lines, i) =>
              i === LIT ? <LitCard key={i} /> : <InkedCard key={i} lines={lines} />,
            )}
          </div>
        </div>

        {/* The words. */}
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 80,
            bottom: 80,
            width: 500,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <MarkSvg size={56} />
            <span style={{ fontSize: 36, fontWeight: 500, letterSpacing: -0.8 }}>
              gyotaku
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 74,
                fontWeight: 500,
                letterSpacing: -2.6,
                lineHeight: 1.08,
              }}
            >
              <span>ctrl f for your</span>
              <div style={{ display: "flex", marginTop: 6 }}>
                <span
                  style={{
                    color: SHU,
                    background: SHU_SOFT,
                    border: `2.5px solid ${SHU}`,
                    borderRadius: 14,
                    padding: "0 14px 6px",
                    marginLeft: -17,
                  }}
                >
                  screenshots
                </span>
              </div>
            </div>
            <div style={{ display: "flex", marginTop: 40, fontSize: 27, color: DIM, letterSpacing: -0.2 }}>
              free · open source · fully offline
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}

function InkedCard({ lines }: { lines: number[] }) {
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "20px 18px",
        background: "#1a1a1d",
        borderRadius: 12,
        border: "1.5px solid rgba(255,255,255,0.05)",
      }}
    >
      {lines.map((w, j) => (
        <div
          key={j}
          style={{
            width: `${w * 100}%`,
            height: 9,
            borderRadius: 5,
            background: "#2b2b30",
          }}
        />
      ))}
    </div>
  );
}

// A screenshot on paper, veiled, with the one line holding the word lit.
function LitCard() {
  const veiled = "rgba(24,24,26,0.22)";
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "20px 18px",
        background: PAPER,
        borderRadius: 12,
        border: `3px solid ${SHU}`,
        boxShadow: `0 0 0 6px rgba(255,116,56,0.18)`,
      }}
    >
      <div style={{ width: "36%", height: 9, borderRadius: 5, background: veiled }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          alignSelf: "flex-start",
          height: 28,
          padding: "0 8px",
          marginLeft: -8,
          marginTop: -4,
          marginBottom: -4,
          borderRadius: 7,
          border: `2px solid ${SHU}`,
          background: "rgba(255,116,56,0.2)",
          color: "#18181a",
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: -0.3,
          whiteSpace: "nowrap",
        }}
      >
        Invoice #4021
      </div>
      <div style={{ width: "58%", height: 9, borderRadius: 5, background: veiled }} />
      <div style={{ width: "80%", height: 9, borderRadius: 5, background: veiled }} />
      <div style={{ width: "44%", height: 9, borderRadius: 5, background: veiled }} />
    </div>
  );
}

function MarkSvg({ size: s }: { size: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="14" fill="#1c1c1f" />
      {FISH_LINES.map((l) => (
        <rect key={`${l.x}-${l.y}`} x={l.x} y={l.y} width={l.w} height={4} rx={2} fill={INK} />
      ))}
      <circle cx={44.6} cy={25.5} r={1.1} fill="#1c1c1f" />
      <rect x={FOUND_LINE.x} y={FOUND_LINE.y} width={FOUND_LINE.w} height={4} rx={2} fill={SHU} />
    </svg>
  );
}

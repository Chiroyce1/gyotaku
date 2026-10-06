import { FISH_LINES, FOUND_LINE } from "./Mark";

// The mark pulled as a big iro-gyotaku: each line of the fish pressed in its
// own ink, edges a little rough where the paper took it unevenly, and the
// found line in shu. It sits behind the hero, off the right edge, and the
// lines press in once, one after another, after the headline has landed.

// Indigo, pine and bark yellow, in an order that never puts two of the same
// ink side by side.
const INKS = ["var(--ai)", "var(--matsu)", "var(--kihada)", "var(--ai)", "var(--matsu)", "var(--kihada)", "var(--ai)", "var(--matsu)"];

export function HeroPrint() {
  return (
    <div
      aria-hidden
      // Right of the text column, half off the page on narrower screens, so
      // it never runs under the headline.
      className="pointer-events-none absolute top-10 -right-56 -z-10 hidden w-[460px] rotate-[-5deg] opacity-80 lg:block xl:-right-44"
    >
      <svg viewBox="0 0 64 64" className="w-full overflow-visible">
        <defs>
          {/* Rough edges and a few dry specks, like ink on washi. */}
          <filter id="hero-ink" x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="grain" />
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="0.3" result="rough" />
            <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="11" result="specks" />
            {/* Only the noise's highest peaks become holes: a few dry flecks,
                not a sandpaper texture. */}
            <feColorMatrix
              in="specks"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -16 11.4"
              result="holes"
            />
            <feComposite in="rough" in2="holes" operator="in" />
          </filter>
        </defs>
        <g filter="url(#hero-ink)">
          {FISH_LINES.map((l, i) => (
            <rect
              key={`${l.x}-${l.y}`}
              className="print-line"
              // Inks through style: SVG fill attributes don't take var().
              style={{ "--i": i, fill: INKS[i], fillOpacity: 0.8 } as React.CSSProperties}
              x={l.x}
              y={l.y}
              width={l.w}
              height={4}
              rx={2}
            />
          ))}
          <rect
            className="print-line"
            style={{ "--i": FISH_LINES.length + 1, fill: "var(--shu)" } as React.CSSProperties}
            x={FOUND_LINE.x}
            y={FOUND_LINE.y}
            width={FOUND_LINE.w}
            height={4}
            rx={2}
          />
          {/* The eye, as paper showing through. */}
          <circle
            cx={44.6}
            cy={25.5}
            r={1.1}
            className="print-line"
            style={{ "--i": 3, fill: "var(--bg)" } as React.CSSProperties}
          />
        </g>
      </svg>
    </div>
  );
}

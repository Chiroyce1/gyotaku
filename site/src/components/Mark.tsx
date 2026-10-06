// The gyotaku mark: a fish printed in lines of text, with the line the search
// found in shu. The same drawing as assets/icon.svg.

import { useId } from "react";

export const FISH_LINES = [
  { x: 7, y: 10.5, w: 8 },
  { x: 11, y: 17, w: 8 },
  { x: 26, y: 17, w: 18 },
  { x: 15, y: 23.5, w: 35 },
  { x: 15, y: 36.5, w: 34 },
  { x: 11, y: 43, w: 8 },
  { x: 26, y: 43, w: 18 },
  { x: 7, y: 49.5, w: 8 },
] as const;

export const FOUND_LINE = { x: 13, y: 30, w: 44 } as const;

// The eye, cut out of the back line.
const EYE = { cx: 44.6, cy: 25.5, r: 1.1 };

export function Mark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const eye = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <rect width="64" height="64" rx="14" fill="#141416" />
      <mask id={eye}>
        <rect width="64" height="64" fill="white" />
        <circle {...EYE} fill="black" />
      </mask>
      <g fill="#ecebe7" mask={`url(#${eye})`}>
        {FISH_LINES.map((l) => (
          <rect key={`${l.x}-${l.y}`} x={l.x} y={l.y} width={l.w} height={4} rx={2} />
        ))}
      </g>
      <rect
        x={FOUND_LINE.x}
        y={FOUND_LINE.y}
        width={FOUND_LINE.w}
        height={4}
        rx={2}
        fill="#ff7438"
      />
    </svg>
  );
}

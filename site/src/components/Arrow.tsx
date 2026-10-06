// One drawn arrow, in place of text glyphs, which render at a different
// weight in every font and sit off the baseline.
const PATHS = {
  "up-right": "M5 11 11 5M6 5h5v5",
  right: "M3.5 8h9M9 4.5 12.5 8 9 11.5",
  down: "M8 3.5v9M4.5 9 8 12.5 11.5 9",
} as const;

export function Arrow({
  direction,
  className = "",
}: {
  direction: keyof typeof PATHS;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`inline-block size-3.5 shrink-0 ${className}`}
    >
      <path d={PATHS[direction]} />
    </svg>
  );
}

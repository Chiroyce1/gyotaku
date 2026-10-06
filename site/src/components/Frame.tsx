// The page is drawn as one frame: two hairline rails at the edges of the
// content column, running the whole height, and a hairline across the full
// width between sections, with a small square where they cross. Each row
// draws its own piece from the color tokens, so inside the inverted install
// band the lines take the band's colors and the rails still line up.

type RowProps = {
  children: React.ReactNode;
  /** A hairline across the full width at the bottom, with corner squares. */
  divider?: boolean;
  /** On the full-width row: a band class, sticky positioning and so on. */
  className?: string;
  /** On the framed column inside the rails. */
  inner?: string;
  as?: "div" | "section" | "header" | "footer";
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">;

export function Row({
  children,
  divider = true,
  className = "",
  inner = "",
  as: Tag = "div",
  ...rest
}: RowProps) {
  return (
    <Tag className={`relative px-3 sm:px-6 ${className}`} {...rest}>
      <div className={`relative mx-auto w-full max-w-6xl ${inner}`}>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px bg-line" />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-line" />
        {children}
        {divider && (
          <>
            {/* 7px squares centred on where the 1px rail meets the 1px
                divider: both lines sit on the column's last pixel, so an
                odd size with a 3px overhang lands exactly on the crossing. */}
            <span aria-hidden className="frame-mark pointer-events-none absolute -bottom-[3px] -left-[3px] z-10" />
            <span aria-hidden className="frame-mark pointer-events-none absolute -right-[3px] -bottom-[3px] z-10" />
          </>
        )}
      </div>
      {divider && <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-line" />}
    </Tag>
  );
}

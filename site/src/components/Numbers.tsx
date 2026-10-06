// Every figure is a measurement from docs/performance.md, on the hardware
// listed there. Keep them in step with that page.
const STATS = [
  { value: "1 to 10 ms", label: "per keystroke, across 5,000+ screenshots" },
  { value: "0.77 s", label: "from a screenshot saved to searchable" },
  { value: "~120 ms", label: "from the shortcut to the window" },
  { value: "37 MB", label: "of memory while waiting in the background" },
  { value: "~30 MB", label: "of disk per 1,000 screenshots" },
  { value: "No GPU", label: "needed, it renders in software too" },
];

export default function Numbers() {
  return (
    <section aria-labelledby="numbers" className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <h2 id="numbers" className="font-display text-[2.25rem] leading-[1.08] text-ink sm:text-5xl">
        Measured, not promised
      </h2>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-dim">
        On a laptop with over 5,000 real screenshots.
      </p>

      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-line pt-10 md:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.label} className="flex flex-col gap-2">
            <dt className="order-2 max-w-[16rem] text-sm leading-snug text-dim">{s.label}</dt>
            <dd className="font-display order-1 text-[2.1rem] leading-none text-ink tabular-nums sm:text-[2.75rem]">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>

      <a
        href="https://github.com/xevrion/gyotaku/blob/main/docs/performance.md"
        className="group mt-10 inline-flex items-center gap-1.5 text-sm text-dim transition-colors duration-150 hover:text-ink"
      >
        How these were measured
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="size-3 transition-[translate] duration-200 ease-out group-hover:translate-x-px group-hover:-translate-y-px"
        >
          <path d="M5 11 11 5M6 5h5v5" />
        </svg>
      </a>
    </section>
  );
}

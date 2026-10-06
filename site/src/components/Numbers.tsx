"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useInView } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Every figure is a measurement from docs/performance.md, on the hardware
// listed there. Keep them in step with that page.
const STATS = [
  { before: "1 to ", from: 1, to: 10, after: " ms", label: "per keystroke, across 5,000+ screenshots" },
  { before: "", to: 0.77, digits: 2, after: " s", label: "from a screenshot saved to searchable" },
  { before: "~", to: 120, after: " ms", label: "from the shortcut to the window" },
  { before: "", to: 37, after: " MB", label: "of memory while waiting in the background" },
  { before: "~", to: 30, after: " MB", label: "of disk per 1,000 screenshots" },
  { text: "no GPU", label: "needed, it renders in software too" },
] as const;

const EASE = [0.23, 1, 0.32, 1] as const;

// Each figure printed in its own ink, none twice in a row on either layout.
const INKS = ["text-shu", "text-ai", "text-matsu", "text-kihada", "text-ai", "text-shu"];

type Stat = (typeof STATS)[number];

function final(s: Stat) {
  if ("text" in s) return s.text;
  return `${s.before}${s.to.toFixed("digits" in s ? s.digits : 0)}${s.after}`;
}

// Counts up once, the first time the grid is seen. The finished figure sits
// invisibly in the same cell, so the width is right from the first frame and
// nothing shifts while the digits run.
function Figure({ stat, run }: { stat: Stat; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!run || reduce || "text" in stat || !ref.current) return;
    const el = ref.current;
    const digits = "digits" in stat ? stat.digits : 0;
    const controls = animate("from" in stat ? stat.from : 0, stat.to, {
      duration: 1.1,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = `${stat.before}${v.toFixed(digits)}${stat.after}`;
      },
    });
    return () => controls.stop();
  }, [run, reduce, stat]);

  return (
    <span className="grid">
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {final(stat)}
      </span>
      <span ref={ref} className="col-start-1 row-start-1">
        {final(stat)}
      </span>
    </span>
  );
}

export default function Numbers() {
  const reduce = useReducedMotion();
  const grid = useRef<HTMLDListElement>(null);
  const seen = useInView(grid, { once: true, margin: "0px 0px -15% 0px" });

  return (
    <section aria-labelledby="numbers" className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <h2 id="numbers" className="text-3xl font-medium tracking-[-0.025em] text-ink sm:text-4xl">
        fast where it counts
      </h2>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-dim">
        Measured, not estimated, on a laptop with real screenshots.
      </p>

      <motion.dl
        ref={grid}
        className="mt-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-line md:grid-cols-3"
        initial={reduce ? false : "hidden"}
        animate={seen ? "shown" : undefined}
        transition={{ staggerChildren: 0.06 }}
      >
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            // Hairlines between cells only: two columns on a phone, three
            // from md, never on the outer edge (the rounded border is that).
            className={`flex flex-col gap-1.5 border-line p-5 sm:p-7 ${i % 2 === 0 ? "border-r" : ""} ${
              i % 3 === 2 ? "md:border-r-0" : "md:border-r"
            } ${i < 4 ? "border-b" : ""} ${i < 3 ? "md:border-b" : "md:border-b-0"}`}
            variants={{
              hidden: { opacity: 0, transform: "translateY(8px)", filter: "blur(4px)" },
              shown: {
                opacity: 1,
                transform: "translateY(0px)",
                filter: "blur(0px)",
                transition: { duration: 0.6, ease: EASE },
              },
            }}
          >
            <dt className="order-2 text-sm leading-snug text-dim">{s.label}</dt>
            <dd
              className={`order-1 text-[1.75rem] leading-tight font-medium tracking-[-0.03em] tabular-nums sm:text-4xl ${INKS[i % INKS.length]}`}
            >
              <Figure stat={s} run={seen} />
            </dd>
          </motion.div>
        ))}
      </motion.dl>

      <a
        href="https://github.com/xevrion/gyotaku/blob/main/docs/performance.md"
        className="group mt-5 inline-flex items-center gap-1.5 text-sm text-dim transition-colors duration-150 hover:text-ink"
      >
        how these were measured
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

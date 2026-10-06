"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { FISH_LINES, FOUND_LINE } from "./Mark";

const EASE = [0.23, 1, 0.32, 1] as const;
const STEP = 0.06;

// Each line inks in from its left edge, top to bottom, like paper pressed
// onto the fish. The shu line comes last: the search landing on it.
const line = {
  hidden: { scaleX: 0 },
  shown: (i: number) => ({
    scaleX: 1,
    transition: { duration: 0.7, ease: EASE, delay: i * STEP },
  }),
};

const grow = { transformBox: "fill-box", originX: 0 } as const;

export default function Why() {
  const reduce = useReducedMotion();
  const eye = useId();

  return (
    <section
      aria-labelledby="why"
      className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[1fr_auto] md:gap-16"
    >
      <div className="max-w-xl">
        <h2 id="why" className="text-3xl font-medium tracking-[-0.025em] text-ink sm:text-4xl">
          why 魚拓
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-dim">
          Gyotaku is an old Japanese way of remembering a catch. Fishers inked
          the fish and pressed paper onto it, and the print kept it exactly as
          it was, every scale in place, long after the fish itself was gone.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-dim">
          A screenshot is a print like that, of a moment you wanted to keep.
          gyotaku keeps the words in it just as they were, so years later you
          can still find it by the one line you remember.
        </p>
      </div>

      <motion.svg
        viewBox="0 0 64 64"
        className="mx-auto size-56 shrink-0 rounded-[21.875%] sm:size-64"
        style={{ boxShadow: "var(--shadow)" }}
        role="img"
        aria-label="The gyotaku mark: a fish drawn in lines of text, one line highlighted"
        initial={reduce ? false : "hidden"}
        whileInView="shown"
        viewport={{ once: true, margin: "-80px" }}
      >
        <rect width="64" height="64" rx="14" fill="#141416" />
        <mask id={eye}>
          <rect width="64" height="64" fill="white" />
          <circle cx={44.6} cy={25.5} r={1.1} fill="black" />
        </mask>
        <g fill="#ecebe7" mask={`url(#${eye})`}>
          {FISH_LINES.map((l, i) => (
            <motion.rect
              key={`${l.x}-${l.y}`}
              x={l.x}
              y={l.y}
              width={l.w}
              height={4}
              rx={2}
              style={grow}
              variants={line}
              custom={i}
            />
          ))}
        </g>
        <motion.rect
          x={FOUND_LINE.x}
          y={FOUND_LINE.y}
          width={FOUND_LINE.w}
          height={4}
          rx={2}
          fill="#ff7438"
          style={grow}
          variants={line}
          custom={FISH_LINES.length + 3}
        />
      </motion.svg>
    </section>
  );
}

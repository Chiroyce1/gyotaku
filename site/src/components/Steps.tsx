"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { Reveal } from "./Reveal";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Three steps, each with a small plate showing the real thing it describes:
// the folder list from onboarding, the reading line the app shows while it
// works, and the keys that open the window.

const STEPS = [
  {
    title: "Pick your folders",
    body: "Pictures to start with, subfolders included. Add the one your screenshot tool saves to, or any other.",
    Plate: FoldersPlate,
  },
  {
    title: "It reads in the background",
    body: "Every screenshot is read on your CPU at idle priority, under a second after you take it. Old ones are read once and remembered.",
    Plate: ReadingPlate,
  },
  {
    title: "Press your shortcut, type",
    body: "Alt Shift S on Windows, any key you like on Linux. Results update on every keystroke, the words lit where they sit.",
    Plate: KeysPlate,
  },
];

// Each step in its own ink: pine for the folders chosen, indigo for the
// reading, shu for the moment something is found.
const INK = ["text-matsu", "text-ai", "text-shu"];

export function Steps() {
  return (
    <ol className="mt-10 grid gap-12 sm:grid-cols-3 sm:gap-6">
      {STEPS.map((s, i) => (
        <Reveal as="li" key={s.title} delay={i * 0.1} className="flex flex-col">
          <s.Plate />
          <div className="mt-6 flex items-baseline gap-3">
            <span className={`font-mono text-sm font-medium tabular-nums ${INK[i]}`}>0{i + 1}</span>
            <h3 className="text-lg font-medium text-ink">{s.title}</h3>
          </div>
          <p className="mt-2 leading-relaxed text-dim">{s.body}</p>
        </Reveal>
      ))}
    </ol>
  );
}

function Plate({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex h-36 flex-col justify-center rounded-2xl bg-panel p-4 shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-dim" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M2 4.5c0-.83.67-1.5 1.5-1.5h2.88c.4 0 .78.16 1.06.44L8.5 4.5h4c.83 0 1.5.67 1.5 1.5v5.5c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z" />
    </svg>
  );
}

function FoldersPlate() {
  return (
    <Plate className="gap-1.5">
      {["~/Pictures", "~/Pictures/Screenshots"].map((f) => (
        <div key={f} className="flex h-9 items-center gap-2.5 rounded-[10px] bg-sunk px-3 text-[13px] text-ink">
          <FolderIcon />
          <span className="truncate font-mono text-[12px]">{f}</span>
          <svg viewBox="0 0 16 16" className="ml-auto size-3.5 shrink-0 text-matsu" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        </div>
      ))}
      <div className="flex h-9 items-center gap-2.5 rounded-[10px] border border-dashed border-line px-3 text-[13px] text-dim">
        <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M8 3.5v9M3.5 8h9" />
        </svg>
        add a folder
      </div>
    </Plate>
  );
}

const TOTAL = 214;

// The reading line from the app's window: it counts through the backlog
// once when it comes into view, then settles on "up to date".
function ReadingPlate() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const count = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDone(true);
      return;
    }
    // Written straight to the DOM each frame; React only hears about the end.
    const start = performance.now();
    const ms = 2200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      const n = Math.max(1, Math.round(eased * TOTAL));
      if (count.current) count.current.textContent = String(n);
      if (bar.current) bar.current.style.transform = `scaleX(${n / TOTAL})`;
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce]);

  return (
    <div ref={ref}>
      <Plate className="gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-sunk">
            <div className="flex w-5 flex-col gap-[3px]">
              <span className="h-[3px] w-3 rounded-full bg-faint" />
              <span className="h-[3px] w-5 rounded-full bg-ai" />
              <span className="h-[3px] w-4 rounded-full bg-faint" />
            </div>
          </div>
          <div className="grid text-[13px]">
            {/* Both lines share one cell, so swapping them never moves anything. */}
            <span
              className="col-start-1 row-start-1 text-dim tabular-nums transition-[opacity,filter] duration-300 ease-[var(--ease-out)]"
              style={{ opacity: done ? 0 : 1, filter: done ? "blur(4px)" : "blur(0px)" }}
            >
              reading <span ref={count} className="text-ink">0</span> of {TOTAL}
            </span>
            <span
              className="col-start-1 row-start-1 flex items-center gap-1.5 text-ink transition-[opacity,filter] duration-300 ease-[var(--ease-out)]"
              style={{ opacity: done ? 1 : 0, filter: done ? "blur(0px)" : "blur(4px)" }}
            >
              <span className="size-1.5 rounded-full bg-matsu" />
              up to date
            </span>
          </div>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-sunk">
          <span
            ref={bar}
            className="block h-full origin-left rounded-full bg-ai transition-opacity duration-500"
            style={{ transform: done ? "scaleX(1)" : "scaleX(0)", opacity: done ? 0.35 : 1 }}
          />
        </div>
      </Plate>
    </div>
  );
}

const KEYS = ["Alt", "Shift", "S"];

// The shortcut, pressed once as it comes into view: each key goes down in
// turn, all three hold for a beat, then let go together.
function KeysPlate() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [down, setDown] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const timers = [
      setTimeout(() => setDown(1), 450),
      setTimeout(() => setDown(2), 600),
      setTimeout(() => setDown(3), 750),
      setTimeout(() => setDown(0), 1350),
    ];
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  return (
    <div ref={ref}>
      <Plate className="items-center">
        <div className="flex items-center gap-2">
          {KEYS.map((k, i) => {
            const pressed = down > i;
            return (
              <span key={k} className="flex items-center gap-2">
                {i > 0 && <span className="text-faint">+</span>}
                <kbd
                  className={`grid h-11 min-w-11 place-items-center rounded-[10px] bg-sunk px-3 font-sans text-[14px] font-medium text-ink transition-[translate,box-shadow,color] duration-100 ease-out ${
                    pressed
                      ? "translate-y-[2px] shadow-[inset_0_0_0_1px_var(--line),0_0_0_0_var(--line)]"
                      : "shadow-[inset_0_0_0_1px_var(--line),0_2px_0_0_var(--line)]"
                  } ${pressed && k === "S" ? "text-shu" : ""}`}
                >
                  {k}
                </kbd>
              </span>
            );
          })}
        </div>
      </Plate>
    </div>
  );
}

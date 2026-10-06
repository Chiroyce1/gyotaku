"use client";

import { useInView } from "motion/react";
import { useLenis } from "lenis/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

// A small gyotaku window over eight made up screenshots. Searching inks every
// screenshot dark, and only the lines with the word stay lit, the way a fish
// print keeps only what was raised.

// The last one is a misread on purpose, to show a near match.
const CHIPS = ["otp", "gate 14", "cannot find", "password", "2,340", "inv0ice"];
const LOOP = ["invoi", "otp", "gate 14", "cannot find", "password"];
const TYPE_MS = 90;
const ERASE_MS = 35;
const HOLD_MS = 1800;

// Every state change here is a CSS transition, so a fast typist retargets it
// mid flight instead of waiting for it to finish.
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const fade = (props: string) => ({
  transitionProperty: props,
  transitionDuration: "220ms",
  transitionTimingFunction: EASE,
});

const QueryContext = createContext("");
const LinesContext = createContext<readonly string[]>([]);

function matches(text: string, q: string) {
  return q !== "" && text.toLowerCase().includes(q);
}

// The look-alikes OCR mixes up, folded to one form on both sides, so a
// misread like "inv0ice" still finds the invoice. Like the app, only for
// queries of three or more characters, and only where there's no exact hit.
function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/0/g, "o")
    .replace(/[1il|]/g, "l")
    .replace(/5/g, "s");
}

type Hit = "exact" | "near" | null;

function hitOf(text: string, q: string): Hit {
  if (matches(text, q)) return "exact";
  if (q.length >= 3 && fold(text).includes(fold(q))) return "near";
  return null;
}

// One line of text in a screenshot. Matching is done on `lines[i]`, so what
// is searched is exactly what is shown, even when children lay it out.
function Line({
  i,
  className = "",
  children,
}: {
  i: number;
  className?: string;
  children?: ReactNode;
}) {
  const q = useContext(QueryContext);
  const text = useContext(LinesContext)[i];
  const hit = hitOf(text, q);
  const lit = hit !== null;
  return (
    <span className={`relative isolate block max-w-full ${lit ? "z-10" : ""} ${className}`}>
      <span
        aria-hidden
        className="absolute -inset-x-[3px] -inset-y-px -z-10 rounded-[3px] motion-reduce:transition-none"
        style={{
          ...fade("opacity, scale"),
          opacity: lit ? 1 : 0,
          scale: lit ? 1 : 0.96,
          // A highlighter stroke: shu tint over the screenshot's own paper,
          // with a hairline edge. Dashed for a near match: found, but not
          // the text as it was read.
          background: "linear-gradient(var(--shu-soft), var(--shu-soft)), var(--tile)",
          boxShadow: hit === "near" ? "none" : "inset 0 0 0 1px var(--shu)",
          outline: hit === "near" ? "1px dashed var(--shu)" : "none",
          outlineOffset: "-1px",
        }}
      />
      {children ?? text}
    </span>
  );
}

const surface = (color: string) => ({ "--tile": color, background: color }) as CSSProperties;

type Shot = {
  id: string;
  name: string;
  bg: string;
  lines: readonly string[];
  View: () => ReactNode;
};

const SHOTS: Shot[] = [
  {
    id: "invoice",
    name: "an invoice email",
    bg: "#ffffff",
    lines: [
      "Your invoice from Fern & Co",
      "Invoice #4021",
      "Amount due 2,340.00",
      "Pay now",
    ],
    View: () => (
      <div className="flex h-full flex-col p-3 text-[#1d1d1f]">
        <div className="mb-2 flex items-center gap-1.5 text-[10px]">
          <span className="grid size-4 place-items-center rounded-full bg-[#2f6b4f] text-[8px] font-semibold text-white">
            F
          </span>
          <span className="font-medium">Fern & Co</span>
          <span className="ml-auto text-[#6e6e73]">Oct 3</span>
        </div>
        <Line i={0} className="w-fit text-[12px] font-semibold leading-tight tracking-[-0.01em]" />
        <Line i={1} className="mt-0.5 w-fit text-[10px] text-[#6e6e73]" />
        <div className="mt-auto flex items-end justify-between gap-2">
          <Line i={2} className="w-fit">
            <span className="block text-[10px] text-[#6e6e73]">Amount due</span>
            <span className="block text-[13px] font-semibold tabular-nums tracking-[-0.01em]">
              2,340.00
            </span>
          </Line>
          <Line
            i={3}
            className="w-fit shrink-0 rounded-[5px] bg-[#1d1d1f] px-2 py-1 text-[10px] font-medium text-white"
          />
        </div>
      </div>
    ),
  },
  {
    id: "chat",
    name: "a text message with a code",
    bg: "#ffffff",
    lines: [
      "Bank alerts",
      "Your OTP is 482913",
      "Do not share it with anyone.",
      "got it, thanks",
    ],
    View: () => (
      <div className="flex h-full flex-col text-[10px] leading-snug">
        <div className="flex flex-col items-center gap-0.5 border-b border-black/[0.06] bg-[#f9f9fb] py-1.5" style={{ "--tile": "#f9f9fb" } as CSSProperties}>
          <span className="size-4 rounded-full bg-gradient-to-b from-[#a1a1a6] to-[#8e8e93]" />
          <Line i={0} className="w-fit text-[10px] text-[#3a3a3c]" />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <div
            className="w-[86%] rounded-[12px] rounded-bl-[4px] px-2 py-1.5 text-[#1c1c1e]"
            style={surface("#e9e9eb")}
          >
            <Line i={1} className="w-fit text-[11px] font-medium" />
            <Line i={2} className="w-fit" />
          </div>
          <div
            className="mt-auto self-end rounded-[12px] rounded-br-[4px] px-2 py-1 text-white"
            style={surface("#0a84ff")}
          >
            <Line i={3} className="w-fit" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "terminal",
    name: "a compiler error in a terminal",
    bg: "#0d0e10",
    lines: [
      "$ cargo run",
      "error[E0425]: cannot find value `config`",
      "--> src/main.rs:14:9",
      "help: a local variable with a similar name exists",
    ],
    View: () => (
      <div className="flex h-full flex-col font-mono text-[10px] leading-[1.45]">
        <div className="relative flex items-center gap-1 bg-[#1a1b1e] px-2 py-1.5" style={{ "--tile": "#1a1b1e" } as CSSProperties}>
          <span className="size-[7px] rounded-full bg-[#ff5f57]" />
          <span className="size-[7px] rounded-full bg-[#febc2e]" />
          <span className="size-[7px] rounded-full bg-[#28c840]" />
          <span className="absolute inset-x-0 text-center font-sans text-[10px] text-[#8b8f98]">
            zsh
          </span>
        </div>
        <div className="flex flex-col gap-px p-2.5">
          <Line i={0} className="w-fit text-[#c9ccd3]" />
          <Line i={1} className="w-fit font-medium text-[#ff6b6b]" />
          <Line i={2} className="w-fit pl-2 text-[#6aa7ff]" />
          <Line i={3} className="w-fit text-[#7ee2a8]" />
        </div>
      </div>
    ),
  },
  {
    id: "boarding",
    name: "a boarding pass",
    bg: "#ffffff",
    lines: ["Boarding pass", "DEL BOM", "Gate 14", "Seat 22A", "PNR K7Q2ZD"],
    View: () => (
      <div className="flex h-full flex-col text-[#14213d]">
        <div
          className="flex items-center justify-between px-3 py-1.5 text-white"
          style={surface("#1f3b73")}
        >
          <Line i={0} className="w-fit text-[10px] font-medium uppercase tracking-[0.1em]" />
          <span className="text-[10px] text-white/70">6E 2041</span>
        </div>
        <div className="flex flex-1 flex-col px-3 pt-2">
          <Line i={1} className="w-fit">
            <span className="flex items-center gap-2 text-[17px] font-semibold leading-none tracking-[-0.02em]">
              DEL
              <svg viewBox="0 0 24 24" className="size-3.5 text-[#1f3b73]/60" fill="currentColor" aria-hidden>
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" transform="rotate(90 12 12)" />
              </svg>
              BOM
            </span>
          </Line>
          <div className="mt-1 flex justify-between text-[10px] text-[#6b7280]">
            <span>Delhi</span>
            <span>Mumbai</span>
          </div>
          <div className="relative my-2 border-t border-dashed border-[#14213d]/20" />
          <div className="mt-auto flex justify-between gap-1 pb-2.5">
            {(
              [
                [2, "Gate", "14"],
                [3, "Seat", "22A"],
                [4, "PNR", "K7Q2ZD"],
              ] as const
            ).map(([i, label, value]) => (
              <Line key={i} i={i} className="w-fit">
                <span className="block text-[10px] uppercase tracking-[0.06em] text-[#6b7280]">
                  {label}
                </span>
                <span className="block text-[12px] font-semibold">{value}</span>
              </Line>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "wifi",
    name: "a wifi password",
    bg: "#ffffff",
    lines: ["Guest Wi-Fi", "Network fernhouse-5g", "Password lemon-tree-42"],
    View: () => (
      <div className="flex h-full flex-col p-3 text-[#1d1d1f]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="grid size-5 place-items-center rounded-full bg-[#e8f1ff] text-[#0a84ff]">
              <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
                <path d="M2 6.2a8.5 8.5 0 0 1 12 0M4.2 8.6a5.3 5.3 0 0 1 7.6 0M6.4 11a2.2 2.2 0 0 1 3.2 0" />
              </svg>
            </span>
            <Line i={0} className="w-fit text-[12px] font-semibold tracking-[-0.01em]" />
          </div>
          <Qr />
        </div>
        <div className="mt-auto flex flex-col rounded-[6px] text-[10px]" style={surface("#f5f5f7")}>
          <div className="px-2 py-1">
            <Line i={1} className="w-fit">
              <span className="text-[#6e6e73]">Network </span>
              <span className="font-medium">fernhouse-5g</span>
            </Line>
          </div>
          <div className="border-t border-black/[0.06] px-2 py-1">
            <Line i={2} className="w-fit">
              <span className="text-[#6e6e73]">Password </span>
              <span className="font-mono font-medium">lemon-tree-42</span>
            </Line>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "budget",
    name: "a budget spreadsheet",
    bg: "#ffffff",
    lines: ["Q3 budget", "Rent 1,200", "Travel 340", "Groceries 610", "Total 2,150"],
    View: () => (
      <div className="flex h-full flex-col text-[10px] text-[#202124]">
        <div
          className="flex items-center gap-1.5 border-b border-black/[0.08] px-2.5 py-1.5"
          style={surface("#f8f9fa")}
        >
          <span className="size-3 rounded-[2px] bg-[#1e8e3e]" />
          <Line i={0} className="w-fit text-[11px] font-medium" />
        </div>
        <div className="flex border-b border-black/[0.08] text-[#80868b]" style={surface("#f8f9fa")}>
          <span className="w-4 border-r border-black/[0.08]" />
          <span className="flex-1 border-r border-black/[0.08] text-center">A</span>
          <span className="flex-1 text-center">B</span>
        </div>
        {SHEET.map(([label, value], n) => (
          <div key={label} className="flex border-b border-black/[0.08]">
            <span className="w-4 shrink-0 border-r border-black/[0.08] text-center text-[#80868b]" style={surface("#f8f9fa")}>
              {n + 1}
            </span>
            <Line i={n + 1} className={`mx-1.5 flex flex-1 justify-between py-[3px] ${n === 3 ? "font-semibold" : ""}`}>
              <span>{label}</span>
              <span className="tabular-nums">{value}</span>
            </Line>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "list",
    name: "a shopping list",
    bg: "#fffdf6",
    lines: ["Shopping", "oat milk", "basil", "eggs x12", "dish soap"],
    View: () => (
      <div className="flex h-full flex-col p-3 text-[11px] text-[#2b2618]">
        <div className="mb-1.5 flex items-baseline justify-between">
          <Line i={0} className="w-fit text-[12px] font-semibold tracking-[-0.01em]" />
          <span className="text-[10px] text-[#7d7350]">4 items</span>
        </div>
        <div className="flex flex-col gap-1">
          {[1, 2, 3, 4].map((i) => {
            const done = i === 2;
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span
                  className={`grid size-3 shrink-0 place-items-center rounded-full border ${
                    done ? "border-[#e5a50a] bg-[#e5a50a]" : "border-[#2b2618]/30"
                  }`}
                >
                  {done && (
                    <svg viewBox="0 0 12 12" className="size-2 text-white" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="m3 6.2 2 2 4-4.4" />
                    </svg>
                  )}
                </span>
                <Line i={i} className={`w-fit ${done ? "text-[#2b2618]/45 line-through" : ""}`} />
              </div>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    id: "address",
    name: "a delivery address on a map",
    bg: "#e8eee4",
    lines: ["Delivery address", "221 Lake Road", "Jodhpur 342030", "Call on arrival"],
    View: () => (
      <div className="relative flex h-full flex-col justify-end p-2 text-[#1d1d1f]">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute left-[18%] top-[6%] h-8 w-12 rounded-[4px] bg-[#d3e3c8]" />
          <div className="absolute right-[6%] top-[4%] h-6 w-9 rounded-[4px] bg-[#cfe0f2]" />
          <div className="absolute -left-4 top-[34%] h-2.5 w-[140%] -rotate-12 bg-white" />
          <div className="absolute left-[60%] -top-4 h-[140%] w-2 rotate-6 bg-white" />
          <span className="absolute left-[57%] top-[16%] size-3 rounded-full bg-[#e5484d] shadow-[0_1px_3px_rgb(0_0_0/0.3)] ring-2 ring-white" />
        </div>
        <div
          className="relative rounded-[6px] px-2 py-1.5 shadow-[0_1px_3px_rgb(0_0_0/0.14)]"
          style={surface("#ffffff")}
        >
          <Line i={0} className="w-fit text-[10px] text-[#6e6e73]" />
          <Line i={1} className="w-fit text-[12px] font-semibold tracking-[-0.01em]" />
          <Line i={2} className="w-fit text-[10px]" />
          <Line i={3} className="w-fit text-[10px] text-[#6e6e73]" />
        </div>
      </div>
    ),
  },
];

const SHEET = [
  ["Rent", "1,200"],
  ["Travel", "340"],
  ["Groceries", "610"],
  ["Total", "2,150"],
] as const;

// A made up QR code from a fixed pattern, so it never changes between renders.
const QR = "1110111100101101011100111010101001101111010111011";
function Qr() {
  return (
    <div
      className="grid size-10 shrink-0 grid-cols-7 gap-px rounded-[3px] bg-white p-0.5 ring-1 ring-black/[0.08]"
      aria-hidden
    >
      {QR.split("").map((c, i) => (
        <span key={i} className={c === "1" ? "rounded-[0.5px] bg-[#1d1d1f]" : ""} />
      ))}
    </div>
  );
}

// A match stays exactly as bright as it was, ringed in shu with its line
// highlighted. Everything else recedes: faded and drained of color, so the
// eye lands on the one that's lit. Nothing is ever veiled grey.
function Tile({ shot, q }: { shot: Shot; q: string }) {
  const hit = q !== "" && shot.lines.some((l) => hitOf(l, q) !== null);
  const recede = q !== "" && !hit;
  return (
    <LinesContext.Provider value={shot.lines}>
      <div
        role="img"
        aria-label={`Screenshot of ${shot.name}${hit ? ", matches" : ""}`}
        className="relative aspect-[4/3] overflow-hidden rounded-[6px] outline outline-1 -outline-offset-1 outline-[var(--outline)] motion-reduce:transition-none"
        style={{
          ...surface(shot.bg),
          ...fade("opacity, filter, scale, box-shadow"),
          opacity: recede ? 0.32 : 1,
          filter: recede ? "grayscale(1)" : "grayscale(0)",
          scale: recede ? 0.985 : 1,
          // The ring sits just outside the tile, with a sliver of window
          // between, so it reads as a selection and not a border.
          boxShadow: hit
            ? "0 0 0 2px var(--panel), 0 0 0 3.5px var(--shu)"
            : "0 0 0 2px transparent, 0 0 0 3.5px transparent",
        }}
      >
        <shot.View />
      </div>
    </LinesContext.Provider>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.75" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  );
}

// `onWallpaper`: the window sits on a busy picture (the hero's print), so it
// takes a deeper, crisper shadow and the chips under it turn to glass to
// stay readable over the image.
export default function SearchDemo({ onWallpaper = false }: { onWallpaper?: boolean }) {
  const [query, setQuery] = useState("");
  const [stopped, setStopped] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inView = useInView(root, { amount: 0.4 });
  const reduce = useReducedMotion();
  const lenis = useLenis();
  // Where the loop is, kept across pauses so it picks up mid word.
  const at = useRef({ word: 0, chars: 0, erasing: false });

  const q = query.trim().toLowerCase();
  const exact = q ? SHOTS.filter((s) => s.lines.some((l) => matches(l, q))).length : SHOTS.length;
  const near = q
    ? SHOTS.filter(
        (s) => !s.lines.some((l) => matches(l, q)) && s.lines.some((l) => hitOf(l, q) === "near"),
      ).length
    : 0;

  // Types a few searches over and over while the window is on screen, like
  // someone showing it off. The visitor touching anything ends it for good.
  useEffect(() => {
    if (!inView || reduce || stopped) return;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const p = at.current;
      const word = LOOP[p.word];
      let wait: number;
      // The first two letters land together and leave together: one letter
      // matches nearly every line, and the loop would flash every ring on
      // the page at the start of each word.
      if (!p.erasing) {
        p.chars += p.chars === 0 ? 2 : 1;
        if (p.chars >= word.length) {
          p.erasing = true;
          wait = HOLD_MS;
        } else {
          wait = TYPE_MS;
        }
      } else {
        p.chars = p.chars > 2 ? p.chars - 1 : 0;
        if (p.chars <= 0) {
          p.erasing = false;
          p.word = (p.word + 1) % LOOP.length;
          wait = 450;
        } else {
          wait = ERASE_MS;
        }
      }
      setQuery(word.slice(0, Math.max(p.chars, 0)));
      timer = setTimeout(step, wait);
    };
    timer = setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, [inView, reduce, stopped]);

  // "/" anywhere on the page puts you in the search box, like most search
  // fields on the web, unless you're already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      setStopped(true);
      const el = input.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      // Through Lenis when it's running, so the glide matches every other
      // scroll on the page; it already goes instant under reduced motion.
      // An absolute target from the live scroll position: given the element,
      // Lenis measures from its own cached position, which can lag behind.
      const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3;
      if (lenis) lenis.scrollTo(Math.max(0, Math.round(top)));
      else el.scrollIntoView({ block: "center" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lenis]);

  const stop = () => setStopped(true);
  const choose = (word: string) => {
    stop();
    setQuery((current) => (current.trim().toLowerCase() === word ? "" : word));
  };

  return (
    <div ref={root} className="w-full">
      <div
        className={`overflow-hidden rounded-2xl bg-panel ${
          onWallpaper
            ? "shadow-[0_30px_80px_-20px_rgb(0_0_0/0.55),0_0_0_1px_rgb(255_255_255/0.08)]"
            : "shadow-[var(--shadow)]"
        }`}
      >
        <label className="flex h-12 items-center gap-3 border-b border-line px-4">
          <SearchIcon />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              stop();
              setQuery(e.target.value);
            }}
            onFocus={stop}
            onPointerDown={stop}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            placeholder={`search ${SHOTS.length} screenshots`}
            aria-label="Search the example screenshots"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-base text-ink caret-[var(--shu)] outline-none placeholder:text-faint sm:text-[15px]"
          />
          {/* On a phone the resting "8 screenshots" would crowd the
              placeholder, so the count only appears once there's a search. */}
          <span
            aria-live={stopped ? "polite" : "off"}
            className="shrink-0 text-right text-[13px] tabular-nums text-dim sm:min-w-[6.75rem]"
          >
            {q ? (
              near ? (
                `${exact ? `${exact} of ${SHOTS.length}, ` : ""}${near} near`
              ) : (
                `${exact} of ${SHOTS.length}`
              )
            ) : (
              <span className="hidden sm:inline">{SHOTS.length} screenshots</span>
            )}
          </span>
          <kbd
            title="Press / to search"
            className="hidden h-6 min-w-6 items-center justify-center rounded-[6px] bg-sunk px-1.5 font-mono text-[12px] text-dim shadow-[inset_0_-1px_0_var(--line)] [@media(hover:hover)_and_(pointer:fine)]:flex"
          >
            /
          </kbd>
        </label>

        <QueryContext.Provider value={q}>
          <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-4">
            {SHOTS.map((shot) => (
              <Tile key={shot.id} shot={shot} q={q} />
            ))}
          </div>
        </QueryContext.Provider>
      </div>

      {/* One row that slides sideways on a phone instead of wrapping a lone
          chip onto a second line. */}
      <div className="-mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] [scrollbar-width:none] sm:mx-0 sm:justify-center sm:overflow-visible sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden">
        {/* On the wallpaper the label is dropped: the solid chips say it. */}
        {!onWallpaper && <span className="mr-1 shrink-0 text-[13px] text-dim">try</span>}
        {CHIPS.map((chip) => {
          const on = stopped && q === chip;
          // On the wallpaper, solid and opaque so they read over any part of
          // the picture, never see-through.
          const look = onWallpaper
            ? on
              ? "border-transparent bg-shu text-[var(--on-shu)]"
              : "border-white/10 bg-[#111113] text-white/85 hover:text-white"
            : on
              ? "border-[color-mix(in_oklab,var(--shu)_45%,transparent)] bg-shu-soft text-shu"
              : "border-line text-dim hover:text-ink";
          return (
            <button
              key={chip}
              type="button"
              onClick={() => choose(chip)}
              aria-pressed={on}
              className={`press h-8 shrink-0 rounded-full border px-3 text-[13px] ${look}`}
              style={{
                transition:
                  "scale 160ms var(--ease-out), color 150ms ease, border-color 150ms ease, background-color 150ms ease",
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}

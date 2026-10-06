"use client";

// Every feature as a small working piece of the app, not a picture of it:
// each card's demo behaves the way gyotaku does (same rules, same keys), so
// poking it is the explanation. Facts follow docs/usage.md.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, MotionConfig, motion, useInView } from "motion/react";
import { Noto_Sans_Devanagari } from "next/font/google";
import { Reveal } from "./Reveal";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// Only this card needs it, so it never blocks the first paint.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500"],
  preload: false,
});

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const SPRING = { type: "spring", duration: 0.3, bounce: 0 } as const;
const ICON_IN = { scale: 1, opacity: 1, filter: "blur(0px)" };
const ICON_OUT = { scale: 0.25, opacity: 0, filter: "blur(4px)" };

type Ink = "shu" | "ai" | "kihada" | "matsu";
const INK_BG: Record<Ink, string> = {
  shu: "bg-shu",
  ai: "bg-ai",
  kihada: "bg-kihada",
  matsu: "bg-matsu",
};

// Screenshots inside the demos keep their own colors in both themes, like a
// real screenshot would.
const PAPER = "#ffffff";
const PAPER_INK = "#1c1c1e";
const PAPER_DIM = "#6e6e73";

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Card({
  ink,
  title,
  body,
  wide,
  height = 232,
  delay = 0,
  children,
}: {
  ink: Ink;
  title: string;
  body: ReactNode;
  wide?: boolean;
  height?: number;
  delay?: number;
  children: ReactNode;
}) {
  const [touched, setTouched] = useState(false);
  const touch = () => setTouched(true);
  return (
    <Reveal
      as="li"
      delay={delay}
      className={`flex flex-col rounded-2xl bg-panel p-1.5 shadow-[var(--shadow)] ${wide ? "md:col-span-2" : ""}`}
    >
      {/* Radius 10 inside the card's 16, across its 6px of padding. */}
      <div
        className="relative overflow-hidden rounded-[10px] bg-sunk"
        style={{ height }}
        onPointerDownCapture={touch}
        onKeyDownCapture={touch}
        onFocusCapture={touch}
      >
        {children}
      </div>
      <div className="flex flex-col gap-1.5 px-4 pt-4 pb-5">
        <h3 className="flex items-center gap-2.5 font-medium text-ink">
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${INK_BG[ink]}`} />
          {title}
          <span
            aria-hidden
            className="ml-auto flex items-center gap-1 text-[12px] font-normal text-faint transition-opacity duration-200"
            style={{ opacity: touched ? 0 : 1 }}
          >
            <PointerIcon />
            try it
          </span>
        </h3>
        <p className="text-[15px] leading-relaxed text-dim">{body}</p>
      </div>
    </Reveal>
  );
}

function Kbd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-panel px-1.5 font-mono text-[11px] leading-none text-dim shadow-[0_0_0_1px_var(--line),inset_0_-1px_0_var(--line)] ${className}`}
    >
      {children}
    </kbd>
  );
}

// Key hints only where there's a keyboard to press them on.
function KeyHint({ children }: { children: ReactNode }) {
  return (
    <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline-flex">
      <Kbd className="h-4 min-w-4 px-1 text-[10px]">{children}</Kbd>
    </span>
  );
}

// A small no, for a refused input: a quick shake, done with the Web
// Animations API so it replays on every refusal.
function shake(el: Element | null) {
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [{ translate: "0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "-2px 0" }, { translate: "0" }],
    { duration: 280, easing: EASE },
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-[5px] bg-sunk px-1 py-px font-mono text-[13px] text-ink">{children}</code>;
}

function Toast({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-2.5 z-30 flex justify-center"
    >
      <div
        className="flex h-8 items-center gap-2 rounded-full bg-panel px-3 text-[13px] text-ink shadow-[var(--shadow)]"
        style={{
          opacity: show ? 1 : 0,
          transform: show ? "translateY(0)" : "translateY(6px)",
          transition: `opacity 200ms ${EASE}, transform 200ms ${EASE}`,
        }}
      >
        {show ? children : null}
      </div>
    </div>
  );
}

// A short-lived message: shows, then goes on its own.
function useFlash(ms = 1600) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback(
    (t: string) => {
      setText(t);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setText(null), ms);
    },
    [ms],
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return [text, flash] as const;
}

function SearchIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden className={`shrink-0 ${className}`}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </svg>
  );
}

function CheckIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function PointerIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" aria-hidden className="size-3">
      <path d="M4 2.5v9.25l2.4-2.1 1.7 3.85 1.6-.7-1.7-3.8 3.25-.3Z" />
    </svg>
  );
}

function FolderIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M2 4.5c0-.83.67-1.5 1.5-1.5h2.88c.4 0 .78.16 1.06.44L8.5 4.5h4c.83 0 1.5.67 1.5 1.5v5.5c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z" />
    </svg>
  );
}

// A line lit the way the app lights a match: shu ring on a soft wash, solid
// when it's the text as read, dashed when it's a near match.
function lit(kind: "exact" | "near" | null, paper = PAPER): CSSProperties {
  return {
    position: "relative",
    zIndex: 10,
    borderRadius: 3,
    margin: "0 -3px",
    padding: "0 3px",
    background: kind ? `linear-gradient(var(--shu-soft), var(--shu-soft)), ${paper}` : undefined,
    outline: kind === "near" ? "1.5px dashed var(--shu)" : kind ? "1.5px solid var(--shu)" : "1.5px solid transparent",
    transition: `outline-color 200ms ${EASE}, background-color 200ms ${EASE}`,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Near matches                                                     */
/* ------------------------------------------------------------------ */

// The same look-alike folding the app's index does: case, 0 and o, l 1 i |,
// 5 and s, 8 and b, rn for m, vv for w, cl for d.
function fold(s: string) {
  return s
    .toLowerCase()
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/cl/g, "d")
    .replace(/0/g, "o")
    .replace(/[1|!i]/g, "l")
    .replace(/5/g, "s")
    .replace(/8/g, "b");
}

type Hit = "exact" | "near" | null;
function hitOf(line: string, q: string): Hit {
  if (!q) return null;
  if (line.toLowerCase().includes(q)) return "exact";
  // Words under four characters only ever match exactly.
  if (q.replace(/\s/g, "").length >= 4 && fold(line).includes(fold(q))) return "near";
  return null;
}

const NEAR_SHOTS = [
  {
    id: "mail",
    head: "Fern & Co",
    lines: ["Invoice #4021", "Amount due 2,340.00"],
  },
  {
    id: "order",
    head: "Order confirmed",
    // Read with a lowercase l for the capital I, the commonest misread there is.
    lines: ["lnvoice #3907", "Paid with UPI"],
  },
  {
    id: "chat",
    head: "Mum",
    lines: ["call me when you land", "ok, at the gate"],
  },
] as const;

const RANK: Record<string, number> = { exact: 0, near: 1, none: 2 };

function NearDemo() {
  const [query, setQuery] = useState("invoice");
  const q = query.trim().toLowerCase();

  const shots = NEAR_SHOTS.map((s) => {
    const hits = s.lines.map((l) => hitOf(l, q));
    const best: Hit = hits.includes("exact") ? "exact" : hits.includes("near") ? "near" : null;
    return { ...s, hits, best };
  });
  // Exact matches always come first, near ones after, the rest sink.
  const ordered = q
    ? [...shots].sort((a, b) => RANK[a.best ?? "none"] - RANK[b.best ?? "none"])
    : shots;
  const exact = shots.filter((s) => s.best === "exact").length;
  const near = shots.filter((s) => s.best === "near").length;

  return (
    <div className="flex h-full flex-col">
      <label className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-3.5 text-dim">
        <SearchIcon />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-label="Search the three example screenshots"
          className="min-w-0 flex-1 bg-transparent text-base text-ink caret-[var(--shu)] outline-none placeholder:text-faint sm:text-[14px]"
          placeholder="search 3 screenshots"
        />
        <span className="shrink-0 text-[12px] tabular-nums" aria-live="polite">
          {!q ? "3 screenshots" : exact + near === 0 ? "none" : `${exact} exact${near ? `, ${near} near` : ""}`}
        </span>
      </label>

      <div className="grid flex-1 grid-cols-3 gap-2 p-2.5">
        {ordered.map((s) => (
          <motion.div
            layout
            transition={SPRING}
            key={s.id}
            className="relative overflow-hidden rounded-[6px] p-2 sm:p-3"
            style={{ background: PAPER, color: PAPER_INK }}
          >
            <p className="truncate text-[11px] font-semibold sm:text-[12px]">{s.head}</p>
            <div className="mt-1.5 flex flex-col items-start gap-1 text-[10px] sm:text-[12px]">
              {s.lines.map((l, i) => (
                <span key={l} className="max-w-full truncate" style={lit(s.hits[i])}>
                  {l}
                </span>
              ))}
            </div>
            {/* The veil over a match, under its lit line; screenshots
                without the word sink into the window. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[5] bg-[#0b0b0c]/55"
              style={{ opacity: s.best ? 1 : 0, transition: `opacity 220ms ${EASE}` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[20] bg-sunk"
              style={{ opacity: q && !s.best ? 0.86 : 0, transition: `opacity 220ms ${EASE}` }}
            />
            <span
              className="absolute bottom-1.5 left-1.5 z-[25] rounded-full bg-panel px-1.5 py-0.5 text-[10px] text-dim shadow-[0_0_0_1px_var(--line)] sm:bottom-2 sm:left-2"
              style={{
                opacity: s.best === "near" ? 1 : 0,
                transform: s.best === "near" ? "scale(1)" : "scale(0.96)",
                transition: `opacity 200ms ${EASE}, transform 200ms ${EASE}`,
              }}
            >
              near match
            </span>
          </motion.div>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-2.5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {["invoice", "inv0ice", "#4021", "gate"].map((c) => {
          const on = q === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => setQuery(on ? "" : c)}
              className={`press h-7 shrink-0 rounded-full border px-2.5 font-mono text-[12px] ${
                on ? "border-transparent bg-shu-soft text-shu" : "border-line text-dim hover:text-ink"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Filters                                                          */
/* ------------------------------------------------------------------ */

const DATES: Record<string, number> = { today: 0, yesterday: 1, week: 6 };

const ROWS = [
  { folder: "Discord", age: 0, text: "error: cannot find module 'sharp'" },
  { folder: "Discord", age: 1, text: "build error on main, see the logs" },
  { folder: "Screenshots", age: 1, text: "Error 502 Bad Gateway" },
  { folder: "Discord", age: 3, text: "lunch at 1? the usual place" },
  { folder: "Screenshots", age: 0, text: "Invoice #4021, amount due" },
  { folder: "Downloads", age: 9, text: "error rate 0.2% over the week" },
] as const;

const AGE = ["today", "yesterday", "", "3 days ago", "", "", "", "", "", "last week"];

type Token = { text: string; filter: boolean };

function parseQuery(q: string) {
  const tokens: Token[] = [];
  const words: string[] = [];
  let folder: string | null = null;
  let within: [number, number] | null = null;
  for (const part of q.split(/(\s+)/)) {
    const m = /^(in|date):(.*)$/i.exec(part);
    if (!m) {
      tokens.push({ text: part, filter: false });
      if (part.trim()) words.push(part.toLowerCase());
      continue;
    }
    const [, key, value] = m;
    const v = value.toLowerCase();
    if (key.toLowerCase() === "in" && v) {
      folder = v;
      tokens.push({ text: part, filter: true });
    } else if (key.toLowerCase() === "date" && v in DATES) {
      within = v === "week" ? [0, 6] : [DATES[v], DATES[v]];
      tokens.push({ text: part, filter: true });
    } else {
      // Half typed, like date:yes on the way to yesterday: ignored, not
      // searched, so the results don't empty while it's typed.
      tokens.push({ text: part, filter: false });
    }
  }
  return { tokens, words, folder, within };
}

function FiltersDemo() {
  const [query, setQuery] = useState("error in:discord");
  const mirror = useRef<HTMLDivElement>(null);
  const { tokens, words, folder, within } = parseQuery(query);

  const matches = ROWS.map(
    (r) =>
      words.every((w) => r.text.toLowerCase().includes(w)) &&
      (!folder || r.folder.toLowerCase().startsWith(folder)) &&
      (!within || (r.age >= within[0] && r.age <= within[1])),
  );
  const count = matches.filter(Boolean).length;

  const toggle = (chip: string) => {
    const key = chip.split(":")[0];
    const parts = query.split(/\s+/).filter(Boolean);
    const has = parts.includes(chip);
    const next = parts.filter((p) => !p.toLowerCase().startsWith(`${key}:`));
    if (!has) next.push(chip);
    setQuery(next.join(" "));
  };

  return (
    <div className="flex h-full flex-col">
      <label className="relative flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-3.5 text-dim">
        <SearchIcon />
        <span className="relative min-w-0 flex-1">
          {/* The input's own text is invisible; this copy behind it draws
              the same words, with finished filters dimmed like the app. */}
          <div
            ref={mirror}
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-base whitespace-pre sm:text-[14px]"
          >
            {tokens.map((t, i) => (
              <span
                key={i}
                className={t.filter ? "text-faint" : "text-ink"}
                style={{ transition: `color 150ms ${EASE}` }}
              >
                {t.text}
              </span>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onScroll={(e) => {
              if (mirror.current) mirror.current.scrollLeft = e.currentTarget.scrollLeft;
            }}
            spellCheck={false}
            autoComplete="off"
            aria-label="Search with filters"
            className="relative w-full bg-transparent text-base text-transparent caret-[var(--ai)] outline-none selection:bg-ai-soft sm:text-[14px]"
          />
        </span>
        <span className="shrink-0 text-[12px] tabular-nums" aria-live="polite">
          {count} of {ROWS.length}
        </span>
      </label>

      <ul className="flex flex-1 flex-col justify-center gap-0.5 px-2.5 py-2">
        {ROWS.map((r, i) => (
          <li
            key={r.text}
            className="relative flex h-6 items-center gap-2.5 rounded-[6px] pr-2 pl-3 text-[12px]"
            style={{
              opacity: matches[i] ? 1 : 0.32,
              transition: `opacity 200ms ${EASE}`,
            }}
          >
            <span
              aria-hidden
              className="absolute top-1.5 bottom-1.5 left-0 w-[2px] origin-center rounded-full bg-ai"
              style={{
                transform: matches[i] ? "scaleY(1)" : "scaleY(0.3)",
                opacity: matches[i] ? 1 : 0,
                transition: `transform 220ms ${EASE}, opacity 220ms ${EASE}`,
              }}
            />
            <span className="w-[78px] shrink-0 truncate font-mono text-[11px] text-faint">{r.folder}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{r.text}</span>
            <span className="hidden shrink-0 text-[11px] text-faint min-[420px]:block">{AGE[r.age]}</span>
          </li>
        ))}
      </ul>

      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-2.5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {["in:discord", "in:screenshots", "date:yesterday", "date:week"].map((c) => {
          const on = query.split(/\s+/).includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c)}
              className={`press h-7 shrink-0 rounded-full border px-2.5 font-mono text-[12px] ${
                on ? "border-transparent bg-ai-soft text-ai" : "border-line text-dim hover:text-ink"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Bulk trash with undo                                             */
/* ------------------------------------------------------------------ */

const OTPS = [
  { id: 1, from: "HDFC Bank", code: "482913" },
  { id: 2, from: "Swiggy", code: "7731" },
  { id: 3, from: "Google", code: "G-305118" },
  { id: 4, from: "Zomato", code: "6620" },
];

function TrashDemo() {
  const [here, setHere] = useState(OTPS.map((o) => o.id));
  const [marked, setMarked] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [moved, setMoved] = useState<number[] | null>(null);

  const toggle = (id: number) => {
    setConfirming(false);
    setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  };
  const markAll = () => {
    setConfirming(false);
    setMarked(here);
  };
  const trash = () => {
    if (!marked.length) return;
    if (!confirming) {
      // Like the app: always asked once, with the count.
      setConfirming(true);
      return;
    }
    setHere((h) => h.filter((id) => !marked.includes(id)));
    setMoved(marked);
    setMarked([]);
    setConfirming(false);
  };
  const undo = () => {
    if (!moved) return;
    setHere(OTPS.map((o) => o.id).filter((id) => here.includes(id) || moved.includes(id)));
    setMoved(null);
  };
  const escape = () => {
    if (confirming) setConfirming(false);
    else setMarked([]);
  };

  const onKey = (e: ReactKeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && e.shiftKey && k === "a") markAll();
    else if (mod && (k === "delete" || k === "backspace")) trash();
    else if (k === "enter" && confirming) trash();
    else if (mod && k === "z") undo();
    else if (k === "escape") escape();
    else return;
    e.preventDefault();
  };

  const n = marked.length;

  return (
    <div
      role="group"
      aria-label="Example search for otp. Keys: Ctrl Shift A marks all, Ctrl Delete moves to the trash, Ctrl Z puts them back."
      tabIndex={0}
      onKeyDown={onKey}
      className="flex h-full flex-col outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-kihada"
    >
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-3.5 text-dim">
        <SearchIcon />
        <span className="flex-1 text-[14px] text-ink">otp</span>
        <button
          type="button"
          onClick={markAll}
          disabled={!here.length}
          className="press flex h-7 items-center gap-1.5 rounded-full border border-line px-2.5 text-[12px] text-dim hover:text-ink disabled:opacity-40"
        >
          mark all
          <KeyHint>ctrl shift a</KeyHint>
        </button>
      </div>

      <div className="relative flex-1 p-2.5">
        <ul className="grid h-full grid-cols-4 gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {OTPS.filter((o) => here.includes(o.id)).map((o) => {
              const on = marked.includes(o.id);
              return (
                <motion.li
                  key={o.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, y: 4, transition: { duration: 0.18 } }}
                  transition={SPRING}
                  className="h-[96px]"
                >
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${o.from} one-time code`}
                    onClick={() => toggle(o.id)}
                    className="press relative flex size-full flex-col rounded-[6px] p-2 text-left"
                    style={{
                      background: PAPER,
                      color: PAPER_INK,
                      outline: on ? "2px solid var(--kihada)" : "2px solid transparent",
                      outlineOffset: 1,
                      transition: `outline-color 150ms ${EASE}, scale 160ms ${EASE}`,
                    }}
                  >
                    <span className="truncate text-[10px]" style={{ color: PAPER_DIM }}>
                      {o.from}
                    </span>
                    <span className="mt-1 text-[10px] leading-tight">Your OTP is</span>
                    <span className="truncate font-mono text-[12px] font-semibold tracking-wide">{o.code}</span>
                    <motion.span
                      aria-hidden
                      className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-kihada text-white"
                      initial={false}
                      animate={on ? ICON_IN : ICON_OUT}
                      transition={SPRING}
                    >
                      <CheckIcon className="size-2.5" />
                    </motion.span>
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {!here.length && (
          <p className="absolute inset-0 grid place-items-center text-[13px] text-faint">nothing left, all in the trash</p>
        )}

        {/* The mark bar, and the confirmation it turns into. */}
        <div
          className="absolute inset-x-2.5 bottom-2.5 z-20 flex h-10 items-center gap-2 rounded-[8px] bg-panel pr-1.5 pl-3 text-[13px] shadow-[var(--shadow)]"
          style={{
            opacity: n ? 1 : 0,
            transform: n ? "translateY(0)" : "translateY(8px)",
            pointerEvents: n ? "auto" : "none",
            transition: `opacity 200ms ${EASE}, transform 200ms ${EASE}`,
          }}
        >
          <span className="flex-1 text-ink tabular-nums">
            {confirming ? `move ${n} to the trash?` : `${n} marked`}
          </span>
          <button
            type="button"
            onClick={trash}
            className="press flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium"
            style={{
              background: confirming ? "var(--kihada)" : "var(--sunk)",
              color: confirming ? "#fff" : "var(--ink)",
              transition: `background-color 150ms ${EASE}, color 150ms ${EASE}, scale 160ms ${EASE}`,
            }}
          >
            {confirming ? "move" : "to the trash"}
            <span className="hidden font-mono text-[10px] opacity-70 [@media(hover:hover)_and_(pointer:fine)]:inline">
              {confirming ? "enter" : "ctrl del"}
            </span>
          </button>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="absolute inset-x-2.5 bottom-2.5 z-10 flex h-10 items-center gap-2 rounded-[8px] bg-panel pr-1.5 pl-3 text-[13px] shadow-[var(--shadow)]"
          style={{
            opacity: moved && !n ? 1 : 0,
            transform: moved && !n ? "translateY(0)" : "translateY(8px)",
            pointerEvents: moved && !n ? "auto" : "none",
            transition: `opacity 200ms ${EASE}, transform 200ms ${EASE}`,
          }}
        >
          <span className="flex-1 text-ink">{moved ? `moved ${moved.length} to the trash` : ""}</span>
          <button
            type="button"
            onClick={undo}
            className="press flex h-7 items-center gap-1.5 rounded-[6px] bg-sunk px-2.5 text-[12px] font-medium text-ink"
          >
            undo
            <span className="hidden font-mono text-[10px] text-dim [@media(hover:hover)_and_(pointer:fine)]:inline">ctrl z</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Similar screenshots fold into one                                */
/* ------------------------------------------------------------------ */

const BURST = 4;
const W = 76;
const H = 104;
const STEP = 86;

// Folded: stacked behind the newest, each a little askew. Unfolded: in a
// row, the rest right after it.
function burstPose(i: number, open: boolean) {
  if (open) return { x: (i - (BURST - 1) / 2) * STEP - W / 2, y: 0, rotate: 0 };
  const tilt = [0, -5, 4, -2][i];
  return { x: -W / 2 + i * 5, y: -i * 4, rotate: tilt };
}

function BurstDemo() {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const seen = useInView(root, { once: true, amount: 0.7 });
  const reduce = useReducedMotion();

  // Shown once, unprompted: it unfolds, holds, folds back. Touching the card
  // first skips it.
  useEffect(() => {
    if (!seen || reduce || touched) return;
    const a = setTimeout(() => setOpen(true), 900);
    const b = setTimeout(() => setOpen(false), 2700);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [seen, reduce, touched]);

  const flip = () => {
    setTouched(true);
    setOpen((o) => !o);
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label="Four similar screenshots. Ctrl E shows or hides them."
      tabIndex={0}
      onPointerDown={() => setTouched(true)}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
          e.preventDefault();
          flip();
        }
      }}
      className="relative h-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-matsu"
    >
      <div className="absolute top-1/2 left-1/2" style={{ marginTop: -H / 2 - 8 }}>
        {Array.from({ length: BURST }, (_, i) => BURST - 1 - i).map((i) => (
          <motion.div
            key={i}
            className="absolute top-0 left-0 overflow-hidden rounded-[6px] shadow-[0_1px_2px_rgb(0_0_0/0.12),0_6px_14px_-6px_rgb(0_0_0/0.3)]"
            style={{ width: W, height: H, background: PAPER, zIndex: BURST - i }}
            initial={false}
            animate={burstPose(i, open)}
            transition={{ type: "spring", duration: 0.45, bounce: 0, delay: open ? i * 0.03 : (BURST - 1 - i) * 0.02 }}
          >
            <ChatShot scroll={i} />
          </motion.div>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <button
          type="button"
          onClick={flip}
          aria-expanded={open}
          className="press relative flex h-7 items-center gap-1.5 rounded-full bg-panel px-3 text-[12px] text-ink shadow-[0_0_0_1px_var(--line)]"
        >
          <span className="relative grid">
            <motion.span
              className="col-start-1 row-start-1 whitespace-nowrap"
              initial={false}
              animate={open ? { opacity: 0, filter: "blur(4px)" } : { opacity: 1, filter: "blur(0px)" }}
              transition={SPRING}
            >
              +{BURST - 1} similar
            </motion.span>
            <motion.span
              className="col-start-1 row-start-1 whitespace-nowrap"
              initial={false}
              animate={open ? { opacity: 1, filter: "blur(0px)" } : { opacity: 0, filter: "blur(4px)" }}
              transition={SPRING}
            >
              hide {BURST - 1}
            </motion.span>
          </span>
          <KeyHint>ctrl e</KeyHint>
        </button>
      </div>
    </div>
  );
}

// One chat, shot four times while scrolling: each a little further down.
const CHAT = [
  { me: false, w: 70 },
  { me: true, w: 55 },
  { me: false, w: 80 },
  { me: false, w: 45 },
  { me: true, w: 65 },
  { me: false, w: 60 },
  { me: true, w: 40 },
  { me: false, w: 75 },
];

function ChatShot({ scroll }: { scroll: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-4 shrink-0 items-center gap-1 border-b border-black/[0.06] px-1.5">
        <span className="size-1.5 rounded-full bg-[#5b8def]" />
        <span className="h-1 w-6 rounded-full bg-black/20" />
      </div>
      <div className="flex flex-col gap-1 px-1.5 pt-1.5" style={{ transform: `translateY(${-scroll * 9}px)` }}>
        {CHAT.map((m, i) => (
          <span
            key={i}
            className={`h-2.5 rounded-[4px] ${m.me ? "self-end bg-[#0a84ff]" : "self-start bg-[#e9e9eb]"}`}
            style={{ width: `${m.w}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Copy just the part you need                                      */
/* ------------------------------------------------------------------ */

const BOOKING = [
  "Booking confirmed",
  "Hotel Sagar, Jodhpur",
  "Check-in  Fri 9 Oct, 2 pm",
  "Confirmation  HS-77120",
  "Wi-Fi  sagar-guest / lemon-tree-42",
];

type Box = { x: number; y: number; w: number; h: number };

function CopyDemo() {
  const shot = useRef<HTMLDivElement>(null);
  const lines = useRef<(HTMLButtonElement | null)[]>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Set once a press turns into a drag, so the click that ends it doesn't
  // also copy the single line it ended on.
  const dragged = useRef(false);
  const [box, setBox] = useState<Box | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [message, flash] = useFlash();

  const copy = (idx: number[]) => {
    const text = idx.map((i) => BOOKING[i]).join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
    flash(idx.length === 1 ? "copied 1 line" : `copied ${idx.length} lines`);
  };

  const within = (b: Box) => {
    const root = shot.current?.getBoundingClientRect();
    if (!root) return [];
    return lines.current.flatMap((el, i) => {
      if (!el) return [];
      const r = el.getBoundingClientRect();
      const x = r.left - root.left;
      const y = r.top - root.top;
      const hit = x < b.x + b.w && x + r.width > b.x && y < b.y + b.h && y + r.height > b.y;
      return hit ? [i] : [];
    });
  };

  const point = (e: ReactPointerEvent) => {
    const r = shot.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Mouse and pen drag a box; on touch the page has to keep scrolling, so a
  // tap on a line copies that line instead.
  const down = (e: ReactPointerEvent) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    dragged.current = false;
    start.current = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const p = point(e);
    const b = {
      x: Math.min(p.x, start.current.x),
      y: Math.min(p.y, start.current.y),
      w: Math.abs(p.x - start.current.x),
      h: Math.abs(p.y - start.current.y),
    };
    if (b.w < 4 && b.h < 4) return;
    dragged.current = true;
    setBox(b);
    setPicked(within(b));
  };
  const up = () => {
    const b = box;
    start.current = null;
    if (b && picked.length) copy(picked);
    setBox(null);
    setPicked([]);
  };

  return (
    <div className="grid h-full place-items-center p-3">
      <div
        ref={shot}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="group relative w-full max-w-[340px] cursor-crosshair rounded-[8px] p-3.5 select-none"
        style={{ background: PAPER, color: PAPER_INK }}
      >
        <div className="flex flex-col items-start gap-1">
          {BOOKING.map((l, i) => (
            <button
              key={l}
              ref={(el) => {
                lines.current[i] = el;
              }}
              type="button"
              onClick={() => {
                if (dragged.current) {
                  dragged.current = false;
                  return;
                }
                copy([i]);
              }}
              className={`max-w-full truncate rounded-[3px] px-1 text-left ${
                i === 0 ? "text-[13px] font-semibold" : "font-mono text-[11.5px]"
              } [@media(hover:hover)_and_(pointer:fine)]:group-hover:shadow-[0_0_0_1px_rgb(0_0_0/0.08)]`}
              style={{
                background: picked.includes(i) ? "var(--ai-soft)" : "transparent",
                outline: picked.includes(i) ? "1.5px solid var(--ai)" : "1.5px solid transparent",
                transition: `background-color 120ms ${EASE}, outline-color 120ms ${EASE}`,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        {box && (
          <span
            aria-hidden
            className="pointer-events-none absolute rounded-[2px] border border-ai bg-ai-soft"
            style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
          />
        )}
      </div>
      <Toast show={!!message}>
        <motion.span initial={ICON_OUT} animate={ICON_IN} transition={SPRING} className="text-ai">
          <CheckIcon />
        </motion.span>
        {message}
      </Toast>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Copied images become searchable                                  */
/* ------------------------------------------------------------------ */

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `Clipboard ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}.png`;
}

function ClipboardDemo() {
  const [on, setOn] = useState(true);
  const [saved, setSaved] = useState(12);
  const [last, setLast] = useState<string | null>(null);
  type Flight = { id: number; left: number; top: number; dx: number; dy: number };
  const [flights, setFlights] = useState<Flight[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  // A copy of the picture travels from where it was copied into the folder.
  const copyImage = () => {
    if (!on) {
      shake(toggle.current);
      return;
    }
    const s = stage.current?.getBoundingClientRect();
    const a = source.current?.getBoundingClientRect();
    const b = target.current?.getBoundingClientRect();
    if (!s || !a || !b || reduce) {
      land();
      return;
    }
    setFlights((f) => [
      ...f,
      {
        id: performance.now(),
        left: a.left - s.left,
        top: a.top - s.top,
        dx: b.left + b.width / 2 - (a.left + a.width / 2),
        dy: b.top + b.height / 2 - (a.top + a.height / 2),
      },
    ]);
  };
  const land = () => {
    setSaved((n) => n + 1);
    setLast(stamp());
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-dim">save copied images</span>
        {/* 44px wide hit area around a 36px switch. */}
        <button
          ref={toggle}
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Save copied images"
          onClick={() => setOn((o) => !o)}
          className="group -m-2 p-2"
        >
          <span
            className="relative block h-5 w-9 rounded-full"
            style={{ background: on ? "var(--matsu)" : "var(--line)", transition: `background-color 150ms ${EASE}` }}
          >
            <span
              className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
              style={{
                transform: on ? "translateX(16px)" : "translateX(0)",
                transition: `transform 200ms ${EASE}`,
              }}
            />
          </span>
        </button>
      </div>

      <div ref={stage} className="relative flex flex-1 items-center gap-3">
        {/* Somewhere else on the screen: a picture someone copies. */}
        <div className="flex flex-1 flex-col items-center gap-2">
          <div ref={source} className="relative h-[72px] w-[104px] overflow-hidden rounded-[6px] shadow-[0_0_0_1px_var(--line)]">
            <Picture />
          </div>
          <button
            type="button"
            onClick={copyImage}
            className="press flex h-7 items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 text-[12px] text-ink"
          >
            copy image
            <KeyHint>ctrl c</KeyHint>
          </button>
        </div>

        <svg viewBox="0 0 24 8" aria-hidden className="w-6 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 4h21M18.5 1 22 4l-3.5 3" />
        </svg>

        <div className="flex flex-1 flex-col items-center gap-2">
          <div
            ref={target}
            className="flex h-10 items-center gap-2 rounded-[8px] bg-panel px-3 text-[13px] text-ink shadow-[0_0_0_1px_var(--line)]"
          >
            <FolderIcon className="size-4 text-matsu" />
            Clipboard
            <span className="relative inline-flex overflow-hidden rounded-full bg-matsu-soft px-1.5 text-[11px] text-matsu tabular-nums">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={saved}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                >
                  {saved}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
          <span className="font-mono text-[10px] text-faint">Pictures/Clipboard</span>
        </div>

        {flights.map((f) => (
          <motion.div
            key={f.id}
            aria-hidden
            className="pointer-events-none absolute z-20 h-[72px] w-[104px] overflow-hidden rounded-[6px] shadow-[0_8px_20px_-6px_rgb(0_0_0/0.35)]"
            style={{ left: f.left, top: f.top }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: f.dx, y: f.dy, scale: 0.25, opacity: [1, 1, 0] }}
            transition={{ duration: 0.55, ease: [0.77, 0, 0.175, 1] }}
            onAnimationComplete={() => {
              setFlights((all) => all.filter((x) => x.id !== f.id));
              land();
            }}
          >
            <Picture />
          </motion.div>
        ))}
      </div>

      <p className="flex h-5 items-center justify-center gap-1.5 text-[12px]" aria-live="polite">
        {!on ? (
          <span className="text-faint">off: copied images aren&apos;t kept</span>
        ) : last ? (
          <motion.span
            key={last}
            initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-matsu" />
            <span className="truncate font-mono text-[11px] text-dim">{last}</span>
            <span className="shrink-0 text-ink">searchable</span>
          </motion.span>
        ) : (
          <span className="text-faint">copy it, it gets saved and read</span>
        )}
      </p>
    </div>
  );
}

// A meme-ish picture with a caption: the kind of thing people copy.
function Picture() {
  return (
    <div className="relative size-full" style={{ background: "linear-gradient(160deg, #f6d38b, #e98b5d)" }}>
      <span className="absolute bottom-2 left-1/2 size-7 -translate-x-1/2 rounded-full bg-[#1c1c1e]/80" />
      <span className="absolute bottom-0 left-1/2 h-3 w-12 -translate-x-1/2 rounded-t-full bg-[#1c1c1e]/80" />
      <span className="absolute inset-x-0 top-1.5 text-center text-[9px] font-bold tracking-wide text-white [text-shadow:0_1px_1px_rgb(0_0_0/0.5)]">
        WHEN THE BUILD PASSES
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Devanagari and vertical text                                     */
/* ------------------------------------------------------------------ */

const HINDI = ["ऑर्डर #4021 का स्टेटस", "डिलीवरी आज शाम तक", "पता: जोधपुर, राजस्थान"];
const VERTICAL = "縦書きのテキスト";

function ScriptsDemo() {
  const [q, setQ] = useState<string | null>("स्टेटस");
  const hits = HINDI.map((l) => (q && l.includes(q) ? "exact" : null));
  const vertical = !!q && VERTICAL.includes(q);
  const any = hits.some(Boolean) || vertical;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-line px-3.5 text-dim">
        <SearchIcon />
        <span className={`flex-1 truncate text-[15px] text-ink ${devanagari.className}`}>
          {q ?? <span className="text-faint">pick a word</span>}
        </span>
      </div>

      <div className="flex flex-1 items-center gap-2.5 p-2.5">
        <div className="relative h-full flex-1 overflow-hidden rounded-[6px] p-3" style={{ background: PAPER, color: PAPER_INK }}>
          <p className="text-[10px] font-semibold tracking-wide" style={{ color: PAPER_DIM }}>
            ORDERS
          </p>
          <div className={`mt-1.5 flex flex-col items-start gap-1 text-[13px] ${devanagari.className}`}>
            {HINDI.map((l, i) => (
              <span key={l} className="max-w-full truncate" style={lit(hits[i])}>
                {l}
              </span>
            ))}
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[5] bg-[#0b0b0c]/55"
            style={{ opacity: hits.some(Boolean) ? 1 : 0, transition: `opacity 220ms ${EASE}` }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[20] bg-sunk"
            style={{ opacity: q && !hits.some(Boolean) ? 0.86 : 0, transition: `opacity 220ms ${EASE}` }}
          />
        </div>

        {/* A sign written top to bottom, read as a column. */}
        <div className="relative h-full w-12 shrink-0 overflow-hidden rounded-[6px] py-3" style={{ background: "#f7efe2", color: PAPER_INK }}>
          <span
            className="mx-auto block text-[14px] tracking-[0.15em] [writing-mode:vertical-rl]"
            style={lit(vertical ? "exact" : null, "#f7efe2")}
          >
            {VERTICAL}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[5] bg-[#0b0b0c]/55"
            style={{ opacity: vertical ? 1 : 0, transition: `opacity 220ms ${EASE}` }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[20] bg-sunk"
            style={{ opacity: q && !vertical ? 0.86 : 0, transition: `opacity 220ms ${EASE}` }}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 px-2.5 pb-2.5" aria-live="polite">
        {["स्टेटस", "जोधपुर", "縦書き"].map((c) => {
          const pressed = q === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={pressed}
              onClick={() => setQ(pressed ? null : c)}
              className={`press h-7 shrink-0 rounded-full border px-2.5 text-[13px] ${devanagari.className} ${
                pressed ? "border-transparent bg-shu-soft text-shu" : "border-line text-dim hover:text-ink"
              }`}
            >
              {c}
            </button>
          );
        })}
        <span className="ml-auto text-[12px] text-dim">{q ? (any ? "found" : "none") : ""}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Rebind any shortcut                                              */
/* ------------------------------------------------------------------ */

const COMMANDS = [
  { id: "trash", name: "move to the trash", keys: ["ctrl", "delete"] },
  { id: "all", name: "mark every result", keys: ["ctrl", "shift", "a"] },
  { id: "similar", name: "show similar", keys: ["ctrl", "e"] },
];

const MODS = ["Control", "Shift", "Alt", "Meta"];

function keyName(k: string) {
  if (k === " ") return "space";
  if (k.startsWith("Arrow")) return k.slice(5).toLowerCase();
  return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
}

function ShortcutsDemo() {
  const [keys, setKeys] = useState(COMMANDS.map((c) => c.keys));
  const [recording, setRecording] = useState<number | null>(null);
  const [held, setHeld] = useState<string[]>([]);
  const [error, setError] = useState<{ row: number; text: string } | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

  const stop = () => {
    setRecording(null);
    setHeld([]);
  };

  const onKey = (i: number, e: ReactKeyboardEvent) => {
    if (recording !== i) return;
    if (e.key === "Tab") return;
    e.preventDefault();
    if (e.key === "Escape") return stop();
    const mods = [e.ctrlKey && "ctrl", e.altKey && "alt", e.shiftKey && "shift", e.metaKey && "super"].filter(Boolean) as string[];
    if (MODS.includes(e.key)) {
      setHeld(mods);
      return;
    }
    if (!mods.length && (e.key === "Delete" || e.key === "Backspace")) {
      setKeys((k) => k.map((v, j) => (j === i ? COMMANDS[i].keys : v)));
      setFresh(i);
      return stop();
    }
    const combo = [...mods, keyName(e.key)];
    const fn = /^f\d{1,2}$/.test(keyName(e.key));
    if (!fn && !mods.some((m) => m !== "shift")) {
      setError({ row: i, text: "needs ctrl, alt or super" });
      shake(rows.current[i]);
      return;
    }
    const clash = keys.findIndex((v, j) => j !== i && v.join("+") === combo.join("+"));
    if (clash >= 0) {
      setError({ row: i, text: `already used by ${COMMANDS[clash].name}` });
      shake(rows.current[i]);
      return;
    }
    setKeys((k) => k.map((v, j) => (j === i ? combo : v)));
    setError(null);
    setFresh(i);
    stop();
  };

  useEffect(() => {
    if (fresh === null) return;
    const t = setTimeout(() => setFresh(null), 900);
    return () => clearTimeout(t);
  }, [fresh]);

  return (
    <div className="flex h-full flex-col justify-center gap-1 p-2.5">
      {COMMANDS.map((c, i) => {
        const rec = recording === i;
        const err = error?.row === i ? error : null;
        return (
          <button
            key={c.id}
            ref={(el) => {
              rows.current[i] = el;
            }}
            type="button"
            onClick={() => {
              setError(null);
              setHeld([]);
              setRecording(rec ? null : i);
            }}
            onKeyDown={(e) => onKey(i, e)}
            onKeyUp={(e) => {
              if (rec && MODS.includes(e.key)) {
                setHeld([e.ctrlKey && "ctrl", e.altKey && "alt", e.shiftKey && "shift", e.metaKey && "super"].filter(Boolean) as string[]);
              }
            }}
            onBlur={() => rec && stop()}
            aria-label={`${c.name}: ${keys[i].join(" ")}. Press Enter, then the new keys.`}
            className="press flex h-12 items-center gap-3 rounded-[8px] px-3 text-left"
            style={{
              background: rec ? "var(--panel)" : "transparent",
              boxShadow: rec ? "0 0 0 1.5px var(--kihada)" : "0 0 0 1.5px transparent",
              transition: `background-color 150ms ${EASE}, box-shadow 150ms ${EASE}, scale 160ms ${EASE}`,
            }}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] text-ink">{c.name}</span>
              <span
                className="h-4 text-[11px]"
                style={{ color: err ? "var(--shu)" : "var(--faint)", transition: `color 150ms ${EASE}` }}
              >
                {err ? err.text : rec ? "escape cancels, delete resets" : ""}
              </span>
            </span>
            <span className="relative grid shrink-0 justify-items-end">
              <motion.span
                className="col-start-1 row-start-1 flex items-center gap-1"
                initial={false}
                animate={rec ? { opacity: 0, filter: "blur(4px)" } : { opacity: 1, filter: "blur(0px)" }}
                transition={SPRING}
              >
                {keys[i].map((k) => (
                  <Kbd
                    key={k}
                    className={fresh === i ? "text-kihada shadow-[0_0_0_1px_var(--kihada)]" : ""}
                  >
                    {k}
                  </Kbd>
                ))}
              </motion.span>
              <motion.span
                className="col-start-1 row-start-1 flex items-center gap-1 text-[12px] text-kihada"
                initial={false}
                animate={rec ? { opacity: 1, filter: "blur(0px)" } : { opacity: 0, filter: "blur(4px)" }}
                transition={SPRING}
              >
                {held.length ? held.map((k) => <Kbd key={k}>{k}</Kbd>) : "press new keys"}
                <span aria-hidden className="caret-blink ml-0.5 h-3.5 w-px bg-kihada" />
              </motion.span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The section                                                         */
/* ------------------------------------------------------------------ */

export function Features() {
  return (
    <MotionConfig reducedMotion="user">
      <style>{`@keyframes caret-blink{0%,45%{opacity:1}55%,100%{opacity:0}}.caret-blink{animation:caret-blink 1s steps(1,end) infinite}@media (prefers-reduced-motion: reduce){.caret-blink{animation:none}}`}</style>
      <section
        id="features"
        aria-labelledby="features-title"
        className="mx-auto w-full max-w-5xl px-4 pt-36 sm:px-6"
      >
        <Reveal>
          <h2 id="features-title" className="text-3xl font-medium tracking-[-0.025em] text-ink sm:text-4xl">
            everything it does
          </h2>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-dim">
            Each of these works the way it does in the app, with the same keys.
            Go on, poke them.
          </p>
        </Reveal>

        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          <Card
            wide
            ink="shu"
            height={252}
            title="Finds the words it misread"
            body={
              <>
                OCR sometimes reads an I as an l, or an O as a 0. Those still turn up, after every
                exact match, marked <em className="not-italic text-ink">near match</em> and shown
                exactly as they were read. Try <Code>inv0ice</Code>.
              </>
            }
          >
            <NearDemo />
          </Card>
          <Card
            ink="ai"
            delay={0.05}
            title="Filters for where and when"
            body={
              <>
                <Code>in:discord</Code>, <Code>date:yesterday</Code>, <Code>before:aug</Code>. They
                mix with words, and dim once they&apos;re complete.
              </>
            }
          >
            <FiltersDemo />
          </Card>
          <Card
            ink="kihada"
            delay={0.1}
            title="Clear out a hundred at once"
            body={
              <>
                Search <Code>otp</Code>, mark every result, move them to the trash. Nothing is
                deleted, and Ctrl+Z puts them all back.
              </>
            }
          >
            <TrashDemo />
          </Card>
          <Card
            ink="matsu"
            title="Bursts fold into one"
            body="Six shots of the same chat while you scroll show as one tile. Ctrl+E unfolds the rest right after it."
          >
            <BurstDemo />
          </Card>
          <Card
            ink="ai"
            delay={0.05}
            title="Copy just the part you need"
            body="Drag a box over an open screenshot to copy the lines inside it, or click one line to copy only that."
          >
            <CopyDemo />
          </Card>
          <Card
            ink="matsu"
            title="Copied images count too"
            body={
              <>
                Turn it on and anything you copy, even if it was never saved, lands in{" "}
                <Code>Pictures/Clipboard</Code> and becomes searchable. Off by default.
              </>
            }
          >
            <ClipboardDemo />
          </Card>
          <Card
            ink="shu"
            delay={0.05}
            title="Hindi, Marathi, Nepali, and vertical text"
            body="Turn on Devanagari in settings and it reads that too. Vertical Japanese and sideways chart labels read as well."
          >
            <ScriptsDemo />
          </Card>
          <Card
            wide
            ink="kihada"
            height={200}
            title="Every shortcut is yours"
            body="Pick a command and press the new keys. Escape cancels, Delete puts the default back, and keys already in use are refused."
          >
            <ShortcutsDemo />
          </Card>
        </ul>
      </section>
    </MotionConfig>
  );
}

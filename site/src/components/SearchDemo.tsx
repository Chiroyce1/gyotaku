"use client";

import Image from "next/image";
import { useInView } from "motion/react";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEMO_SHOTS } from "@/assets/demo";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// A small gyotaku window over eight real screenshots, read by gyotaku itself.
// The pictures and the text and boxes it found in them come from
// scripts/demo-shots.ts (run `bun scripts/demo-shots.ts` to make them again),
// so the search below runs on exactly what the app would read, misreads and
// all, and lights the lines where gyotaku found them.

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

type Shot = (typeof DEMO_SHOTS)[number];

// Whether the page is dark, following both the system and the theme toggle
// (which sets <html data-theme>).
const DARK = "(prefers-color-scheme: dark)";
function subscribeTheme(onChange: () => void) {
  const media = matchMedia(DARK);
  const observer = new MutationObserver(onChange);
  media.addEventListener("change", onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}
function useDark() {
  return useSyncExternalStore(
    subscribeTheme,
    () => {
      const t = document.documentElement.dataset.theme;
      return t ? t === "dark" : matchMedia(DARK).matches;
    },
    () => false,
  );
}

// A match stays exactly as bright as it was, ringed in shu, with each line
// gyotaku found the word in highlighted where it sits. Everything else
// recedes: faded and drained of color, so the eye lands on the one that's lit.
// On a dark window a pale screenshot at the light theme's fade still reads as
// a grey slab, so it goes further back there.
function Tile({ shot, q, eager }: { shot: Shot; q: string; eager: boolean }) {
  const dark = useDark();
  const hits = shot.lines.map((l) => (q ? hitOf(l.text, q) : null));
  const exact = hits.some((h) => h === "exact");
  // Near lines only count where the screenshot has no exact hit, as in the app.
  const lit = hits.map((h) => (h === "near" && exact ? null : h));
  const hit = lit.some((h) => h !== null);
  const recede = q !== "" && !hit;
  return (
    <div
      role="img"
      aria-label={`Screenshot of ${shot.name}${hit ? ", matches" : ""}`}
      className="relative aspect-[4/3] overflow-hidden rounded-[6px] bg-sunk outline outline-1 -outline-offset-1 outline-[var(--outline)] motion-reduce:transition-none"
      style={{
        ...fade("opacity, filter, scale, box-shadow"),
        opacity: recede ? (dark ? 0.1 : 0.32) : 1,
        filter: recede ? "grayscale(1)" : "grayscale(0)",
        scale: recede ? 0.985 : 1,
        // The ring sits just outside the tile, with a sliver of window
        // between, so it reads as a selection and not a border.
        boxShadow: hit
          ? "0 0 0 2px var(--panel), 0 0 0 3.5px var(--shu)"
          : "0 0 0 2px transparent, 0 0 0 3.5px transparent",
      }}
    >
      <Image
        src={shot.image}
        alt={`Example screenshot: ${shot.name}`}
        fill
        placeholder="blur"
        loading={eager ? "eager" : "lazy"}
        sizes="(min-width: 1152px) 260px, (min-width: 640px) 24vw, 46vw"
        className="object-cover"
      />
      {/* Each line's box as gyotaku read it, in fractions of the picture, so
          it lands on the words at any size. A highlighter stroke with a
          hairline edge; dashed for a near match: found, but not the text as
          it was read. */}
      {shot.lines.map((line, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-[2px] motion-reduce:transition-none"
          style={{
            ...fade("opacity, scale"),
            left: `calc(${line.x * 100}% - 2px)`,
            top: `calc(${line.y * 100}% - 1px)`,
            width: `calc(${line.w * 100}% + 4px)`,
            height: `calc(${line.h * 100}% + 2px)`,
            opacity: lit[i] ? 1 : 0,
            scale: lit[i] ? 1 : 0.96,
            background: "rgb(255 116 56 / 0.22)",
            boxShadow: lit[i] === "near" ? "none" : "inset 0 0 0 1px var(--shu)",
            outline: lit[i] === "near" ? "1px dashed var(--shu)" : "none",
            outlineOffset: "-1px",
          }}
        />
      ))}
    </div>
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
// takes a deeper, crisper shadow and the chips under it turn solid to stay
// readable over the image.
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
  const total = DEMO_SHOTS.length;
  const exact = q
    ? DEMO_SHOTS.filter((s) => s.lines.some((l) => matches(l.text, q))).length
    : total;
  const near = q
    ? DEMO_SHOTS.filter(
        (s) =>
          !s.lines.some((l) => matches(l.text, q)) &&
          s.lines.some((l) => hitOf(l.text, q) === "near"),
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
            placeholder={`search ${total} screenshots`}
            aria-label="Search the example screenshots"
            spellCheck={false}
            autoComplete="off"
            // Inline, because the page-wide :focus-visible ring sits outside
            // Tailwind's layers and would beat `outline-none`. The shu caret
            // and the typed text already show where focus is.
            style={{ outline: "none" }}
            className="min-w-0 flex-1 bg-transparent text-base text-ink caret-[var(--shu)] placeholder:text-faint sm:text-[15px]"
          />
          {/* On a phone the resting "8 screenshots" would crowd the
              placeholder, so the count only appears once there's a search. */}
          <span
            aria-live={stopped ? "polite" : "off"}
            className="shrink-0 text-right text-[13px] tabular-nums text-dim sm:min-w-[6.75rem]"
          >
            {q ? (
              near ? (
                `${exact ? `${exact} of ${total}, ` : ""}${near} near`
              ) : (
                `${exact} of ${total}`
              )
            ) : (
              <span className="hidden sm:inline">{total} screenshots</span>
            )}
          </span>
          <kbd
            title="Press / to search"
            className="hidden h-6 min-w-6 items-center justify-center rounded-[6px] bg-sunk px-1.5 font-mono text-[12px] text-dim shadow-[inset_0_-1px_0_var(--line)] [@media(hover:hover)_and_(pointer:fine)]:flex"
          >
            /
          </kbd>
        </label>

        <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-4">
          {DEMO_SHOTS.map((shot, i) => (
            <Tile key={shot.id} shot={shot} q={q} eager={i < 4} />
          ))}
        </div>
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

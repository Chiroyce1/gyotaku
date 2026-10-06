"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "./Arrow";
import { detect, onPhone, TABS, type Os } from "./InstallTabs";
import { useReducedMotion } from "@/lib/use-reduced-motion";

// The hero's main button already knows your system. On Linux and Windows one
// press copies the install command and the button turns into the next
// instruction, so nobody has to scroll to find it. On a Mac it points at the
// port in review; on a phone it says to come back on a computer, and takes
// you to the install section instead.

type Mode = Os | "phone" | null;

const ICON = { type: "spring", duration: 0.3, bounce: 0 } as const;

// The one loud thing on the page: a big, solid shu button.
const CTA =
  "press group inline-flex h-[52px] items-center justify-center gap-3 rounded-[14px] bg-shu pr-4 pl-6 text-[17px] font-semibold tracking-[-0.01em] text-[var(--on-shu)] hover:brightness-[1.06]";

export function HeroInstall() {
  const [mode, setMode] = useState<Mode>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduce = useReducedMotion();

  useEffect(() => {
    setMode(onPhone() ? "phone" : detect());
    return () => clearTimeout(timer.current);
  }, []);

  const tab = mode && mode !== "phone" ? TABS.find((t) => t.id === mode) : undefined;
  const name = tab?.label;

  // Before detection (and on the server), and for phones and Macs: a plain
  // link down to the install section, which has every option.
  if (!tab?.command) {
    const label =
      mode === "macos" ? "macOS is on the way" : mode === "phone" ? "Install on your computer" : "Install gyotaku";
    return (
      <a
        href="#install"
        className={CTA}
      >
        {label}
        <span className="flex size-6 items-center justify-center rounded-md bg-black/10">
          <Arrow
            direction="down"
            className="transition-[translate] duration-200 ease-out group-hover:translate-y-0.5"
          />
        </span>
      </a>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab.command!);
    } catch {
      // No clipboard (an insecure context, or denied): show it instead.
      document.getElementById("install")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2600);
  };

  const swap = reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, scale: 0.25, filter: "blur(4px)" },
      };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className={`${CTA} relative overflow-hidden`}
      >
        {/* Both labels share one cell, so the button never changes width. */}
        <span className="grid text-left">
          <span
            className="col-start-1 row-start-1 transition-[opacity,filter,translate] duration-200 ease-[var(--ease-out)]"
            style={{
              opacity: copied ? 0 : 1,
              filter: copied ? "blur(4px)" : "blur(0px)",
              translate: copied ? "0 -6px" : "0 0",
            }}
          >
            Install for {name}
          </span>
          <span
            aria-hidden={!copied}
            className="col-start-1 row-start-1 transition-[opacity,filter,translate] duration-200 ease-[var(--ease-out)]"
            style={{
              opacity: copied ? 1 : 0,
              filter: copied ? "blur(0px)" : "blur(4px)",
              translate: copied ? "0 0" : "0 6px",
            }}
          >
            Copied, now paste it
          </span>
        </span>
        <span className="relative flex size-6 items-center justify-center rounded-md bg-black/10">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={copied ? "check" : "copy"} {...swap} transition={ICON} className="flex">
              {copied ? <Check /> : <Copy />}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
      <p aria-live="polite" className="text-center text-[13px] text-dim">
        {copied ? (
          <>Into {tab.id === "windows" ? "PowerShell" : "a terminal"}, then press Enter.</>
        ) : (
          <>
            Copies one line for {tab.id === "windows" ? "PowerShell" : "your terminal"}.{" "}
            <a href="#install" className="underline decoration-line underline-offset-4 transition-[text-decoration-color,color] duration-150 hover:text-ink hover:decoration-current">
              See it first
            </a>
          </>
        )}
      </p>
    </div>
  );
}

function Copy() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden>
      <rect x="5.25" y="5.25" width="8" height="8" rx="1.75" />
      <path d="M10.75 5.25V4A1.75 1.75 0 0 0 9 2.25H4A1.75 1.75 0 0 0 2.25 4v5c0 .97.78 1.75 1.75 1.75h1.25" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

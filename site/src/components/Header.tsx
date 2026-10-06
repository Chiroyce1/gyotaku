"use client";

import { useEffect, useState } from "react";
import { Mark } from "./Mark";
import { StarCount } from "./GithubStars";
import { ThemeToggle } from "./ThemeToggle";
import { REPO, REPO_SLUG, SAVED_STARS } from "@/lib/links";

// Clear over the hero, then a quiet bar once the page moves under it.
export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-40 border-b border-transparent transition-[background-color,border-color] duration-200 ease-out data-[scrolled=true]:border-line data-[scrolled=true]:bg-bg/80 data-[scrolled=true]:backdrop-blur-md"
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <a
          href="#top"
          className="press -mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1 font-medium tracking-tight text-ink"
        >
          <Mark size={24} className="rounded-[6px]" />
          gyotaku
        </a>
        <nav className="flex items-center gap-0.5 text-sm text-dim">
          <a
            href="#install"
            className="hidden h-9 items-center rounded-lg px-2.5 transition-colors duration-150 hover:text-ink sm:flex"
          >
            install
          </a>
          <a
            href={`${REPO}/blob/main/docs/usage.md`}
            className="hidden h-9 items-center rounded-lg px-2.5 transition-colors duration-150 hover:text-ink sm:flex"
          >
            docs
          </a>
          <a
            href={REPO}
            className="press flex h-9 items-center gap-1.5 rounded-lg px-2.5 hover:text-ink"
          >
            <GithubIcon />
            <span className="sr-only">gyotaku on GitHub, stars:</span>
            <StarCount repo={REPO_SLUG} saved={SAVED_STARS} />
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export function GithubIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

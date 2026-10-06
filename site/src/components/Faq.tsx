import { REPO } from "@/lib/links";

// Plain <details>: keyboard and screen reader support for free, works with
// no JavaScript, and where the browser can animate to an auto height the
// answer opens smoothly instead of popping.

const ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it really free?",
    a: (
      <>
        Yes. gyotaku is open source under the GPL-3.0, with no paid tier, account
        or limits. The code is on{" "}
        <a href={REPO} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-current">
          GitHub
        </a>
        .
      </>
    ),
  },
  {
    q: "Does anything leave my computer?",
    a: "No. Screenshots are read on your own CPU and the index stays on your disk. The only network access is a one-time download of the text reading model and ONNX Runtime at setup, each checked against a pinned checksum. There's no telemetry and no update check.",
  },
  {
    q: "Which systems does it run on?",
    a: "macOS on Apple Silicon Macs, Windows 10 and 11, and Linux on x86_64 and arm64 with glibc 2.35 or newer (Ubuntu 22.04, Debian 12, Fedora, Arch, openSUSE and so on). Intel Macs need a build from source for now.",
  },
  {
    q: "Does it need a GPU, or slow my computer down?",
    a: "No GPU needed. Reading runs at idle priority, so it only uses time nothing else wants, and takes under a second per screenshot. Waiting in the background it uses about 37 MB of memory.",
  },
  {
    q: "How much disk space does it take?",
    a: "About 30 MB per 1,000 screenshots for the index and thumbnails, plus around 46 MB once for the model and runtime.",
  },
  {
    q: "Which languages can it read?",
    a: "English and other Latin-script languages, Chinese and Japanese out of the box, including vertical text. Hindi, Marathi and Nepali can be turned on in settings.",
  },
  {
    q: "How do I uninstall it?",
    a: (
      <>
        Run the install command again with <code className="rounded bg-sunk px-1.5 py-0.5 font-mono text-[0.9em] text-ink">--uninstall</code>{" "}
        on macOS or Linux, or remove it from Settings &gt; Apps on Windows. The
        README has the exact commands.
      </>
    ),
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {ITEMS.map((item) => (
        <details key={item.q} className="faq group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium text-ink outline-hidden select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-shu [&::-webkit-details-marker]:hidden">
            {item.q}
            {/* A plus that turns into a cross as the answer opens. */}
            <svg
              viewBox="0 0 16 16"
              aria-hidden
              className="size-4 shrink-0 text-faint transition-[rotate,color] duration-200 ease-[var(--ease-out)] group-open:rotate-45 group-hover:text-ink"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
          </summary>
          <p className="max-w-2xl pb-6 leading-relaxed text-dim">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

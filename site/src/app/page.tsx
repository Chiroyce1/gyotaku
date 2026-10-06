import { Arrow } from "@/components/Arrow";
import { GithubIcon, Header } from "@/components/Header";
import InstallTabs, { QuickCommand } from "@/components/InstallTabs";
import { Mark } from "@/components/Mark";
import Numbers from "@/components/Numbers";
import { Reveal } from "@/components/Reveal";
import { Seal } from "@/components/Seal";
import SearchDemo from "@/components/SearchDemo";
import { Steps } from "@/components/Steps";
import Why from "@/components/Why";
import { StarCount } from "@/components/GithubStars";
import { REPO, REPO_SLUG, SAVED_STARS } from "@/lib/links";

const VERSION = "0.1.2";

const stack = [
  { name: "Rust", note: "the whole thing", href: "https://www.rust-lang.org" },
  { name: "gpui", note: "the window, from Zed", href: "https://www.gpui.rs" },
  { name: "PP-OCR", note: "reading, on ONNX Runtime", href: "https://github.com/PaddlePaddle/PaddleOCR" },
  { name: "SQLite FTS5", note: "the index, trigram search", href: "https://www.sqlite.org/fts5.html" },
];

// Everything gyotaku ever does over the network, as a log. Kept honest with
// the README's Privacy section.
const traffic = [
  { when: "setup", what: "text reading model", result: "once, checksum pinned" },
  { when: "setup", what: "ONNX Runtime", result: "once, checksum pinned" },
  { when: "after", what: "your screenshots", result: "never leave" },
  { when: "after", what: "usage data", result: "never collected" },
];

function Rise({
  i,
  text,
  children,
}: {
  i: number;
  text?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={text ? "rise-text" : "rise"} style={{ "--i": i } as React.CSSProperties}>
      {children}
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-3xl font-medium tracking-[-0.025em] text-ink sm:text-4xl">
      {children}
    </h2>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 max-w-xl text-lg leading-relaxed text-dim">{children}</p>;
}

export default function Home() {
  return (
    <>
      <Header />

      <main id="top" className="overflow-x-clip">
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-4 pt-14 pb-12 sm:px-6 sm:pt-24">
          <Rise i={0}>
            <a
              href={`${REPO}/releases/latest`}
              className="press group inline-flex h-8 items-center gap-2 rounded-full border border-line bg-panel/60 pr-3 pl-1 text-[13px] text-dim hover:text-ink"
            >
              <span className="rounded-full bg-shu-soft px-2 py-0.5 font-medium text-shu tabular-nums">
                v{VERSION}
              </span>
              free and open source
              <Arrow
                direction="right"
                className="size-3 transition-[translate] duration-200 ease-out group-hover:translate-x-0.5"
              />
            </a>
          </Rise>

          <Rise i={1} text>
            <h1 className="mt-7 max-w-4xl text-[2.75rem] leading-[1.08] font-medium tracking-[-0.045em] text-ink min-[400px]:text-[3.1rem] sm:text-7xl sm:leading-[1.02]">
              ctrl f for your <span className="found isolate">screenshots</span>
            </h1>
          </Rise>

          <Rise i={2} text>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-dim sm:text-xl sm:leading-relaxed">
              gyotaku reads the text in every screenshot you take, right on your
              machine. Type any word you remember seeing and it&apos;s there, lit
              up where it sits in the image.
            </p>
          </Rise>

          <Rise i={3}>
            <div className="mt-9 grid gap-3 min-[480px]:flex min-[480px]:flex-wrap min-[480px]:items-center">
              <a
                href="#install"
                className="press group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-ink pr-4 pl-5 font-medium text-bg shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_8px_24px_-8px_rgb(0_0_0/0.35)]"
              >
                Install gyotaku
                <span className="flex size-6 items-center justify-center rounded-md bg-bg/10">
                  <Arrow
                    direction="down"
                    className="transition-[translate] duration-200 ease-out group-hover:translate-y-0.5"
                  />
                </span>
              </a>
              <a
                href={REPO}
                className="press inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-line bg-panel px-4 font-medium text-ink hover:border-[color-mix(in_oklab,var(--ink)_22%,transparent)]"
              >
                <GithubIcon />
                Star on GitHub
                <span className="rounded-md bg-sunk px-1.5 py-0.5 text-[13px] text-dim">
                  <StarCount repo={REPO_SLUG} saved={SAVED_STARS} />
                </span>
              </a>
            </div>
            <p className="mt-5 text-sm text-dim">
              Linux and Windows, macOS on the way · fully offline · no account
            </p>
          </Rise>
        </section>

        {/* The demo */}
        <section
          aria-label="Try the search"
          className="rise mx-auto w-full max-w-5xl px-4 sm:px-6"
          style={{ "--i": 5 } as React.CSSProperties}
        >
          <SearchDemo />
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="mx-auto w-full max-w-5xl px-4 pt-36 sm:px-6">
          <Reveal>
            <SectionTitle id="how">three steps, then forget it</SectionTitle>
          </Reveal>
          <Steps />
        </section>

        <div className="pt-36">
          <Numbers />
        </div>

        {/* Install */}
        <section
          id="install"
          aria-labelledby="install-title"
          className="mx-auto w-full max-w-5xl px-4 pt-36 sm:px-6"
        >
          <Reveal>
            <SectionTitle id="install-title">install in one line</SectionTitle>
            <Lede>
              No admin rights, no developer tools. It sets everything up, then
              tells you the one thing left to do.
            </Lede>
          </Reveal>
          <Reveal delay={0.1} className="mt-10 max-w-3xl">
            <InstallTabs />
          </Reveal>
        </section>

        {/* Privacy */}
        <section aria-labelledby="private" className="mx-auto w-full max-w-5xl px-4 pt-36 sm:px-6">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_1.05fr] md:gap-14">
            <Reveal>
              <SectionTitle id="private">stays on your machine</SectionTitle>
              <div className="mt-4 flex flex-col gap-4 text-lg leading-relaxed text-dim">
                <p>
                  Screenshots hold passwords, codes, chats and bank details.
                  gyotaku never sends any of it anywhere. No accounts, no
                  telemetry, no update checks.
                </p>
                <p>
                  It goes online once, at setup, for the text reading model and
                  its runtime. After that, unplug the internet if you like.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <figure className="overflow-hidden rounded-2xl bg-panel shadow-[var(--shadow)]">
                <figcaption className="flex items-center justify-between border-b border-line px-4 py-3 text-[13px] text-dim">
                  <span>everything gyotaku does online</span>
                  <span className="font-mono text-[12px] text-faint">all time</span>
                </figcaption>
                <table className="w-full font-mono text-[12px] sm:text-[13px]">
                  <tbody>
                    {traffic.map((t, i) => (
                      <tr key={t.what} className={i ? "border-t border-line" : ""}>
                        <td className="py-3 pr-2 pl-4 align-top text-faint">{t.when}</td>
                        <td className="py-3 pr-2 align-top text-ink">{t.what}</td>
                        <td
                          className={`py-3 pr-4 text-right align-top ${
                            t.when === "after" ? "text-shu" : "text-dim"
                          }`}
                        >
                          {t.result}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figure>
            </Reveal>
          </div>
        </section>

        {/* Open source */}
        <section aria-labelledby="open" className="mx-auto w-full max-w-5xl px-4 pt-36 sm:px-6">
          <Reveal>
            <SectionTitle id="open">built in the open</SectionTitle>
            <Lede>
              Every line is on GitHub under the GPL. Read it, build it, change
              it. Bug reports, ideas and pull requests are all welcome.
            </Lede>
          </Reveal>
          <Reveal delay={0.1}>
            <ul className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
              {stack.map((s) => (
                <li key={s.name} className="bg-bg">
                  <a
                    href={s.href}
                    className="group flex h-full flex-col gap-1 p-5 transition-colors duration-150 hover:bg-panel sm:p-6"
                  >
                    <span className="flex items-center justify-between font-medium text-ink">
                      {s.name}
                      <Arrow
                        direction="up-right"
                        className="size-3 text-faint opacity-0 transition-[opacity,translate] duration-200 ease-out group-hover:translate-x-px group-hover:-translate-y-px group-hover:opacity-100"
                      />
                    </span>
                    <span className="text-sm text-dim">{s.note}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-dim">
            <a
              href={REPO}
              className="press inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-[15px] font-medium text-bg"
            >
              <GithubIcon />
              Read the source
            </a>
            <TextLink href={`${REPO}#roadmap`}>See the roadmap</TextLink>
            <TextLink href={`${REPO}/issues/new/choose`}>Suggest something</TextLink>
          </Reveal>
        </section>

        <div className="pt-36">
          <Why />
        </div>

        {/* Last call: the command itself, for someone who's convinced. */}
        <section className="mx-auto w-full max-w-5xl px-4 pt-36 sm:px-6">
          <Reveal className="relative rounded-3xl bg-panel px-6 pt-14 pb-10 shadow-[var(--shadow)] sm:px-14 sm:pt-20 sm:pb-14">
            <Seal size={76} className="absolute -top-5 right-5 sm:-top-6 sm:right-10" />
            <h2 className="max-w-lg text-[2rem] leading-tight font-medium tracking-[-0.03em] text-ink sm:text-5xl">
              it&apos;s in there somewhere.
            </h2>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-dim">
              That code, that address, that error from last month. Paste this,
              and the next time you need it, just type.
            </p>
            <div className="mt-8">
              <QuickCommand />
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-dim">
              <a
                href="#install"
                className="group inline-flex items-center gap-1.5 py-1 transition-colors duration-150 hover:text-ink"
              >
                Other systems
                <Arrow
                  direction="right"
                  className="size-3 transition-[translate] duration-200 ease-out group-hover:translate-x-0.5"
                />
              </a>
              <TextLink href={`${REPO}/releases/latest`}>Download from releases</TextLink>
              <a
                href={REPO}
                className="group inline-flex items-center gap-1.5 py-1 transition-colors duration-150 hover:text-ink"
              >
                Star on GitHub
                <span className="text-ink">
                  <StarCount repo={REPO_SLUG} saved={SAVED_STARS} />
                </span>
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="mx-auto mt-28 w-full max-w-5xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 border-t border-line py-10 text-sm text-dim sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Mark size={28} className="mt-0.5 shrink-0 rounded-[7px]" />
            <p className="leading-snug">
              <span className="font-medium text-ink">gyotaku</span>, GPL-3.0
              <br />
              made by{" "}
              <a
                href="https://github.com/xevrion"
                className="text-ink underline decoration-line underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-current"
              >
                xevrion
              </a>
              , for everyone who screenshots everything
            </p>
          </div>
          <nav className="-mx-2 flex flex-wrap gap-1">
            <FooterLink href={REPO}>source</FooterLink>
            <FooterLink href={`${REPO}/releases`}>releases</FooterLink>
            <FooterLink href={`${REPO}/blob/main/docs/usage.md`}>docs</FooterLink>
            <FooterLink href={`${REPO}/issues`}>issues</FooterLink>
            <FooterLink href="#top">back to top</FooterLink>
          </nav>
        </div>
      </footer>
    </>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group inline-flex items-center gap-1.5 py-1 transition-colors duration-150 hover:text-ink"
    >
      {children}
      <Arrow
        direction="up-right"
        className="size-3 transition-[translate] duration-200 ease-out group-hover:translate-x-px group-hover:-translate-y-px"
      />
    </a>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="rounded-lg px-2 py-1.5 transition-colors duration-150 hover:text-ink">
      {children}
    </a>
  );
}

import Image from "next/image";
import { Faq } from "@/components/Faq";
import { Features } from "@/components/Features";
import { GithubIcon, Header } from "@/components/Header";
import { HeroInstall } from "@/components/HeroInstall";
import InstallTabs from "@/components/InstallTabs";
import { Mark } from "@/components/Mark";
import Numbers from "@/components/Numbers";
import SearchDemo from "@/components/SearchDemo";
import { StarCount } from "@/components/GithubStars";
import { REPO, REPO_SLUG, SAVED_STARS } from "@/lib/links";
import greatWave from "@/assets/prints/great-wave.jpg";

// The page is static, rebuilt at most once an hour so the star count it
// ships with stays close; the browser then asks GitHub for the live one.
export const revalidate = 3600;

async function stars(): Promise<number> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_SLUG}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    const data = (await res.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === "number" ? data.stargazers_count : SAVED_STARS;
  } catch {
    return SAVED_STARS;
  }
}

const VERSION = "0.1.2";

// Everything gyotaku ever does over the network. Kept honest with the
// README's Privacy section.
const traffic = [
  { when: "setup", what: "text reading model", result: "once, checksum pinned" },
  { when: "setup", what: "ONNX Runtime", result: "once, checksum pinned" },
  { when: "after", what: "your screenshots", result: "never leave" },
  { when: "after", what: "usage data", result: "never collected" },
];

function Title({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display text-[2.25rem] leading-[1.08] text-ink sm:text-5xl">
      {children}
    </h2>
  );
}

export default async function Home() {
  const saved = await stars();

  return (
    <>
      <Header />

      <main id="top" className="overflow-x-clip">
        {/* Hero */}
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pt-16 text-center sm:px-6 sm:pt-24">
          <a
            href={`${REPO}/releases/latest`}
            className="press group inline-flex h-8 items-center gap-2 rounded-full border border-line bg-panel pr-3 pl-1 text-[13px] text-dim hover:text-ink"
          >
            <span className="rounded-full bg-sunk px-2 py-0.5 font-medium text-ink tabular-nums">v{VERSION}</span>
            Free and open source
            <svg viewBox="0 0 16 16" aria-hidden className="size-3 transition-[translate] duration-200 ease-out group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
            </svg>
          </a>

          <h1 className="font-display mt-7 text-[2.9rem] leading-[1.02] text-ink min-[400px]:text-[3.3rem] sm:text-[4.5rem] sm:leading-[1]">
            Ctrl F for your <span className="found">screenshots</span>
          </h1>

          <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-dim sm:text-lg">
            gyotaku reads the text in every screenshot on your computer, so you
            can find any of them by typing a word you remember. Free, open
            source and fully offline.
          </p>

          <div className="mt-8">
            <HeroInstall />
          </div>

          <p className="mt-4 text-[13px] text-faint">Linux and Windows · macOS port in review</p>
        </section>

        {/* The product, live, on Hokusai's Great Wave: a woodblock print, the
            same printmaking tradition gyotaku is named after. */}
        <section aria-label="Try the search" className="mx-auto mt-14 w-full max-w-6xl px-3 sm:mt-16 sm:px-6">
          <div className="relative overflow-hidden rounded-[22px] sm:rounded-[28px]">
            <Image
              src={greatWave}
              alt=""
              fill
              priority
              placeholder="blur"
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="object-cover object-[30%_40%]"
            />
            <div className="relative px-3 pt-10 pb-6 sm:px-14 sm:pt-16 sm:pb-12">
              <SearchDemo onWallpaper />
            </div>
          </div>
          <p className="mt-3 text-right text-[12px] text-faint">
            Background: <i>The Great Wave off Kanagawa</i>, Hokusai, c. 1831
          </p>
        </section>

        <div className="pt-28 sm:pt-36">
          <Features />
        </div>

        <div className="pt-28 sm:pt-36">
          <Numbers />
        </div>

        {/* Install */}
        <section id="install" aria-labelledby="install-title" className="band mt-28 scroll-mt-14 py-20 sm:mt-36 sm:py-28">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <Title id="install-title">Install in one line</Title>
            <p className="mt-3 max-w-xl text-lg leading-relaxed text-dim">
              No admin rights and no developer tools. Run it again any time to
              update.
            </p>
            <div className="mt-10 max-w-3xl">
              <InstallTabs />
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section aria-labelledby="private" className="mx-auto w-full max-w-5xl px-4 pt-28 sm:px-6 sm:pt-36">
          <div className="grid items-start gap-10 md:grid-cols-[1fr_1.05fr] md:gap-14">
            <div>
              <Title id="private">Nothing leaves your computer</Title>
              <p className="mt-4 text-lg leading-relaxed text-dim">
                Screenshots hold passwords, codes, chats and bank details.
                gyotaku reads them on your own CPU and keeps the index on your
                own disk. No account, no telemetry, no update checks.
              </p>
            </div>
            <figure className="overflow-hidden rounded-2xl bg-panel shadow-[var(--shadow)]">
              <figcaption className="flex items-center justify-between border-b border-line px-4 py-3 text-[13px] text-dim">
                <span>Everything gyotaku does online</span>
                <span className="font-mono text-[12px] text-faint">all time</span>
              </figcaption>
              <table className="w-full font-mono text-[12px] sm:text-[13px]">
                <tbody>
                  {traffic.map((t, i) => (
                    <tr key={t.what} className={i ? "border-t border-line" : ""}>
                      <td className="py-3 pr-2 pl-4 align-top text-faint">{t.when}</td>
                      <td className="py-3 pr-2 align-top text-ink">{t.what}</td>
                      <td className={`py-3 pr-4 text-right align-top ${t.when === "after" ? "font-medium text-ink" : "text-dim"}`}>
                        {t.result}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="mx-auto w-full max-w-5xl px-4 pt-28 sm:px-6 sm:pt-36">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:gap-14">
            <div>
              <Title id="faq">Questions</Title>
              <p className="mt-4 text-dim">
                Something else?{" "}
                <a href={`${REPO}/issues`} className="text-ink underline decoration-line-strong underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-current">
                  Open an issue
                </a>
                .
              </p>
            </div>
            <Faq />
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-28 w-full max-w-5xl px-4 sm:mt-36 sm:px-6">
        <div className="flex flex-col gap-8 border-t border-line py-10 text-sm text-dim sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5 font-medium text-ink">
              <Mark size={22} className="rounded-[6px]" />
              gyotaku
            </div>
            <p className="mt-3 leading-relaxed">
              Gyotaku (魚拓) is the Japanese way of keeping a catch: the fish is
              inked and pressed onto paper. This keeps your screenshots&apos;
              words the same way.
            </p>
            <p className="mt-3">
              GPL-3.0 · made by{" "}
              <a href="https://github.com/xevrion" className="text-ink underline decoration-line-strong underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-current">
                xevrion
              </a>
            </p>
          </div>
          <nav aria-label="Links" className="grid grid-cols-2 gap-x-10 gap-y-2 self-start">
            <FooterLink href={REPO}>
              <span className="inline-flex items-center gap-1.5">
                <GithubIcon className="size-3.5" />
                <StarCount repo={REPO_SLUG} saved={saved} />
              </span>
            </FooterLink>
            <FooterLink href={`${REPO}/releases`}>Releases</FooterLink>
            <FooterLink href={`${REPO}/blob/main/docs/usage.md`}>Docs</FooterLink>
            <FooterLink href={`${REPO}/issues`}>Issues</FooterLink>
            <FooterLink href={`${REPO}#roadmap`}>Roadmap</FooterLink>
            <FooterLink href="#top">Back to top</FooterLink>
          </nav>
        </div>
      </footer>
    </>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="py-1 transition-colors duration-150 hover:text-ink">
      {children}
    </a>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Row } from "@/components/Frame";
import { Header } from "@/components/Header";
import { Command } from "@/components/InstallTabs";
import { JsonLd, SITE_GRAPH, breadcrumbs } from "@/components/JsonLd";
import SearchDemo from "@/components/SearchDemo";
import { SiteFooter } from "@/components/SiteFooter";
import { PLATFORMS, SLUGS, type Platform, type Slug } from "@/lib/platforms";
import { SITE_URL } from "@/lib/site";
import greatWave from "@/assets/prints/great-wave.jpg";

// One page per system: /mac, /windows, /linux. Static, generated at build.
export const dynamicParams = false;

export function generateStaticParams() {
  return SLUGS.map((os) => ({ os }));
}

function platform(os: string): Platform {
  if (!(SLUGS as string[]).includes(os)) notFound();
  return PLATFORMS[os as Slug];
}

type Props = { params: Promise<{ os: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = platform((await params).os);
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/${p.slug}` },
    openGraph: {
      type: "website",
      url: `/${p.slug}`,
      siteName: "gyotaku",
      locale: "en_US",
      title: p.title,
      description: p.description,
    },
    twitter: { card: "summary_large_image", title: p.title, description: p.description },
  };
}

const INSET = "px-5 sm:px-8 lg:px-12";
const SPACE = "py-20 sm:py-28";

// `like this` in the copy becomes inline code.
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 ? (
          <code key={i} className="rounded bg-sunk px-1.5 py-0.5 font-mono text-[0.88em] text-ink">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default async function OsPage({ params }: Props) {
  const p = platform((await params).os);
  const others = SLUGS.filter((s) => s !== p.slug).map((s) => PLATFORMS[s]);

  return (
    <>
      <Header base="/" />

      <main id="top" className="overflow-x-clip">
        <Row as="section" inner={`${INSET} pt-14 pb-16 sm:pt-20 sm:pb-20`}>
          <nav aria-label="Breadcrumb" className="text-[13px] text-faint">
            <ol className="flex items-center gap-2">
              <li>
                <a href="/" className="transition-colors duration-150 hover:text-ink">
                  gyotaku
                </a>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-dim">
                {p.name}
              </li>
            </ol>
          </nav>
          <h1 className="font-display mt-6 max-w-3xl text-[2.6rem] leading-[1.04] text-ink sm:text-[3.75rem] sm:leading-[1.02]">
            {p.h1}
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-dim sm:text-lg">{p.lede}</p>

          <div className="mt-9 max-w-2xl min-w-0">
            <Command prompt={p.prompt} command={p.command} />
            <p className="mt-3 text-sm text-dim">{p.commandNote}</p>
            {p.downloads && (
              <div className="mt-5 flex flex-wrap gap-2">
                {p.downloads.map((d) => (
                  <a
                    key={d.href}
                    href={d.href}
                    className="press inline-flex h-10 items-center rounded-[10px] border border-line bg-panel px-4 text-[14px] font-medium text-ink hover:border-line-strong"
                  >
                    {d.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </Row>

        <Row as="section" aria-label="Try the search" inner="px-3 pt-3 pb-4 sm:px-5 sm:pt-5 sm:pb-5">
          <div className="relative overflow-hidden rounded-[18px] sm:rounded-[22px]">
            <Image
              src={greatWave}
              alt="The Great Wave off Kanagawa, a woodblock print by Hokusai"
              fill
              loading="eager"
              fetchPriority="high"
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
        </Row>

        <Row as="section" aria-labelledby="details" inner={`${INSET} ${SPACE}`}>
          <h2 id="details" className="sr-only">
            gyotaku on {p.name}
          </h2>
          <div className="divide-y divide-line border-y border-line">
            {p.sections.map((s) => (
              <div key={s.title} className="grid gap-4 py-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-14">
                <h3 className="font-display text-[1.6rem] leading-[1.15] text-ink sm:text-[1.9rem]">{s.title}</h3>
                {/* min-w-0: a long command scrolls inside its box instead of
                    widening the column past the screen. */}
                <div className="flex min-w-0 flex-col gap-4 text-[16px] leading-relaxed text-dim">
                  {s.body.map((b) => (
                    <p key={b}>
                      <Prose text={b} />
                    </p>
                  ))}
                  {s.rows && (
                    <dl className="divide-y divide-line rounded-xl border border-line">
                      {s.rows.map(([k, v]) => (
                        <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                          <dt className="text-[14px] text-ink">{k}</dt>
                          <dd className="min-w-0 font-mono text-[13px] break-words text-dim">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {s.commands?.map((c) => (
                    <div key={c.command}>
                      {c.label && <p className="mb-2 text-[13px] text-faint">{c.label}</p>}
                      <Command prompt={c.prompt} command={c.command} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Row>

        <Row as="section" aria-labelledby="more" inner={`${INSET} py-16 sm:py-20`}>
          <h2 id="more" className="font-display text-[1.6rem] leading-[1.15] text-ink sm:text-[1.9rem]">
            On another computer?
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {others.map((o) => (
              <a
                key={o.slug}
                href={`/${o.slug}`}
                className="press inline-flex h-10 items-center rounded-[10px] border border-line bg-panel px-4 text-[14px] font-medium text-ink hover:border-line-strong"
              >
                gyotaku for {o.name}
              </a>
            ))}
            <a
              href="/#features"
              className="press inline-flex h-10 items-center rounded-[10px] px-4 text-[14px] text-dim hover:text-ink"
            >
              Everything it does
            </a>
          </div>
        </Row>
      </main>

      <SiteFooter />
      <JsonLd
        graph={[
          ...SITE_GRAPH,
          {
            "@type": "WebPage",
            "@id": `${SITE_URL}/${p.slug}#page`,
            url: `${SITE_URL}/${p.slug}`,
            name: p.title,
            description: p.description,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            about: { "@id": `${SITE_URL}/#app` },
          },
          breadcrumbs([
            { name: "gyotaku", path: "/" },
            { name: p.name, path: `/${p.slug}` },
          ]),
        ]}
      />
    </>
  );
}

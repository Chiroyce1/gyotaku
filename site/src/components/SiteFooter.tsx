import { Row } from "./Frame";
import { GithubIcon } from "./Header";
import { Mark } from "./Mark";
import { StarCount } from "./GithubStars";
import { REPO, REPO_SLUG, SAVED_STARS } from "@/lib/links";

const INSET = "px-5 sm:px-8 lg:px-12";

export function SiteFooter({ stars = SAVED_STARS }: { stars?: number }) {
  return (
    <Row as="footer" divider={false} inner={`${INSET} pt-12 pb-16`}>
      <div className="flex flex-col gap-10 text-sm text-dim sm:flex-row sm:justify-between">
        <div className="max-w-sm">
          <a href="/" className="flex items-center gap-2.5 font-medium text-ink">
            <Mark size={22} className="rounded-[6px]" />
            gyotaku
          </a>
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
        <div className="grid grid-cols-2 gap-x-10 gap-y-8 self-start sm:grid-cols-[auto_auto]">
          <nav aria-label="Systems" className="flex flex-col gap-2">
            <span className="text-faint">Systems</span>
            <FooterLink href="/mac">macOS</FooterLink>
            <FooterLink href="/windows">Windows</FooterLink>
            <FooterLink href="/linux">Linux</FooterLink>
          </nav>
          <nav aria-label="Project" className="flex flex-col gap-2">
            <span className="text-faint">Project</span>
            <FooterLink href={REPO}>
              <span className="inline-flex items-center gap-1.5">
                <GithubIcon className="size-3.5" />
                <StarCount repo={REPO_SLUG} saved={stars} />
              </span>
            </FooterLink>
            <FooterLink href={`${REPO}/releases`}>Releases</FooterLink>
            <FooterLink href={`${REPO}/blob/main/docs/usage.md`}>Docs</FooterLink>
            <FooterLink href={`${REPO}#roadmap`}>Roadmap</FooterLink>
          </nav>
        </div>
      </div>
    </Row>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="py-0.5 transition-colors duration-150 hover:text-ink">
      {children}
    </a>
  );
}

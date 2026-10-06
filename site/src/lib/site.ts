// Where the site lives, for canonical links, the sitemap and social cards.
// NEXT_PUBLIC_SITE_URL overrides it for a preview somewhere else.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://gyotaku.app"
).replace(/\/$/, "");

export const REPO_URL = "https://github.com/xevrion/gyotaku";
export const RELEASES_URL = `${REPO_URL}/releases`;
export const AUTHOR_URL = "https://github.com/xevrion";

// The app version the site describes. Keep in step with the workspace
// version in ../Cargo.toml when a release goes out.
export const APP_VERSION = "0.1.3";

export const TITLE = "gyotaku: search the text in your screenshots";
export const DESCRIPTION =
  "Free, open source app that reads the text in every screenshot on your machine, so you can find any of them by typing a word you remember. Fully offline, for macOS, Windows and Linux.";

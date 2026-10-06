import {
  APP_VERSION,
  AUTHOR_URL,
  DESCRIPTION,
  RELEASES_URL,
  REPO_URL,
  SITE_URL,
} from "@/lib/site";

// Structured data for search engines: what the app is, that it's free, where
// to get it and who made it. No ratings, since there are none to cite.
const data = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "gyotaku",
      description: DESCRIPTION,
      url: SITE_URL,
      image: `${SITE_URL}/opengraph-image`,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Linux, Windows",
      softwareVersion: APP_VERSION,
      downloadUrl: RELEASES_URL,
      license: "https://www.gnu.org/licenses/gpl-3.0.html",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: { "@type": "Person", name: "xevrion", url: AUTHOR_URL },
      sameAs: [REPO_URL],
    },
    {
      "@type": "SoftwareSourceCode",
      "@id": `${REPO_URL}#source`,
      name: "gyotaku",
      codeRepository: REPO_URL,
      programmingLanguage: "Rust",
      license: "https://www.gnu.org/licenses/gpl-3.0.html",
      targetProduct: { "@id": `${SITE_URL}/#app` },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "gyotaku",
      url: SITE_URL,
      inLanguage: "en",
      publisher: { "@type": "Person", name: "xevrion", url: AUTHOR_URL },
    },
  ],
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      // `<` is escaped so the JSON can never close the script tag early.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/** Anchor row from Apify Web Scraper pageFunction (browser DOM). */
export type ApifyPageLink = { href: string; text: string };

/** Result of fetchPageViaJina: Jina text plus browser-extracted links from Apify. */
export type FetchPageViaJinaResult =
  | { ok: true; links: ApifyPageLink[]; text: string }
  | { ok: false; links: []; text: string; error: string };

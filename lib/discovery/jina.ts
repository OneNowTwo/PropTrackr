const MAX_BODY_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 22_000;
/** Apify run-sync waits server-side up to ~300s; allow a long client timeout. */
const APIFY_TIMEOUT_MS = 280_000;

const APIFY_WEB_SCRAPER_SYNC_URL =
  "https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items";

/** Anchor rows from Apify Web Scraper pageFunction (browser DOM). */
export type ApifyPageLink = { href: string; text: string };

/** Result of fetchPageViaJina: Jina markdown/text plus browser-extracted links from Apify. */
export type FetchPageViaJinaResult =
  | { ok: true; links: ApifyPageLink[]; text: string }
  | { ok: false; links: []; text: string; error: string };

/** Mirror of `app/actions/listings.ts` `BROWSER_HEADERS` — keep in sync. */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
} as const;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const MIN_BODY_CHARS = 40;

const WEB_SCRAPER_PAGE_FUNCTION = `async function pageFunction(context) {
  const links = [];
  const anchors = document.querySelectorAll('a[href]');
  anchors.forEach(el => {
    const href = el.href;
    const text = el.innerText.trim().slice(0, 300);
    if (href && href.startsWith('http')) {
      links.push({ href, text });
    }
  });
  return { links: links.slice(0, 50), url: window.location.href };
}`;

/** Web Scraper input (see apify.com/apify/web-scraper/input-schema). */
const WEB_SCRAPER_BASE = {
  linkSelector: "",
  pageFunction: WEB_SCRAPER_PAGE_FUNCTION,
  maxPagesPerCrawl: 1,
  maxResultsPerCrawl: 1,
  proxyConfiguration: { useApifyProxy: true },
} as const;

function parseApifyDatasetItems(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object" && "data" in body) {
    const d = (body as { data: unknown }).data;
    if (Array.isArray(d)) return d;
    if (
      d &&
      typeof d === "object" &&
      "items" in d &&
      Array.isArray((d as { items: unknown[] }).items)
    ) {
      return (d as { items: unknown[] }).items;
    }
  }
  return [];
}

function parseLinksFromDatasetItem(item: unknown): ApifyPageLink[] {
  if (!item || typeof item !== "object") return [];
  const raw = (item as { links?: unknown }).links;
  if (!Array.isArray(raw)) return [];
  const out: ApifyPageLink[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const href = String(o.href ?? "").trim();
    const text = String(o.text ?? "").trim();
    if (href) out.push({ href, text });
  }
  return out;
}

async function fetchPageViaApify(
  targetPageUrl: string,
): Promise<
  { ok: true; links: ApifyPageLink[] } | { ok: false; links: []; error: string }
> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    console.log("[discovery] Apify skipped: APIFY_API_TOKEN is not set");
    return { ok: false, links: [], error: "APIFY_API_TOKEN is not configured." };
  }

  const input = {
    ...WEB_SCRAPER_BASE,
    startUrls: [{ url: targetPageUrl }],
  };

  try {
    const res = await fetchWithTimeout(
      APIFY_WEB_SCRAPER_SYNC_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      },
      APIFY_TIMEOUT_MS,
    );

    const rawText = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const errMsg =
        parsed &&
        typeof parsed === "object" &&
        "error" in parsed &&
        (parsed as { error?: { message?: string } }).error?.message
          ? (parsed as { error: { message: string } }).error.message
          : rawText.slice(0, 400);
      console.log("[discovery] Apify HTTP error:", {
        target: targetPageUrl,
        status: res.status,
        statusText: res.statusText,
        message: errMsg,
      });
      return {
        ok: false,
        links: [],
        error: `Apify HTTP ${res.status} ${res.statusText}: ${errMsg}`,
      };
    }

    const items = parseApifyDatasetItems(parsed);
    const links =
      items.length > 0 ? parseLinksFromDatasetItem(items[0]) : [];
    console.log("[discovery] Apify result:", {
      target: targetPageUrl,
      status: res.status,
      itemCount: items.length,
      linkCount: links.length,
    });

    if (items.length === 0) {
      console.log("[discovery] Apify returned no dataset items:", {
        target: targetPageUrl,
        preview: rawText.slice(0, 500),
      });
      return {
        ok: false,
        links: [],
        error: "Apify returned no dataset items.",
      };
    }

    return { ok: true, links };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[discovery] Apify fetch threw:", {
      target: targetPageUrl,
      error: msg,
    });
    return {
      ok: false,
      links: [],
      error: msg.includes("abort")
        ? "Apify request timed out."
        : `Apify failed: ${msg}`,
    };
  }
}

/**
 * Fetches reader text via Jina, then always runs Apify Web Scraper to collect
 * anchor links from the live DOM (for agency listing discovery).
 */
export async function fetchPageViaJina(
  targetPageUrl: string,
): Promise<FetchPageViaJinaResult> {
  const jinaUrl = `https://r.jina.ai/${targetPageUrl}`;
  let text = "";
  let jinaSummary = "";

  try {
    const res = await fetchWithTimeout(
      jinaUrl,
      {
        redirect: "follow",
        headers: { ...BROWSER_HEADERS },
      },
      FETCH_TIMEOUT_MS,
    );
    const status = res.status;
    const statusText = res.statusText;

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const preview = errBody.slice(0, 300);
      console.log("[jina] Jina HTTP error:", {
        target: targetPageUrl,
        jinaUrl,
        status,
        statusText,
        bodyChars: errBody.length,
        bodyPreview: preview,
      });
      jinaSummary = `Jina HTTP ${status} ${statusText}${preview ? ` — ${preview.slice(0, 120)}` : ""}`;
    } else {
      const body = await res.text();
      text = body.slice(0, MAX_BODY_CHARS);
      if (body.length >= MIN_BODY_CHARS) {
        console.log("[jina] Jina OK:", {
          target: targetPageUrl,
          status,
          chars: body.length,
        });
      } else {
        console.log("[jina] Jina OK but short body:", {
          target: targetPageUrl,
          status,
          chars: body.length,
        });
        jinaSummary = `Jina HTTP ${status} but body only ${body.length} chars`;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[jina] Jina fetch threw:", {
      target: targetPageUrl,
      jinaUrl,
      error: msg,
    });
    jinaSummary = msg.includes("abort")
      ? "Jina request timed out."
      : `Jina fetch failed: ${msg}`;
  }

  const apify = await fetchPageViaApify(targetPageUrl);
  const links = apify.ok ? apify.links : [];

  const textUsable = text.length >= MIN_BODY_CHARS;
  if (textUsable || links.length > 0) {
    return { ok: true, links, text };
  }

  return {
    ok: false,
    links: [],
    text,
    error: `${jinaSummary} | ${apify.ok ? "Apify returned no links." : apify.error}`,
  };
}

const MAX_BODY_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 22_000;
/** Apify run-sync waits server-side up to ~300s; allow a long client timeout. */
const APIFY_TIMEOUT_MS = 280_000;

const APIFY_WEB_SCRAPER_SYNC_URL =
  "https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items";

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

const WEB_SCRAPER_INPUT = {
  pageFunction:
    "async function pageFunction(context) { return { html: document.documentElement.innerHTML } }",
  maxRequestsPerCrawl: 1,
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

function firstItemHtml(items: unknown[]): string {
  const first = items[0];
  if (
    first &&
    typeof first === "object" &&
    "html" in first &&
    typeof (first as { html: unknown }).html === "string"
  ) {
    return (first as { html: string }).html;
  }
  return "";
}

async function fetchPageViaApify(
  targetPageUrl: string,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) {
    console.log("[discovery] Apify skipped: APIFY_API_TOKEN is not set");
    return { ok: false, error: "APIFY_API_TOKEN is not configured." };
  }

  const input = {
    ...WEB_SCRAPER_INPUT,
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
        error: `Apify HTTP ${res.status} ${res.statusText}: ${errMsg}`,
      };
    }

    const items = parseApifyDatasetItems(parsed);
    const html = firstItemHtml(items);
    console.log("[discovery] Apify result:", {
      target: targetPageUrl,
      status: res.status,
      itemCount: items.length,
      htmlChars: html.length,
    });

    if (html.length >= MIN_BODY_CHARS) {
      return { ok: true, body: html.slice(0, MAX_BODY_CHARS) };
    }

    console.log("[discovery] Apify returned no usable html:", {
      target: targetPageUrl,
      itemCount: items.length,
      preview: rawText.slice(0, 500),
    });
    return {
      ok: false,
      error: `Apify returned empty or short html (${html.length} chars, ${items.length} items)`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[discovery] Apify fetch threw:", {
      target: targetPageUrl,
      error: msg,
    });
    return {
      ok: false,
      error: msg.includes("abort")
        ? "Apify request timed out."
        : `Apify failed: ${msg}`,
    };
  }
}

/**
 * Prefer Jina Reader text; if Jina fails or returns too little, scrape the
 * page with Apify Web Scraper (Puppeteer, JS rendering).
 */
export async function fetchPageViaJina(
  targetPageUrl: string,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const jinaUrl = `https://r.jina.ai/${targetPageUrl}`;
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
      const text = await res.text();
      if (text.length >= MIN_BODY_CHARS) {
        console.log("[jina] Jina OK:", {
          target: targetPageUrl,
          status,
          chars: text.length,
        });
        return { ok: true, body: text.slice(0, MAX_BODY_CHARS) };
      }
      console.log("[jina] Jina OK but short body:", {
        target: targetPageUrl,
        status,
        chars: text.length,
      });
      jinaSummary = `Jina HTTP ${status} but body only ${text.length} chars`;
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
  if (apify.ok) {
    return apify;
  }

  return {
    ok: false,
    error: `${jinaSummary} | ${apify.error}`,
  };
}

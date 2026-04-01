const MAX_BODY_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 22_000;

/** Mirror of `app/actions/listings.ts` `BROWSER_HEADERS` — keep in sync. */
export const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
} as const;

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timer);
  }
}

const MIN_BODY_CHARS = 40;

/**
 * Prefer Jina Reader text; if Jina fails or returns too little, try a direct
 * fetch to the target URL with browser-like headers (diagnostics on Render).
 */
export async function fetchPageViaJina(
  targetPageUrl: string,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const jinaUrl = `https://r.jina.ai/${targetPageUrl}`;
  let jinaSummary = "";

  try {
    const res = await fetchWithTimeout(jinaUrl, { ...BROWSER_HEADERS });
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

  try {
    const direct = await fetchWithTimeout(targetPageUrl, {
      ...BROWSER_HEADERS,
    });
    const directText = await direct.text();
    console.log("[jina] Direct fetch:", {
      target: targetPageUrl,
      status: direct.status,
      statusText: direct.statusText,
      ok: direct.ok,
      chars: directText.length,
    });

    if (direct.ok && directText.length >= MIN_BODY_CHARS) {
      return { ok: true, body: directText.slice(0, MAX_BODY_CHARS) };
    }

    if (!direct.ok) {
      console.log("[jina] Direct fetch error body preview:", {
        target: targetPageUrl,
        preview: directText.slice(0, 300),
      });
    }

    return {
      ok: false,
      error: `${jinaSummary} | Direct: HTTP ${direct.status} ${direct.statusText}, ${directText.length} chars`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[jina] Direct fetch threw:", {
      target: targetPageUrl,
      error: msg,
    });
    return {
      ok: false,
      error: `${jinaSummary} | Direct failed: ${msg}`,
    };
  }
}

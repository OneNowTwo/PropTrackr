const MAX_BODY_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 22_000;

const BROWSER_HEADERS = {
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

/** Fetch readable page text via Jina Reader (target must be absolute http(s) URL). */
export async function fetchPageViaJina(
  targetPageUrl: string,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const jinaUrl = `https://r.jina.ai/${targetPageUrl}`;
  try {
    const res = await fetchWithTimeout(jinaUrl, { ...BROWSER_HEADERS });
    if (!res.ok) {
      return {
        ok: false,
        error: `Jina HTTP ${res.status}`,
      };
    }
    const text = await res.text();
    if (text.length < 40) {
      return { ok: false, error: "Jina returned too little content." };
    }
    return { ok: true, body: text.slice(0, MAX_BODY_CHARS) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("abort")) {
      return { ok: false, error: "Jina request timed out." };
    }
    return { ok: false, error: "Jina fetch failed." };
  }
}

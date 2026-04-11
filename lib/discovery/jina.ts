import type { JinaTextResult } from "@/lib/discovery/types";

export type { JinaTextResult };

const MAX_BODY_CHARS = 120_000;
const FETCH_TIMEOUT_MS = 22_000;

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
} as const;

const MIN_BODY_CHARS = 40;

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

/**
 * Fetches reader markdown/text for a target URL via Jina (`r.jina.ai/{url}`).
 * No browser automation or Apify — suitable for SERPs and static listing pages.
 */
export async function fetchTextViaJina(
  targetPageUrl: string,
): Promise<JinaTextResult> {
  const trimmed = targetPageUrl.trim();
  if (!trimmed) {
    return { ok: false, text: "", error: "Empty URL." };
  }

  const jinaUrl = `https://r.jina.ai/${trimmed}`;

  try {
    const res = await fetchWithTimeout(
      jinaUrl,
      {
        redirect: "follow",
        headers: { ...BROWSER_HEADERS },
      },
      FETCH_TIMEOUT_MS,
    );

    // Blocked upstream — fail fast; do not read a large body or wait further.
    if (res.status === 403) {
      console.log("[jina] 403 forbidden (short-circuit):", {
        target: trimmed.slice(0, 120),
      });
      return {
        ok: false,
        text: "",
        error: "Jina HTTP 403 (forbidden).",
      };
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const preview = errBody.slice(0, 200);
      console.log("[jina] Jina HTTP error:", {
        target: trimmed.slice(0, 120),
        status: res.status,
        preview,
      });
      return {
        ok: false,
        text: "",
        error: `Jina HTTP ${res.status}: ${preview.slice(0, 120)}`,
      };
    }

    const body = await res.text();
    const text = body.slice(0, MAX_BODY_CHARS);
    if (body.length < MIN_BODY_CHARS) {
      return {
        ok: false,
        text,
        error: `Jina body too short (${body.length} chars).`,
      };
    }

    console.log("[jina] OK:", { target: trimmed.slice(0, 100), chars: body.length });
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[jina] fetch threw:", { target: trimmed.slice(0, 100), error: msg });
    return {
      ok: false,
      text: "",
      error: msg.includes("abort") ? "Jina request timed out." : `Jina failed: ${msg}`,
    };
  }
}

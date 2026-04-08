/** Decode common percent-encodings so we match REA query params reliably. */
function normalizeReaUrlForParamCheck(u: string): string {
  return u.toLowerCase().replace(/%2c/g, ",").replace(/%3d/g, "=");
}

/**
 * REA CDN URLs with resize/extend or grey letterbox padding — blurry or letterboxed.
 * Prefer clean paths like /800x600/ without these query segments.
 */
function isReaLetterboxedOrExtendUrl(u: string): boolean {
  const lower = u.toLowerCase();
  if (!lower.includes("reastatic")) return false;
  const norm = normalizeReaUrlForParamCheck(u);
  if (norm.includes("resize,extend")) return true;
  if (
    lower.includes("r=33") &&
    lower.includes("g=40") &&
    lower.includes("b=46")
  ) {
    return true;
  }
  if (norm.includes("crop,gravity")) {
    const smallDim =
      /\b(200|220|240|260|270|280|300|310|320|330|340|350|360|380|400)x\d+|\d+x(200|220|240|260|270|280|300|310|320|330|340|350|360|380|400)\b/i.test(
        lower,
      );
    if (smallDim) return true;
  }
  return false;
}

/** Junk / non-listing image URLs (HTML scraper, DOM extension filter, enrichment merge). */
export function junkImageUrl(u: string): boolean {
  const lower = u.toLowerCase();
  if (isReaLetterboxedOrExtendUrl(u)) return true;
  const pathOnly = lower.split(/[?#]/)[0];
  if (pathOnly.endsWith(".svg")) return true;
  if (lower.includes("argonaut.au.reastatic.net")) return true;
  if (lower.includes("/logo")) return true;
  if (lower.includes("/phone-icon")) return true;
  if (lower.includes("doraexplorer")) return true;
  if (lower.includes("200x200-crop")) return true;
  if (lower.includes("340x64")) return true;
  if (lower.includes("300x170")) return true;
  if (lower.includes("310x175")) return true;
  return /favicon|gravatar|doubleclick|facebook\.com\/tr|analytics|pixel\.gif|spacer|blank\.gif|clear\.gif|1x1|beacon|google-analytics|logo|icon-|sprite|avatar|profile-photo|agent-headshot|headshot|maps\.google|gstatic\.com\/maps|\.svg(\?|$)|webpack|bundle\.js|placeholder|spinner|loading\.gif|emoji|wp-content\/plugins\/|\/ads?\//i.test(
    lower,
  );
}

/** Junk / non-listing image URLs (HTML scraper, DOM extension filter, enrichment merge). */
export function junkImageUrl(u: string): boolean {
  const lower = u.toLowerCase();
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

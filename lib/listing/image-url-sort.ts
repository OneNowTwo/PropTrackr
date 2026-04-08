/**
 * Higher score = preferred when sorting (hero / dedupe winners).
 * REA i2: prefer 1000×750, then 800×600, then full 2216×1248 without resize/extend,
 * then other sizes; 360×270 last among common tiers.
 */
export function scoreImageUrlPreferredSize(u: string): number {
  const s = u.toLowerCase();
  const norm = s.replace(/%2c/g, ",").replace(/%3d/g, "=");

  if (s.includes("reastatic")) {
    if (s.includes("/1000x750/")) return 100;
    if (s.includes("/800x600/")) return 95;
    if (s.includes("/2216x1248/")) {
      return norm.includes("resize,extend") ? 42 : 92;
    }
    if (s.includes("/360x270/")) return 28;
    if (/\b1200x\d+|\d+x1200\b|\/1200x|\b1200w\b/i.test(s)) return 88;
    if (/\b1000x\d+|\d+x1000\b|\/1000x|\b1000w\b/i.test(s)) return 85;
    if (/\b1280x|\d+x1280\b/i.test(s)) return 84;
    if (/\b800x\d+|\d+x800\b|\/800x|\b800w\b/i.test(s)) return 82;
    if (/\b640x|\d+x640\b|\b720x/i.test(s)) return 70;
    if (/\b400x\d+|\d+x400\b|\/400x|\b400w\b/i.test(s)) return 40;
    if (/\b360x\d+|\d+x360\b|\/360x/i.test(s)) return 32;
    return 52;
  }

  if (/\b1200x\d+|\d+x1200\b|\/1200x|\b1200w\b/i.test(s)) return 100;
  if (/\b1000x\d+|\d+x1000\b|\/1000x|\b1000w\b/i.test(s)) return 96;
  if (/\b1280x|\d+x1280\b/i.test(s)) return 95;
  if (/\b800x\d+|\d+x800\b|\/800x|\b800w\b/i.test(s)) return 90;
  if (/\b640x|\d+x640\b|\b720x/i.test(s)) return 70;
  if (/\b400x\d+|\d+x400\b|\/400x|\b400w\b/i.test(s)) return 40;
  if (/\b360x\d+|\d+x360\b|\/360x/i.test(s)) return 30;
  return 50;
}

export function sortImageUrlsByPreferredSize(urls: string[]): string[] {
  return [...urls].sort(
    (a, b) => scoreImageUrlPreferredSize(b) - scoreImageUrlPreferredSize(a),
  );
}

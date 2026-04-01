/** Encode a suburb preference for storage in `search_preferences.suburbs` (text[]). */
export function formatSuburbPreferenceToken(p: {
  suburb: string;
  postcode?: string;
  state?: string;
}): string {
  const suburb = p.suburb.trim();
  const postcode = (p.postcode ?? "").trim();
  const state = (p.state ?? "NSW").trim() || "NSW";
  return `${suburb}|${postcode}|${state}`;
}

export function parseSuburbPreferenceToken(token: string): {
  suburb: string;
  postcode: string;
  state: string;
} {
  const t = token.trim();
  if (!t) return { suburb: "", postcode: "", state: "NSW" };
  if (!t.includes("|")) {
    return { suburb: t, postcode: "", state: "NSW" };
  }
  const parts = t.split("|");
  const suburb = (parts[0] ?? "").trim();
  const postcode = (parts[1] ?? "").trim();
  const state = (parts[2] ?? "NSW").trim() || "NSW";
  return { suburb, postcode, state };
}

export function formatSuburbPreferenceDisplay(token: string): string {
  const p = parseSuburbPreferenceToken(token);
  if (p.postcode) return `${p.suburb} ${p.postcode}`;
  return p.suburb;
}

export type SuburbPreferenceContext = {
  suburb: string;
  postcode: string;
  state: string;
};

export function preferenceTokenToContext(
  token: string,
): SuburbPreferenceContext {
  return parseSuburbPreferenceToken(token);
}

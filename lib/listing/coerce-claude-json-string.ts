/**
 * Coerces Claude/model JSON values before calling .trim() or URL parsing.
 * Handles string, nested arrays (joined with newlines), null, numbers, objects.
 */
export function coerceClaudeJsonString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => coerceClaudeJsonString(item)).join("\n");
  }
  if (value == null) return "";
  return String(value);
}

/** Alias — same rules as {@link coerceClaudeJsonString} (e.g. notesSummary). */
export const coerceNotesSummary = coerceClaudeJsonString;

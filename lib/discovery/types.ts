/** Plain text from Jina reader (`r.jina.ai/...`). */
export type JinaTextResult =
  | { ok: true; text: string }
  | { ok: false; text: string; error: string };

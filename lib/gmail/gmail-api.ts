type GmailHeader = { name: string; value: string };

export type GmailMessageListItem = { id: string; threadId: string };

export async function listMessageIds(
  accessToken: string,
  query: string,
  maxResults: number,
): Promise<GmailMessageListItem[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Gmail list failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    messages?: { id: string; threadId: string }[];
  };
  return data.messages ?? [];
}

export async function getGmailProfileEmail(
  accessToken: string,
): Promise<string> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Gmail profile failed: ${res.status}`);
  }
  const data = (await res.json()) as { emailAddress?: string };
  if (!data.emailAddress) throw new Error("No Gmail address in profile");
  return data.emailAddress;
}

export type ParsedGmailMessage = {
  id: string;
  threadId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  receivedAt: Date;
  labelIds?: string[];
  parts: GmailPart[];
};

export type GmailPart = {
  mimeType: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
};

export async function getMessageFull(
  accessToken: string,
  messageId: string,
): Promise<ParsedGmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Gmail get message failed: ${res.status}`);
  }
  const raw = (await res.json()) as {
    id: string;
    threadId: string;
    labelIds?: string[];
    payload?: GmailPart;
    internalDate?: string;
  };
  const headers =
    (raw.payload as { headers?: GmailHeader[] } | undefined)?.headers ?? [];
  const fromParsed = parseFrom(findHeader(headers, "From"));
  const subject = findHeader(headers, "Subject") ?? "(no subject)";
  const dateHeader = findHeader(headers, "Date");
  const receivedAt = raw.internalDate
    ? new Date(Number(raw.internalDate))
    : dateHeader
      ? new Date(dateHeader)
      : new Date();

  const { text, html } = extractBodies(raw.payload);

  const parts: GmailPart[] = [];
  collectAttachmentParts(raw.payload, parts);

  return {
    id: raw.id,
    threadId: raw.threadId ?? raw.id,
    fromEmail: fromParsed.email,
    fromName: fromParsed.name,
    subject,
    bodyText: text,
    bodyHtml: html,
    receivedAt,
    labelIds: raw.labelIds,
    parts,
  };
}

function findHeader(headers: GmailHeader[], name: string): string | undefined {
  const h = headers.find(
    (x) => x.name.toLowerCase() === name.toLowerCase(),
  );
  return h?.value;
}

function parseFrom(from: string | undefined): {
  email: string;
  name: string | null;
} {
  if (!from?.trim()) return { email: "unknown@unknown", name: null };
  const m = from.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/);
  if (m) {
    return {
      name: m[1]?.trim() || null,
      email: m[2].trim().toLowerCase(),
    };
  }
  const email = from.replace(/.*<([^>]+)>.*/, "$1").trim().toLowerCase();
  return { name: null, email: email || from.trim().toLowerCase() };
}

function decodeB64(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractBodies(part: GmailPart | undefined): {
  text: string;
  html: string | null;
} {
  if (!part) return { text: "", html: null };
  let text = "";
  let htmlChunks: string[] = [];

  function walk(p: GmailPart | undefined) {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) {
      text += decodeB64(p.body.data);
    }
    if (p.mimeType === "text/html" && p.body?.data) {
      htmlChunks.push(decodeB64(p.body.data));
    }
    if (p.parts) for (const c of p.parts) walk(c);
  }
  walk(part);
  const htmlJoined = htmlChunks.join("").trim();
  return { text: text.trim(), html: htmlJoined.length ? htmlJoined : null };
}

function collectAttachmentParts(part: GmailPart | undefined, out: GmailPart[]) {
  if (!part) return;
  if (
    part.filename &&
    part.body?.attachmentId &&
    part.mimeType !== "application/pgp-signature"
  ) {
    out.push(part);
  }
  if (part.parts) for (const c of part.parts) collectAttachmentParts(c, out);
}

export async function fetchAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Gmail attachment failed: ${res.status}`);
  }
  const data = (await res.json()) as { data?: string };
  if (!data.data) throw new Error("Empty attachment");
  const normalized = data.data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

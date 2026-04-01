"use client";

import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";
import { useMemo } from "react";

marked.setOptions({ gfm: true, breaks: true });

export function VerdictMarkdown({ text }: { text: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "strong",
        "em",
        "b",
        "i",
        "ul",
        "ol",
        "li",
        "a",
        "h1",
        "h2",
        "h3",
        "h4",
        "blockquote",
        "code",
        "pre",
      ],
      ALLOWED_ATTR: ["href", "rel", "target"],
    });
  }, [text]);

  return (
    <div
      className="verdict-md text-sm leading-relaxed text-[#111827] [&_a]:text-[#0D9488] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#E5E7EB] [&_blockquote]:pl-3 [&_blockquote]:text-[#4B5563] [&_code]:rounded [&_code]:bg-[#F3F4F6] [&_code]:px-1 [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-[#111827] [&_ul]:list-disc [&_ul]:pl-5"
      // AI-generated comparison copy; sanitized HTML only.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

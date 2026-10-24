// Turn untrusted feed content into safe, short plain text.
// Output contains no HTML tags. The frontend must still insert it with textContent.

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(input) {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] === "#") {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 32 || code > 0x10ffff) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

// Remove all HTML and return clean plain text.
export function stripHtml(input) {
  if (!input) return "";
  let text = String(input);

  // Drop script/style/iframe blocks together with their contents.
  text = text.replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, " ");
  // Drop HTML comments.
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  // Drop every remaining tag.
  text = text.replace(/<[^>]*>/g, " ");
  // Decode entities, then strip again in case decoding produced new tags (e.g. &lt;script&gt;).
  text = decodeEntities(text);
  text = text.replace(/<[^>]*>/g, " ");
  // Remove control characters, then collapse whitespace.
  text = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

// Cut text to maxLength characters at a word boundary, adding an ellipsis if shortened.
export function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s.,;:!?-]+$/, "") + "…";
}

// Convenience: clean a summary and shorten it to an excerpt.
export function makeExcerpt(input, maxLength) {
  const cleaned = stripHtml(input)
    .replace(/\s*The post\b.*appeared first on\b.*$/i, "") // WordPress "appeared first on" footer
    .replace(/\s*\[(?:\.\.\.|…)\]\s*$/, "") // trailing [...] marker
    .trim();
  return truncate(cleaned, maxLength);
}

// Titles get cleaned but not shortened (only trimmed to a sane limit).
export function cleanTitle(input) {
  return truncate(stripHtml(input), 300);
}

// Only allow http(s) links, which blocks javascript: and data: URLs.
export function safeUrl(input) {
  try {
    const url = new URL(String(input).trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
];

export function isOcfRichText(value: string | null | undefined) {
  return /<\/?[a-z][^>]*>/i.test(value ?? "");
}

export function sanitizeOcfRichText(value: string) {
  return sanitizeHtml(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noreferrer noopener" }),
    },
  }).trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Keeps existing plain-text settings readable in the editor and turns their
// blank-line paragraphs into editor paragraphs on the next save.
export function plainTextToOcfHtml(value: string) {
  if (isOcfRichText(value)) return sanitizeOcfRichText(value);
  return value
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.split(/\r?\n/).map(escapeHtml).join("<br>")}</p>`)
    .join("");
}

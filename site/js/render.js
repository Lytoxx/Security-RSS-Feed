// Builds the DOM for feed items. Everything uses textContent, never innerHTML.

const RELATIVE_UNITS = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const absoluteFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatRelative(iso, now = Date.now()) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const diff = time - now;
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return relativeFormat.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function formatAbsolute(iso) {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "" : absoluteFormat.format(time);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderItem(item) {
  const card = el("article", "item");
  card.dataset.category = item.category;

  // Meta line: source, date, category
  const meta = el("div", "item-meta");
  meta.append(el("span", "item-source", item.source));

  if (item.published) {
    const time = el("time", "item-date", `${formatRelative(item.published)} · ${formatAbsolute(item.published)}`);
    time.setAttribute("datetime", item.published);
    meta.append(time);
  } else {
    meta.append(el("span", "item-date", "date unknown"));
  }
  card.append(meta);

  // Title (link opens the original in a new tab)
  const heading = el("h2", "item-title");
  const link = el("a", "", item.title);
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  heading.append(link);
  card.append(heading);

  // Short summary
  if (item.summary) card.append(el("p", "item-summary", item.summary));

  // Other sources that covered the same story
  if (item.alsoCoveredBy && item.alsoCoveredBy.length > 0) {
    card.append(el("p", "item-also", `Also reported by: ${item.alsoCoveredBy.join(", ")}`));
  }

  return card;
}

export function renderItems(container, items) {
  const fragment = document.createDocumentFragment();
  if (items.length === 0) {
    fragment.append(el("p", "empty", "No items match your filters."));
  } else {
    for (const item of items) fragment.append(renderItem(item));
  }
  container.replaceChildren(fragment);
}
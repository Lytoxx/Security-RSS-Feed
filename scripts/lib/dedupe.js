// Remove duplicate items across feeds.
// Items must have at least: title, link, published (ISO string or ""), source (display name).
// Keeps the earliest-published copy and records the other sources in "alsoCoveredBy".

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$|source$|cmpid$|_hsenc$|_hsmi$|mkt_tok$)/i;

export function normalizeUrl(input) {
  try {
    const url = new URL(input);
    url.hash = "";
    url.hostname = url.hostname.replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const query = url.searchParams.toString();
    return `${url.hostname}${path}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return String(input).trim().toLowerCase();
  }
}

export function normalizeTitle(input) {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Earlier date wins; items with no date lose to items with a date.
function isEarlier(a, b) {
  const ta = a.published ? Date.parse(a.published) : Infinity;
  const tb = b.published ? Date.parse(b.published) : Infinity;
  return ta < tb;
}

export function dedupe(items) {
  const byLink = new Map();
  const byTitle = new Map();
  const kept = [];

  for (const item of items) {
    const linkKey = normalizeUrl(item.link);
    const titleKey = normalizeTitle(item.title);
    // Very short titles (e.g. "Update") are too generic to match on.
    const useTitle = titleKey.length >= 15;

    const existing = byLink.get(linkKey) ?? (useTitle ? byTitle.get(titleKey) : undefined);

    if (!existing) {
      const entry = { ...item, alsoCoveredBy: [] };
      kept.push(entry);
      byLink.set(linkKey, entry);
      if (useTitle) byTitle.set(titleKey, entry);
      continue;
    }

    // Duplicate found: keep whichever copy was published first.
    let winner = existing;
    let loser = item;
    if (isEarlier(item, existing)) {
      const previous = { ...existing };
      Object.assign(existing, item); // overwrite in place so the Maps still point at it
      existing.alsoCoveredBy = previous.alsoCoveredBy;
      winner = existing;
      loser = previous;
    }

    if (loser.source !== winner.source && !winner.alsoCoveredBy.includes(loser.source)) {
      winner.alsoCoveredBy.push(loser.source);
    }
    byLink.set(linkKey, winner);
    if (useTitle) byTitle.set(titleKey, winner);
  }

  return kept;
}
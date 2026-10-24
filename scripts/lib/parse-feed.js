// Parse RSS 2.0 and Atom XML into one common item shape.
// Output item: { title, link, published, summary, guid }
// "summary" is raw text here; HTML stripping and truncation happen in sanitize.js (next step).

import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  trimValues: true,
});

// fast-xml-parser returns a single object when there is one item, an array when there are many.
function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// A field may be a string, a number, or an object like { "#text": "...", "@_type": "html" }.
function text(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return text(value["#text"]);
  return String(value).trim();
}

// Atom links are objects with attributes; prefer rel="alternate" (or no rel).
function atomLink(linkField) {
  const links = toArray(linkField);
  const alternate =
    links.find((l) => typeof l === "object" && (!l["@_rel"] || l["@_rel"] === "alternate")) ??
    links[0];
  if (!alternate) return "";
  return typeof alternate === "object" ? text(alternate["@_href"]) : text(alternate);
}

// Returns an ISO date string, or "" if the date is missing or unparseable.
function toIsoDate(value) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function parseRssItem(item) {
  return {
    title: text(item.title),
    link: text(item.link) || text(item.guid),
    published: toIsoDate(item.pubDate ?? item["dc:date"]),
    summary: text(item.description) || text(item["content:encoded"]),
    guid: text(item.guid) || text(item.link),
  };
}

function parseAtomEntry(entry) {
  return {
    title: text(entry.title),
    link: atomLink(entry.link),
    published: toIsoDate(entry.published ?? entry.updated),
    summary: text(entry.summary) || text(entry.content),
    guid: text(entry.id) || atomLink(entry.link),
  };
}

export function parseFeed(xml) {
  const doc = parser.parse(xml);

  let items;
  if (doc.rss?.channel) {
    items = toArray(doc.rss.channel.item).map(parseRssItem);
  } else if (doc.feed) {
    items = toArray(doc.feed.entry).map(parseAtomEntry);
  } else if (doc["rdf:RDF"]) {
    items = toArray(doc["rdf:RDF"].item).map(parseRssItem); // older RSS 1.0
  } else {
    throw new Error("Unrecognized feed format (not RSS or Atom)");
  }

  // Drop entries that are unusable (no title or no link).
  return items.filter((item) => item.title && item.link);
}
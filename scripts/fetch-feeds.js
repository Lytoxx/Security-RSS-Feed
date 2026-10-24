// Entry point: fetch all feeds, normalize, dedupe, and write site/data/feeds.json.
// Run with: npm run fetch

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { fetchText } from "./lib/http.js";
import { parseFeed } from "./lib/parse-feed.js";
import { makeExcerpt, cleanTitle, safeUrl } from "./lib/sanitize.js";
import { dedupe } from "./lib/dedupe.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = path.join(ROOT, "config", "feeds.json");
const OUTPUT_DIR = path.join(ROOT, "site", "data");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "feeds.json");

const CONCURRENCY = 5;

// Run async tasks with a limit on how many run at once.
async function mapWithLimit(list, limit, task) {
  const results = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const index = next++;
      results[index] = await task(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return results;
}

async function processFeed(feed, settings) {
  const started = Date.now();
  try {
    const xml = await fetchText(feed.url, {
      timeoutMs: settings.requestTimeoutMs,
      userAgent: settings.userAgent,
    });
    const parsed = parseFeed(xml);

    const cutoff = Date.now() - settings.maxItemAgeDays * 24 * 60 * 60 * 1000;
    const items = [];

    for (const raw of parsed) {
      const link = safeUrl(raw.link);
      const title = cleanTitle(raw.title);
      if (!link || !title) continue;

      // Items without a date are kept; items older than the cutoff are dropped.
      if (raw.published && Date.parse(raw.published) < cutoff) continue;

      items.push({
        title,
        link,
        published: raw.published,
        summary: makeExcerpt(raw.summary, settings.excerptLength),
        source: feed.name,
        sourceId: feed.id,
        category: feed.category,
      });
    }

    // Newest first, then apply the per-feed cap.
    items.sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));
    const limited = items.slice(0, settings.maxItemsPerFeed);

    return {
      items: limited,
      status: { id: feed.id, name: feed.name, category: feed.category, ok: true, itemCount: limited.length, ms: Date.now() - started },
    };
  } catch (error) {
    return {
      items: [],
      status: { id: feed.id, name: feed.name, category: feed.category, ok: false, error: error.message, ms: Date.now() - started },
    };
  }
}

async function main() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const { settings, categories } = config;
  const feeds = config.feeds.filter((f) => f.enabled !== false);

  console.log(`Fetching ${feeds.length} feeds...`);
  const results = await mapWithLimit(feeds, CONCURRENCY, (feed) => processFeed(feed, settings));

  const feedStatus = results.map((r) => r.status);
  const allItems = results.flatMap((r) => r.items);

  const merged = dedupe(allItems).sort(
    (a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0)
  );

  const output = {
    lastUpdated: new Date().toISOString(),
    categories,
    feeds: feedStatus,
    items: merged,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");

  // Console report
  for (const s of feedStatus) {
    console.log(s.ok ? `  OK    ${s.name} (${s.itemCount} items, ${s.ms} ms)` : `  FAIL  ${s.name}: ${s.error}`);
  }
  const failed = feedStatus.filter((s) => !s.ok).length;
  console.log(`\nWrote ${merged.length} items (${allItems.length - merged.length} duplicates removed) to site/data/feeds.json`);
  console.log(failed ? `${failed} feed(s) failed.` : "All feeds OK.");

  // Only fail the run if nothing worked at all.
  if (failed === feedStatus.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
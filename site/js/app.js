import { getTheme, setTheme } from "./storage.js";
import { renderItems } from "./render.js";
import { createState, applyFilters, renderTabs, fillSources } from "./filters.js";

const DATA_URL = "data/feeds.json";

const els = {
  lastUpdated: document.getElementById("last-updated"),
  themeToggle: document.getElementById("theme-toggle"),
  items: document.getElementById("items"),
  tabs: document.getElementById("tabs"),
  search: document.getElementById("search"),
  source: document.getElementById("source-filter"),
  count: document.getElementById("result-count"),
  warnings: document.getElementById("feed-warnings"),

};

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const next = theme === "dark" ? "light" : "dark";
  els.themeToggle.setAttribute("aria-label", `Switch to ${next} theme`);
}

function initTheme() {
  applyTheme(getTheme());
  els.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  });
}

// ---------- Data ----------
async function loadData() {
  const response = await fetch(DATA_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function formatLastUpdated(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Last updated: unknown";
  return `Last updated: ${date.toLocaleString()}`;
}

// ---------- Warnings ----------
function showWarnings(feeds) {
  const failed = feeds.filter((feed) => !feed.ok);
  if (failed.length === 0) {
    els.warnings.hidden = true;
    return;
  }
  const lines = failed.map((feed) => `${feed.name}: ${feed.error}`);
  els.warnings.textContent = `${failed.length} feed(s) failed to update. ${lines.join(" | ")}`;
  els.warnings.hidden = false;
}

// ---------- View ----------
function startApp(data) {
  const state = createState();

  function update() {
    const visible = applyFilters(data.items, state);
    renderTabs(els.tabs, data.categories, data.items, state, (id) => {
      state.category = id;
      update();
    });
    renderItems(els.items, visible);
    els.count.textContent = `${visible.length} of ${data.items.length} items`;
  }

  fillSources(els.source, data.feeds);
  els.search.addEventListener("input", () => {
    state.query = els.search.value;
    update();
  });
  els.source.addEventListener("change", () => {
    state.source = els.source.value;
    update();
  });

  update();
}

async function init() {
  initTheme();
  let data;
  try {
    data = await loadData();
  } catch (error) {
    els.lastUpdated.textContent = "Could not load feed data";
    console.error("Failed to load feeds.json:", error);
    return;
  }
  els.lastUpdated.textContent = formatLastUpdated(data.lastUpdated);
  showWarnings(data.feeds);
  startApp(data);
}

init();
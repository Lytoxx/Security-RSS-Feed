// Filtering logic and the controls that drive it. No HTML is built from data here:
// every label is set with textContent.

export function createState() {
  return { category: "all", source: "", query: "" };
}

export function applyFilters(items, state) {
  const query = state.query.trim().toLowerCase();
  return items.filter((item) => {
    if (state.category !== "all" && item.category !== state.category) return false;
    if (state.source && item.source !== state.source) return false;
    if (query) {
      const haystack = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function countBy(items, state) {
  // Counts per category, respecting the source filter and search (but not the category itself).
  const counts = { all: 0 };
  for (const item of applyFilters(items, { ...state, category: "all" })) {
    counts.all += 1;
    counts[item.category] = (counts[item.category] || 0) + 1;
  }
  return counts;
}

export function renderTabs(container, categories, items, state, onSelect) {
  const counts = countBy(items, state);
  const tabs = [{ id: "all", label: "All" }, ...categories];
  const fragment = document.createDocumentFragment();

  tabs.forEach((tab) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(state.category === tab.id));
    button.tabIndex = state.category === tab.id ? 0 : -1;
    button.dataset.id = tab.id;
    if (tab.id !== "all") button.style.setProperty("--tab-color", `var(--cat-${tab.id})`);

    button.append(document.createTextNode(tab.label));
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = String(counts[tab.id] || 0);
    button.append(count);

    button.addEventListener("click", () => onSelect(tab.id));
    fragment.append(button);
  });

  container.replaceChildren(fragment);

  // Arrow-key navigation between tabs
  container.onkeydown = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const ids = tabs.map((t) => t.id);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = ids[(ids.indexOf(state.category) + step + ids.length) % ids.length];
    onSelect(next);
    container.querySelector(`[data-id="${next}"]`)?.focus();
  };
}

export function fillSources(select, feeds) {
  const names = [...new Set(feeds.map((f) => f.name))].sort((a, b) => a.localeCompare(b));
  const fragment = document.createDocumentFragment();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All sources";
  fragment.append(all);
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    fragment.append(option);
  }
  select.replaceChildren(fragment);
}
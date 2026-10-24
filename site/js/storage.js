// Small wrapper around localStorage. Every call is wrapped in try/catch because
// storage can be blocked (private windows, strict browser settings).

export function loadValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the page still works, the setting just won't persist.
  }
}

// Theme: "dark" (default) or "light".
export function getTheme() {
  const saved = loadValue("cyberfeed.theme", null);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

export function setTheme(theme) {
  saveValue("cyberfeed.theme", theme);
}
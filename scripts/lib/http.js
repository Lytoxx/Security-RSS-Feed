// Fetch a URL as text, with a timeout, retries, and a polite User-Agent.
// Throws an Error with a readable message if every attempt fails.

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

class HttpError extends Error {
  constructor(status, statusText) {
    super(`HTTP ${status} ${statusText}`.trim());
    this.status = status;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error) {
  if (error instanceof HttpError) return RETRYABLE_STATUS.has(error.status);
  return true; // timeouts and network errors are worth retrying
}

export async function fetchText(url, { timeoutMs, userAgent, retries = 2 } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": userAgent,
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.5",
        },
      });

      if (!response.ok) throw new HttpError(response.status, response.statusText);
      return await response.text();
    } catch (error) {
      lastError =
        error.name === "AbortError"
          ? new Error(`Timed out after ${timeoutMs} ms`)
          : error;
      if (!isRetryable(lastError)) break; // 404, 403, etc. will not improve
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) await sleep(1000 * 2 ** attempt); // wait 1s, then 2s
  }

  throw lastError;
}
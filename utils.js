function getDatesInRange(from, to) {
  const dates = [];
  const cur = new Date(from);
  const end = new Date(to);

  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return dates;
}

function mergeCSV(csvStrArr) {
  const mergedChunks = [];

  for (const str of csvStrArr) {
    if (mergedChunks.length === 0) {
      mergedChunks.push(str.trim());
      continue;
    }
    const lines = str.trim().split(/\r?\n/);
    mergedChunks.push(lines.slice(1).join("\n"));
  }

  return mergedChunks.join("\n");
}

async function safeFetch(url, options, isJson = true, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-2xx HTTP status codes
    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }
      throw new Error(
        `HTTP ${response.status} (${response.statusText}): ${
          errorBody ? JSON.stringify(errorBody) : "No error details"
        }`,
      );
    }

    try {
      return isJson ? await response.json() : await response.text();
    } catch (parseError) {
      throw new Error(`Failed to parse response JSON: ${parseError.message}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Network error: ${error.message}`);
    }
    throw error;
  }
}

module.exports = {
  getDatesInRange,
  mergeCSV,
  safeFetch,
};

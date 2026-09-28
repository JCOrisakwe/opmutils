const excelJs = require("exceljs");
const { Readable } = require("stream");

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

function ensureArray(item) {
  return Array.isArray(item) ? item : [item];
}

function flattenObject(obj, prefix = "") {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}_${key}` : key;

    if (value !== undefined && value !== null && value.constructor == Object) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

async function exportJsonToExcel(jsonData, res, filename) {
  if (jsonData.length === 0) res.write("empty");

  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  const keys = Object.keys(jsonData[0]);
  worksheet.columns = keys.map((key) => ({ header: key, key }));
  jsonData.forEach((data) => worksheet.addRow(data));

  await exportToExcel(workbook, res, filename);
}

async function esportCsvToExcel(csvData, res, filename) {
  const stream = Readable.from(csvData);

  const workbook = new excelJs.Workbook();
  await workbook.csv.read(stream);

  await exportToExcel(workbook, res, filename);
}

async function exportToExcel(workbook, res, filename) {
  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename=${filename}.xlsx`);
  res.send(buffer);
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
  ensureArray,
  flattenObject,
  exportJsonToExcel,
  esportCsvToExcel,
};

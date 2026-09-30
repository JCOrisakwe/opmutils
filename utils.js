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
  const workbook = new excelJs.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  if (jsonData && jsonData.length) {
    const keys = Object.keys(jsonData[0]);
    worksheet.columns = keys.map((key) => ({ header: key, key }));
    jsonData.forEach((data) => worksheet.addRow(data));
  }

  await exportToExcel(workbook, res, filename);
}

async function exportCsvToExcel(csvData, res, filename) {
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
    if (!str.trim()) continue;

    if (mergedChunks.length === 0) {
      mergedChunks.push(str.trim());
      continue;
    }

    const lines = str.trim().split(/\r?\n/);
    mergedChunks.push(lines.slice(1).join("\n"));
  }

  return mergedChunks.join("\n");
}

async function safeFetch(url, options = {}, isJson = true, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = `HTTP ${response.status}`;
      console.error("safeFetch failed", { url, error });
      console.error("Response text:", await response.text());
      return isJson ? null : "";
    }

    const rawText = await response.text();
    return isJson ? JSON.parse(rawText || null) : rawText;
  } catch (err) {
    const error = err.name === "AbortError" ? "Timeout" : err.message;
    console.error("safeFetch failed", { url, error });
    return isJson ? null : "";
  } finally {
    clearTimeout(timer);
  }
}

async function safeFullFetch(url, config, isJson = true, timeoutMs = 60000) {
  let dataIncomplete = true;
  const reports = [];

  while (dataIncomplete) {
    const report = await safeFetch(url, config, isJson, timeoutMs);
    reports.push(...(report?.data || []));

    dataIncomplete = report?.pagination?.has_more;

    config.body = JSON.stringify({
      per_page: 200,
      cursor: report?.pagination?.cursor,
    });
  }

  return reports;
}

module.exports = {
  getDatesInRange,
  mergeCSV,
  safeFetch,
  safeFullFetch,
  ensureArray,
  flattenObject,
  exportJsonToExcel,
  exportCsvToExcel,
};

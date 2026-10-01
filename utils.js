const excelJs = require("exceljs");
const { Readable } = require("stream");

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const todayLagos = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

function assertDate(value, label) {
  if (!DATE_RE.test(value || "") || Number.isNaN(Date.parse(value)))
    throw new HttpError(400, `${label} is not a valid date.`);
  if (value > todayLagos())
    throw new HttpError(400, "Date cannot be in the future.");
}

function assertDateRange(from, to, maxDays = 30) {
  assertDate(from, "Start date");
  assertDate(to, "End date");
  const days = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (from > to || days > maxDays)
    throw new HttpError(
      400,
      `Please select a valid date range (maximum ${maxDays} days).`,
    );
}

function assertHasData(data) {
  const empty = typeof data === "string" ? !data.trim() : !data?.length;
  if (empty) throw new HttpError(404, "No data found for that selection.");
}

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(`${req.path} failed:`, err);
    if (res.headersSent) return res.destroy();
    res.removeHeader("Content-Disposition");
    res.removeHeader("Content-Type");
    if (err instanceof HttpError)
      return res.status(err.status).json({ error: err.message });
    res.status(502).json({ error: "Could not fetch data from SparkMeter." });
  }
};

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
  if (item === undefined || item === null) return [];
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

function setDownloadHeaders(res, filename) {
  const safeName = String(filename).replace(/[^\w.-]+/g, "_");
  res.setHeader("Content-Type", XLSX_MIME);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}.xlsx"`,
  );
}

async function exportJsonToExcel(jsonData, res, filename) {
  setDownloadHeaders(res, filename);

  const workbook = new excelJs.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: false,
    useSharedStrings: false,
  });
  const worksheet = workbook.addWorksheet("Sheet1");

  if (jsonData && jsonData.length) {
    const keys = Object.keys(jsonData[0]);
    worksheet.columns = keys.map((key) => ({ header: key, key }));
    for (const row of jsonData) worksheet.addRow(row).commit();
  }

  await worksheet.commit();
  await workbook.commit();
}

async function exportCsvToExcel(csvData, res, filename) {
  const stream = Readable.from(csvData);

  const workbook = new excelJs.Workbook();
  await workbook.csv.read(stream);

  await exportToExcel(workbook, res, filename);
}

async function exportToExcel(workbook, res, filename) {
  // Build the whole file first, so a failure here can still send an error
  const buffer = await workbook.xlsx.writeBuffer();

  setDownloadHeaders(res, filename);
  res.send(buffer);
}

function mergeCSV(csvStrArr) {
  const mergedChunks = [];

  for (const str of csvStrArr) {
    if (!str || !str.trim()) continue;

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
      const err = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      console.error("safeFetch failed", {
        url,
        status: response.status,
        body: await response.text(),
      });
      throw err;
    }

    const rawText = await response.text();
    return isJson ? JSON.parse(rawText || "null") : rawText;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Timeout");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function safeFullFetch(
  url,
  config,
  isJson = true,
  timeoutMs = 60000,
  maxPages = 150,
) {
  const baseBody = JSON.parse(config.body || "{}");
  const rows = [];
  let cursor;

  for (let page = 0; page < maxPages; page++) {
    const body = cursor ? { per_page: baseBody.per_page, cursor } : baseBody;
    const report = await safeFetch(
      url,
      { ...config, body: JSON.stringify(body) },
      isJson,
      timeoutMs,
    );

    rows.push(...(report?.data || []));

    if (!report?.pagination?.has_more) return rows;
    cursor = report.pagination.cursor;
  }

  throw new Error(`Too many pages (over ${maxPages})`);
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
  handle,
  assertDate,
  assertDateRange,
  assertHasData,
  HttpError,
};

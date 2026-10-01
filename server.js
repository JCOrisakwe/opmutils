require("dotenv").config();

const express = require("express");
const path = require("path");
const utils = require("./utils");
const app = express();
const PORT = 3000;

const org_id = process.env.SPARKMETER_ORG_ID;
const baseUrl = "https://sparkmeter.cloud/api/v2";
const options = {
  method: "GET",
  headers: {
    "X-API-KEY": process.env.SPARKMETER_API_KEY,
    "X-API-SECRET": process.env.SPARKMETER_API_SECRET,
    "Content-Type": "application/json",
  },
};

const SITES = {};

async function loadSites() {
  const url = `${baseUrl}/organizations/${org_id}/sites`;
  const data = await utils.safeFetch(url, options);
  for (const site of data.sites) SITES[site.id] = site.name;
  return data.sites;
}

async function assertSites(sites) {
  if (!Object.keys(SITES).length) await loadSites();
  if (!sites.length || !sites.every((id) => id in SITES))
    throw new utils.HttpError(400, "Unknown site.");
}

app.use(express.static(path.join(__dirname, "public")));

app.get(
  "/sites",
  utils.handle(async (req, res) => {
    res.json(await loadSites());
  }),
);

app.get(
  "/freshness",
  utils.handle(async (req, res) => {
    const sites = utils.ensureArray(req.query.sites);
    await assertSites(sites);

    const url = `${baseUrl}/organizations/${org_id}/data/freshness`;
    const data = await utils.safeFetch(url, {
      ...options,
      method: "POST",
      body: JSON.stringify({ filters: { sites } }),
    });

    const parsedData = Object.entries(data.freshness).map(([id, reading]) => ({
      site: SITES[id],
      "last reading": reading?.reading,
    }));

    await utils.exportJsonToExcel(parsedData, res, "freshnessData");
  }),
);

app.get(
  "/live",
  utils.handle(async (req, res) => {
    const sites = utils.ensureArray(req.query.sites);
    const age = req.query.age;
    await assertSites(sites);

    if (!age) throw new utils.HttpError(400, "Age is required.");

    const url = `${baseUrl}/organizations/${org_id}/data/live`;
    const data = await utils.safeFetch(url, {
      ...options,
      method: "POST",
      body: JSON.stringify({ per_page: 200, filters: { sites, age } }),
    });

    utils.assertHasData(data?.data);
    await utils.exportJsonToExcel(data?.data, res, "liveData");
  }),
);

app.get(
  "/historical",
  utils.handle(async (req, res) => {
    const sites = utils.ensureArray(req.query.site_id);
    const dateFrom = req.query.date;
    await assertSites(sites);
    utils.assertDate(dateFrom, "Date");

    const df = new Date(dateFrom);
    df.setUTCDate(df.getUTCDate() + 1);
    const dateTo = df.toISOString().slice(0, 10);

    const url = `${baseUrl}/organizations/${org_id}/data/historical`;
    const data = await utils.safeFullFetch(url, {
      ...options,
      method: "POST",
      body: JSON.stringify({
        per_page: 200,
        filters: { sites, date_range: { from: dateFrom, to: dateTo } },
      }),
    });

    const flattenedData = data.map((item) => utils.flattenObject(item));
    utils.assertHasData(flattenedData);
    await utils.exportJsonToExcel(flattenedData, res, "historicalData");
  }),
);

app.get(
  "/reports",
  utils.handle(async (req, res) => {
    const { dateFrom: date, dateTo, granularity, site_id, type } = req.query;

    await assertSites([site_id]);
    utils.assertDateRange(date, dateTo);
    if (!["daily", "monthly"].includes(granularity))
      throw new utils.HttpError(400, "Invalid granularity.");
    if (!type) throw new utils.HttpError(400, "Report type is required.");

    const fetchReport = async (reportDate) => {
      const params = { date: reportDate, granularity, site_id, type };
      const url = `${baseUrl}/report?${new URLSearchParams(params)}`;
      try {
        return await utils.safeFetch(url, options, false);
      } catch (err) {
        if (err.status === 404) return "";
        throw err;
      }
    };

    const report =
      granularity === "monthly"
        ? [await fetchReport(date)]
        : await Promise.all(
            utils.getDatesInRange(date, dateTo).map(fetchReport),
          );

    const merged = utils.mergeCSV(report);
    utils.assertHasData(merged);
    await utils.exportCsvToExcel(merged, res, "reportsData");
  }),
);

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`),
);

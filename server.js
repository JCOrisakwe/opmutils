const express = require("express");
const path = require("path");
const utils = require("./utils");
const app = express();
const PORT = 3000;

const org_id = "64bfd8cd-d361-4368-98c9-c0ea3730559d";
const baseUrl = "https://sparkmeter.cloud/api/v2";
const options = {
  method: "GET",
  headers: {
    "X-API-KEY": "NhjJ3BOBPsrTV_9wEBlrMnDo9VNQT5DcZRyEWRqSgSw",
    "X-API-SECRET": "@Rm7HqY@sg05&1BCfr^m@2nZELD)y@kV",
    "Content-Type": "application/json",
  },
};
const SITES = {};

app.use(express.static(path.join(__dirname, "public")));

app.get("/sites", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/sites`;
  const data = await utils.safeFetch(url, options);
  for (const site of data.sites) SITES[site.id] = site.name;
  res.json(data.sites);
});

app.get("/freshness", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/data/freshness`;
  const sites = utils.ensureArray(req.query.sites);

  const data = await utils.safeFetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify({ filters: { sites } }),
  });

  const parsedData = [];
  for (const [site_id, reading] of Object.entries(data.freshness)) {
    parsedData.push({ site: SITES[site_id], "last reading": reading?.reading });
  }

  utils.exportJsonToExcel(parsedData, res, "freshnessData");
});

app.get("/live", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/data/live`;
  const sites = utils.ensureArray(req.query.sites);
  const age = req.query.age;

  const data = await utils.safeFetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify({ per_page: 200, filters: { sites, age } }),
  });

  utils.exportJsonToExcel(data.data, res, "liveData");
});

app.get("/historical", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/data/historical`;
  const sites = utils.ensureArray(req.query.site_id);
  const { dateFrom: from, dateTo: to } = req.query;

  const data = await utils.safeFetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify({
      per_page: 200,
      filters: { sites, date_range: { from, to } },
    }),
  });

  const flattenedData = data.data.map((item) => utils.flattenObject(item));
  utils.exportJsonToExcel(flattenedData, res, "historicalData");
});

app.get("/reports", async (req, res) => {
  const { dateFrom: date, dateTo, granularity, site_id, type } = req.query;

  const fetchReport = async (reportDate) => {
    const params = { date: reportDate, granularity, site_id, type };
    const url = `${baseUrl}/report?${new URLSearchParams(params).toString()}`;
    return await utils.safeFetch(url, options, false);
  };

  let report;
  if (granularity === "monthly") {
    report = [await fetchReport(date)];
  } else if (granularity === "daily") {
    const promises = utils.getDatesInRange(date, dateTo).map(fetchReport);
    report = await Promise.all(promises);
  }

  utils.esportCsvToExcel(utils.mergeCSV(report), res, "reportsData");
});

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`),
);

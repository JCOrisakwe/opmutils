const express = require("express");
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
const SITES = {
  "3a1bb0d2-4521-4f24-bab9-8426d4827480": "ADEBAYO COMMUNITY MAIN",
  "31454d1f-6cf7-49d2-9567-eb506079ca60": "ADEWALE COMMUNITY",
  "ca0e1988-41c8-4298-a229-1ec1c2f19585": "AJEGUNLE COMMUNITY",
  "a790a744-ee49-4a3f-8995-7843439f4c6f": "MILE 13 CLUSTER",
};

app.get("/sites", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/sites`;
  const response = await fetch(url, options);
  const data = await response.json();
  for (const site of data.sites) SITES[site.id] = site.name;
  res.json(data.sites);
});

app.get("/freshness", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/data/freshness`;

  const response = await fetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify({ filters: { sites: Object.keys(SITES) } }),
  });
  const data = await response.json();

  const parsedData = [];
  for (const [site_id, reading] of Object.entries(data.freshness)) {
    parsedData.push({ site: SITES[site_id], "last reading": reading?.reading });
  }

  res.json(parsedData);
});

app.get("/live", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/data/live`;

  const response = await fetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify({
      per_page: 200,
      filters: { sites: Object.keys(SITES), age: "30m" },
    }),
  });
  const data = await response.json();

  res.json(data);
});

app.get("/historical", async (req, res) => {
  const url = `${baseUrl}/organizations/${org_id}/data/historical`;

  const response = await fetch(url, {
    ...options,
    method: "POST",
    body: JSON.stringify({
      per_page: 200,
      filters: {
        sites: Object.keys(SITES),
        date_range: { from: "2026-08-15", to: "2026-08-16" },
      },
    }),
  });
  const data = await response.json();

  res.json(data);
});

app.get("/reports", async (req, res) => {
  const params = {
    granularity: "daily",
    site_id: Object.keys(SITES)[0],
    type: "payments",
  };

  const promises = utils
    .getDatesInRange("2026-09-01", "2026-09-03")
    .map(async (date) => {
      params.date = date;
      const url = `${baseUrl}/report?${new URLSearchParams(params).toString()}`;
      const response = await fetch(url, options);
      return await response.text();
    });
  const data = await Promise.all(promises);

  res.json(data);
});

app.listen(3000, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`),
);
